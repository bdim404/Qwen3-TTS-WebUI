import asyncio
import hashlib
import hmac
import json
import logging

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, field_validator

import config
import engine
from store import Store, read_wav

logging.basicConfig(level=config.LOG_LEVEL.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")
for noisy in ("qwen_tts", "httpx", "transformers"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

history = Store(config.HISTORY_DIR)
voices = Store(config.VOICES_DIR)

SESSION_COOKIE = "qwen_tts_session"
SESSION_TOKEN = hmac.new(config.SECRET_KEY.encode(), f"session:{config.PASSWORD}".encode(), hashlib.sha256).hexdigest()
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
PUBLIC_PATHS = {"/api/status", "/api/login", "/api/logout"}

app = FastAPI(title="Qwen3-TTS WebUI", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)


def is_authenticated(request: Request) -> bool:
    if not config.PASSWORD:
        return True
    return hmac.compare_digest(request.cookies.get(SESSION_COOKIE, ""), SESSION_TOKEN)


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path not in PUBLIC_PATHS and not is_authenticated(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


class Params(BaseModel):
    max_new_tokens: int = Field(2048, ge=128, le=8192)
    temperature: float = Field(0.9, ge=0.1, le=2.0)
    top_k: int = Field(50, ge=1, le=100)
    top_p: float = Field(1.0, ge=0.0, le=1.0)
    repetition_penalty: float = Field(1.05, ge=1.0, le=2.0)


class BaseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=config.MAX_TEXT_LENGTH)
    language: str = "Auto"
    params: Params = Params()

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Text is empty")
        return v.strip()

    @field_validator("language")
    @classmethod
    def check_language(cls, v: str) -> str:
        if v not in engine.LANGUAGES:
            raise ValueError(f"Unsupported language: {v}")
        return v


class CustomVoiceRequest(BaseRequest):
    speaker: str
    instruct: str = ""

    @field_validator("speaker")
    @classmethod
    def check_speaker(cls, v: str) -> str:
        if v not in engine.SPEAKERS:
            raise ValueError(f"Unsupported speaker: {v}")
        return v


class VoiceDesignRequest(BaseRequest):
    instruct: str = Field(min_length=1, max_length=2000)


class LoginRequest(BaseModel):
    password: str


def generate(meta: dict, fn, **kwargs) -> dict:
    try:
        audio, sr = fn(**kwargs)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        log.exception("Generation failed")
        raise HTTPException(500, f"Generation failed: {e}")
    return history.add(meta, audio, sr)


async def read_upload(upload: UploadFile) -> tuple:
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Reference audio is larger than 20 MB")
    try:
        audio, sr = read_wav(data)
    except Exception:
        raise HTTPException(400, "Reference audio must be a WAV, FLAC or OGG file")
    duration = len(audio) / sr
    if not 1 <= duration <= 60:
        raise HTTPException(400, "Reference audio must be between 1 and 60 seconds")
    return audio, sr


def lookup(store: Store, item_id: str) -> dict:
    try:
        return store.get(item_id)
    except KeyError:
        raise HTTPException(404, "Not found")


@app.get("/api/status")
def status(request: Request):
    return {
        "auth_required": bool(config.PASSWORD),
        "authenticated": is_authenticated(request),
        "device": engine.DEVICE,
        "model_size": config.MODEL_SIZE,
        "busy": engine.status,
        "loaded_models": engine.loaded_models(),
        "languages": engine.LANGUAGES,
        "speakers": engine.SPEAKERS,
        "max_text_length": config.MAX_TEXT_LENGTH,
    }


@app.post("/api/login")
async def login(body: LoginRequest, response: Response):
    if not config.PASSWORD or not hmac.compare_digest(body.password.encode(), config.PASSWORD.encode()):
        await asyncio.sleep(1)
        raise HTTPException(401, "Wrong password")
    response.set_cookie(SESSION_COOKIE, SESSION_TOKEN, max_age=30 * 86400, httponly=True, samesite="lax")
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.post("/api/tts/custom-voice")
def tts_custom_voice(body: CustomVoiceRequest):
    meta = {"mode": "custom-voice", "text": body.text, "language": body.language,
            "speaker": body.speaker, "instruct": body.instruct, "params": body.params.model_dump()}
    return generate(meta, engine.custom_voice, text=body.text, language=body.language,
                    speaker=body.speaker, instruct=body.instruct, **body.params.model_dump())


@app.post("/api/tts/voice-design")
def tts_voice_design(body: VoiceDesignRequest):
    meta = {"mode": "voice-design", "text": body.text, "language": body.language,
            "instruct": body.instruct, "params": body.params.model_dump()}
    return generate(meta, engine.voice_design, text=body.text, language=body.language,
                    instruct=body.instruct, **body.params.model_dump())


@app.post("/api/tts/voice-clone")
async def tts_voice_clone(
    text: str = Form(...),
    language: str = Form("Auto"),
    params: str = Form("{}"),
    voice_id: str | None = Form(None),
    ref_text: str = Form(""),
    ref_audio: UploadFile | None = File(None),
    save_as: str = Form(""),
):
    try:
        req = BaseRequest(text=text, language=language, params=Params(**json.loads(params or "{}")))
    except (ValidationError, ValueError) as e:
        raise HTTPException(422, str(e))

    if voice_id:
        voice = lookup(voices, voice_id)
        ref = read_wav(voices.audio_path(voice_id).read_bytes())
        ref_text = voice.get("ref_text", "")
        voice_name = voice["name"]
    elif ref_audio is not None:
        ref = await read_upload(ref_audio)
        ref_text = ref_text.strip()
        voice_name = save_as.strip()[:100] or None
        if voice_name:
            voice_id = voices.add({"name": voice_name, "ref_text": ref_text, "source": "upload"}, *ref)["id"]
    else:
        raise HTTPException(400, "Provide a saved voice or a reference audio")

    meta = {"mode": "voice-clone", "text": req.text, "language": req.language, "voice": voice_name,
            "voice_id": voice_id, "ref_text": ref_text, "params": req.params.model_dump()}
    return await asyncio.to_thread(
        generate, meta, engine.voice_clone, text=req.text, language=req.language,
        ref_audio=ref, ref_text=ref_text, **req.params.model_dump(),
    )


@app.get("/api/history")
def list_history():
    return history.list()


@app.get("/api/history/{item_id}/audio")
def history_audio(item_id: str):
    lookup(history, item_id)
    return FileResponse(history.audio_path(item_id), media_type="audio/wav", filename=f"qwen-tts-{item_id}.wav")


@app.delete("/api/history/{item_id}")
def delete_history(item_id: str):
    lookup(history, item_id)
    history.delete(item_id)
    return {"ok": True}


@app.get("/api/voices")
def list_voices():
    return voices.list()


@app.post("/api/voices")
async def create_voice(
    name: str = Form(..., min_length=1, max_length=100),
    ref_text: str = Form(""),
    history_id: str | None = Form(None),
    ref_audio: UploadFile | None = File(None),
):
    if history_id:
        item = lookup(history, history_id)
        ref = read_wav(history.audio_path(history_id).read_bytes())
        meta = {"name": name.strip(), "ref_text": ref_text.strip() or item["text"],
                "source": item["mode"], "instruct": item.get("instruct", "")}
    elif ref_audio is not None:
        ref = await read_upload(ref_audio)
        meta = {"name": name.strip(), "ref_text": ref_text.strip(), "source": "upload"}
    else:
        raise HTTPException(400, "Provide a history item or a reference audio")
    return voices.add(meta, *ref)


@app.get("/api/voices/{voice_id}/audio")
def voice_audio(voice_id: str):
    lookup(voices, voice_id)
    return FileResponse(voices.audio_path(voice_id), media_type="audio/wav")


@app.delete("/api/voices/{voice_id}")
def delete_voice(voice_id: str):
    lookup(voices, voice_id)
    voices.delete(voice_id)
    return {"ok": True}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def api_not_found(path: str):
    raise HTTPException(404, "Not found")


def mount_frontend():
    dist = config.FRONTEND_DIST
    index = dist / "index.html"
    if not index.is_file():
        log.warning("Frontend build not found at %s, serving the API only", dist)
        return
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = (dist / path).resolve()
        if path and candidate.is_relative_to(dist) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


mount_frontend()


if __name__ == "__main__":
    import uvicorn

    if not config.PASSWORD and config.HOST not in ("127.0.0.1", "localhost", "::1"):
        log.warning("Listening on %s without WEBUI_PASSWORD: anyone on the network can use this WebUI", config.HOST)
    log.info("Device: %s, model size: %s, data: %s", engine.DEVICE, config.MODEL_SIZE, config.DATA_DIR)
    log.info("Open http://%s:%d", "localhost" if config.HOST in ("0.0.0.0", "::") else config.HOST, config.PORT)
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level=config.LOG_LEVEL)
