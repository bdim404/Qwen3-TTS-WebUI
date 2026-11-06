import gc
import logging
import threading
from collections import OrderedDict
from importlib.util import find_spec

import numpy as np
import torch

import config

log = logging.getLogger("engine")

LANGUAGES = [
    "Auto", "Chinese", "English", "Japanese", "Korean", "German",
    "French", "Russian", "Portuguese", "Spanish", "Italian", "Cantonese",
]

SPEAKERS = [
    "Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric",
    "Ryan", "Aiden", "Ono_Anna", "Sohee",
]

MODELS = {
    "custom-voice": f"Qwen3-TTS-12Hz-{config.MODEL_SIZE}-CustomVoice",
    "voice-design": "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    "base": f"Qwen3-TTS-12Hz-{config.MODEL_SIZE}-Base",
}


def _pick_device() -> tuple[str, torch.dtype]:
    device = config.DEVICE
    if device == "auto":
        if torch.cuda.is_available():
            device = "cuda:0"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"
    dtype = torch.bfloat16 if device.startswith("cuda") else torch.float32
    return device, dtype


DEVICE, DTYPE = _pick_device()

_lock = threading.Lock()
_loaded: "OrderedDict[str, object]" = OrderedDict()
status: str | None = None


def _ensure_downloaded(name: str):
    path = config.MODEL_DIR / name
    marker = path / ".complete"
    if marker.exists():
        return path
    global status
    status = f"downloading:{name}"
    log.info("Downloading Qwen/%s to %s", name, path)
    from huggingface_hub import snapshot_download

    snapshot_download(repo_id=f"Qwen/{name}", local_dir=path)
    marker.touch()
    return path


def _get_model(kind: str):
    global status
    if kind in _loaded:
        _loaded.move_to_end(kind)
        return _loaded[kind]
    name = MODELS[kind]
    path = _ensure_downloaded(name)
    while len(_loaded) >= config.MAX_LOADED_MODELS:
        old, _ = _loaded.popitem(last=False)
        log.info("Unloading %s", MODELS[old])
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    status = f"loading:{name}"
    log.info("Loading %s on %s", name, DEVICE)
    from qwen_tts import Qwen3TTSModel

    kwargs = {"device_map": DEVICE, "dtype": DTYPE}
    if DEVICE.startswith("cuda") and find_spec("flash_attn"):
        kwargs["attn_implementation"] = "flash_attention_2"
    model = Qwen3TTSModel.from_pretrained(str(path), **kwargs)
    _loaded[kind] = model
    return model


def _run(kind: str, method: str, **kwargs) -> tuple[np.ndarray, int]:
    global status
    with _lock:
        try:
            model = _get_model(kind)
            status = "generating"
            wavs, sr = getattr(model, method)(**kwargs)
        finally:
            status = None
    audio = np.asarray(wavs[0] if isinstance(wavs, list) else wavs, dtype=np.float32)
    return audio, sr


def custom_voice(text: str, language: str, speaker: str, instruct: str, **params):
    return _run(
        "custom-voice", "generate_custom_voice",
        text=text, language=language, speaker=speaker, instruct=instruct or None, **params,
    )


def voice_design(text: str, language: str, instruct: str, **params):
    return _run(
        "voice-design", "generate_voice_design",
        text=text, language=language, instruct=instruct, **params,
    )


def voice_clone(text: str, language: str, ref_audio: tuple[np.ndarray, int], ref_text: str, **params):
    return _run(
        "base", "generate_voice_clone",
        text=text, language=language, ref_audio=ref_audio,
        ref_text=ref_text or None, x_vector_only_mode=not ref_text, **params,
    )


def loaded_models() -> list[str]:
    return [MODELS[k] for k in _loaded]
