import logging
import tempfile
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.config import settings
from core.database import get_db
from core.model_manager import ModelManager
from core.cache_manager import VoiceCacheManager
from db.models import Job, JobStatus, User
from schemas.tts import CustomVoiceRequest, VoiceDesignRequest
from api.auth import get_current_user
from utils.validation import (
    validate_language,
    validate_speaker,
    validate_text_length,
    validate_generation_params,
    get_supported_languages,
    get_supported_speakers
)
from utils.audio import save_audio_file, validate_ref_audio, process_ref_audio, extract_audio_features
from utils.metrics import cache_metrics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])

limiter = Limiter(key_func=get_remote_address)


async def process_custom_voice_job(
    job_id: int,
    user_id: int,
    request_data: dict,
    db_url: str
):
    from core.database import SessionLocal

    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.utcnow()
        db.commit()

        logger.info(f"Processing custom-voice job {job_id}")

        model_manager = await ModelManager.get_instance()
        await model_manager.load_model("custom-voice")
        _, tts = await model_manager.get_current_model()

        if tts is None:
            raise RuntimeError("Failed to load custom-voice model")

        result = tts.generate_custom_voice(
            text=request_data['text'],
            language=request_data['language'],
            speaker=request_data['speaker'],
            instruct=request_data.get('instruct', ''),
            max_new_tokens=request_data['max_new_tokens'],
            temperature=request_data['temperature'],
            top_k=request_data['top_k'],
            top_p=request_data['top_p'],
            repetition_penalty=request_data['repetition_penalty']
        )

        import numpy as np
        if isinstance(result, tuple):
            audio_data = result[0]
        elif isinstance(result, list):
            audio_data = np.array(result)
        else:
            audio_data = result

        from pathlib import Path

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{user_id}_{job_id}_{timestamp}.wav"
        output_path = Path(settings.OUTPUT_DIR) / filename

        save_audio_file(audio_data, 24000, output_path)

        job.status = JobStatus.COMPLETED
        job.output_path = str(output_path)
        job.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Job {job_id} completed successfully")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()

    finally:
        db.close()


async def process_voice_design_job(
    job_id: int,
    user_id: int,
    request_data: dict,
    db_url: str
):
    from core.database import SessionLocal

    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.utcnow()
        db.commit()

        logger.info(f"Processing voice-design job {job_id}")

        model_manager = await ModelManager.get_instance()
        await model_manager.load_model("voice-design")
        _, tts = await model_manager.get_current_model()

        if tts is None:
            raise RuntimeError("Failed to load voice-design model")

        result = tts.generate_voice_design(
            text=request_data['text'],
            language=request_data['language'],
            instruct=request_data['instruct'],
            max_new_tokens=request_data['max_new_tokens'],
            temperature=request_data['temperature'],
            top_k=request_data['top_k'],
            top_p=request_data['top_p'],
            repetition_penalty=request_data['repetition_penalty']
        )

        import numpy as np
        if isinstance(result, tuple):
            audio_data = result[0]
        elif isinstance(result, list):
            audio_data = np.array(result)
        else:
            audio_data = result

        from pathlib import Path

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{user_id}_{job_id}_{timestamp}.wav"
        output_path = Path(settings.OUTPUT_DIR) / filename

        save_audio_file(audio_data, 24000, output_path)

        job.status = JobStatus.COMPLETED
        job.output_path = str(output_path)
        job.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Job {job_id} completed successfully")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()

    finally:
        db.close()


async def process_voice_clone_job(
    job_id: int,
    user_id: int,
    request_data: dict,
    ref_audio_path: str,
    db_url: str
):
    from core.database import SessionLocal
    import numpy as np

    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        job.status = JobStatus.PROCESSING
        job.started_at = datetime.utcnow()
        db.commit()

        logger.info(f"Processing voice-clone job {job_id}")

        with open(ref_audio_path, 'rb') as f:
            ref_audio_data = f.read()

        cache_manager = await VoiceCacheManager.get_instance()
        ref_audio_hash = cache_manager.get_audio_hash(ref_audio_data)

        x_vector = None
        cache_id = None

        if request_data.get('use_cache', True):
            cached = await cache_manager.get_cache(user_id, ref_audio_hash, db)
            if cached:
                x_vector = cached['data']
                cache_id = cached['cache_id']
                cache_metrics.record_hit(user_id)
                logger.info(f"Cache hit for job {job_id}, cache_id={cache_id}")

        if x_vector is None:
            cache_metrics.record_miss(user_id)
            logger.info(f"Cache miss for job {job_id}, creating voice clone prompt")
            ref_audio_array, ref_sr = process_ref_audio(ref_audio_data)

            model_manager = await ModelManager.get_instance()
            await model_manager.load_model("base")
            _, tts = await model_manager.get_current_model()

            if tts is None:
                raise RuntimeError("Failed to load base model")

            x_vector = tts.create_voice_clone_prompt(
                ref_audio=(ref_audio_array, ref_sr),
                ref_text=request_data.get('ref_text', ''),
                x_vector_only_mode=request_data.get('x_vector_only_mode', False)
            )

            if request_data.get('use_cache', True):
                features = extract_audio_features(ref_audio_array, ref_sr)
                metadata = {
                    'duration': features['duration'],
                    'sample_rate': features['sample_rate'],
                    'ref_text': request_data.get('ref_text', ''),
                    'x_vector_only_mode': request_data.get('x_vector_only_mode', False)
                }
                cache_id = await cache_manager.set_cache(
                    user_id, ref_audio_hash, x_vector, metadata, db
                )
                logger.info(f"Created cache for job {job_id}, cache_id={cache_id}")

        if request_data.get('x_vector_only_mode', False):
            job.status = JobStatus.COMPLETED
            job.output_path = f"x_vector_cached_{cache_id}"
            job.completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"Job {job_id} completed (x_vector_only_mode)")
            return

        model_manager = await ModelManager.get_instance()
        await model_manager.load_model("base")
        _, tts = await model_manager.get_current_model()

        if tts is None:
            raise RuntimeError("Failed to load base model")

        wavs, sample_rate = tts.generate_voice_clone(
            text=request_data['text'],
            language=request_data['language'],
            voice_clone_prompt=x_vector,
            max_new_tokens=request_data['max_new_tokens'],
            temperature=request_data['temperature'],
            top_k=request_data['top_k'],
            top_p=request_data['top_p'],
            repetition_penalty=request_data['repetition_penalty']
        )

        audio_data = wavs[0] if isinstance(wavs, list) else wavs

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{user_id}_{job_id}_{timestamp}.wav"
        output_path = Path(settings.OUTPUT_DIR) / filename

        save_audio_file(audio_data, sample_rate, output_path)

        job.status = JobStatus.COMPLETED
        job.output_path = str(output_path)
        job.completed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Job {job_id} completed successfully")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            db.commit()

    finally:
        if Path(ref_audio_path).exists():
            Path(ref_audio_path).unlink()
        db.close()


@router.post("/custom-voice")
@limiter.limit("10/minute")
async def create_custom_voice_job(
    request: Request,
    req_data: CustomVoiceRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        validate_text_length(req_data.text)
        language = validate_language(req_data.language)
        speaker = validate_speaker(req_data.speaker)

        params = validate_generation_params({
            'max_new_tokens': req_data.max_new_tokens,
            'temperature': req_data.temperature,
            'top_k': req_data.top_k,
            'top_p': req_data.top_p,
            'repetition_penalty': req_data.repetition_penalty
        })

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    job = Job(
        user_id=current_user.id,
        job_type="custom-voice",
        status=JobStatus.PENDING,
        input_data="",
        input_params={
            "text": req_data.text,
            "language": language,
            "speaker": speaker,
            "instruct": req_data.instruct or "",
            **params
        }
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    request_data = {
        "text": req_data.text,
        "language": language,
        "speaker": speaker,
        "instruct": req_data.instruct or "",
        **params
    }

    background_tasks.add_task(
        process_custom_voice_job,
        job.id,
        current_user.id,
        request_data,
        str(settings.DATABASE_URL)
    )

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Job created successfully"
    }


@router.post("/voice-design")
@limiter.limit("10/minute")
async def create_voice_design_job(
    request: Request,
    req_data: VoiceDesignRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        validate_text_length(req_data.text)
        language = validate_language(req_data.language)

        if not req_data.instruct or not req_data.instruct.strip():
            raise ValueError("Instruct parameter is required for voice design")

        params = validate_generation_params({
            'max_new_tokens': req_data.max_new_tokens,
            'temperature': req_data.temperature,
            'top_k': req_data.top_k,
            'top_p': req_data.top_p,
            'repetition_penalty': req_data.repetition_penalty
        })

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    job = Job(
        user_id=current_user.id,
        job_type="voice-design",
        status=JobStatus.PENDING,
        input_data="",
        input_params={
            "text": req_data.text,
            "language": language,
            "instruct": req_data.instruct,
            **params
        }
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    request_data = {
        "text": req_data.text,
        "language": language,
        "instruct": req_data.instruct,
        **params
    }

    background_tasks.add_task(
        process_voice_design_job,
        job.id,
        current_user.id,
        request_data,
        str(settings.DATABASE_URL)
    )

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Job created successfully"
    }


@router.post("/voice-clone")
@limiter.limit("10/minute")
async def create_voice_clone_job(
    request: Request,
    text: str = Form(...),
    language: str = Form(default="Auto"),
    ref_audio: UploadFile = File(...),
    ref_text: Optional[str] = Form(default=None),
    use_cache: bool = Form(default=True),
    x_vector_only_mode: bool = Form(default=False),
    max_new_tokens: Optional[int] = Form(default=2048),
    temperature: Optional[float] = Form(default=0.9),
    top_k: Optional[int] = Form(default=50),
    top_p: Optional[float] = Form(default=1.0),
    repetition_penalty: Optional[float] = Form(default=1.05),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        validate_text_length(text)
        language = validate_language(language)

        params = validate_generation_params({
            'max_new_tokens': max_new_tokens,
            'temperature': temperature,
            'top_k': top_k,
            'top_p': top_p,
            'repetition_penalty': repetition_penalty
        })

        ref_audio_data = await ref_audio.read()

        if not validate_ref_audio(ref_audio_data, max_size_mb=settings.MAX_AUDIO_SIZE_MB):
            raise ValueError("Invalid reference audio: must be 1-30s duration and ≤10MB")

        cache_manager = await VoiceCacheManager.get_instance()
        ref_audio_hash = cache_manager.get_audio_hash(ref_audio_data)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    job = Job(
        user_id=current_user.id,
        job_type="voice-clone",
        status=JobStatus.PENDING,
        input_data="",
        input_params={
            "text": text,
            "language": language,
            "ref_text": ref_text or "",
            "ref_audio_hash": ref_audio_hash,
            "use_cache": use_cache,
            "x_vector_only_mode": x_vector_only_mode,
            **params
        }
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
        tmp_file.write(ref_audio_data)
        tmp_audio_path = tmp_file.name

    request_data = {
        "text": text,
        "language": language,
        "ref_text": ref_text or "",
        "use_cache": use_cache,
        "x_vector_only_mode": x_vector_only_mode,
        **params
    }

    background_tasks.add_task(
        process_voice_clone_job,
        job.id,
        current_user.id,
        request_data,
        tmp_audio_path,
        str(settings.DATABASE_URL)
    )

    existing_cache = await cache_manager.get_cache(current_user.id, ref_audio_hash, db)
    cache_info = {"cache_id": existing_cache['cache_id']} if existing_cache else None

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Job created successfully",
        "cache_info": cache_info
    }


@router.get("/models")
@limiter.limit("30/minute")
async def list_models(request: Request):
    model_manager = await ModelManager.get_instance()
    return model_manager.get_model_info()


@router.get("/speakers")
@limiter.limit("30/minute")
async def list_speakers(request: Request):
    return get_supported_speakers()


@router.get("/languages")
@limiter.limit("30/minute")
async def list_languages(request: Request):
    return get_supported_languages()
