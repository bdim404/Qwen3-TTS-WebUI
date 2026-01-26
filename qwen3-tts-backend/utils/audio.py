import base64
import io
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy import signal


def validate_ref_audio(audio_data: bytes, max_size_mb: int = 10) -> bool:
    try:
        size_mb = len(audio_data) / (1024 * 1024)
        if size_mb > max_size_mb:
            return False

        buffer = io.BytesIO(audio_data)
        audio_array, sample_rate = sf.read(buffer)

        duration = len(audio_array) / sample_rate
        if duration < 1.0 or duration > 30.0:
            return False

        return True
    except Exception:
        return False


def process_ref_audio(audio_data: bytes) -> tuple[np.ndarray, int]:
    buffer = io.BytesIO(audio_data)
    audio_array, orig_sr = sf.read(buffer)

    if audio_array.ndim > 1:
        audio_array = np.mean(audio_array, axis=1)

    target_sr = 24000
    if orig_sr != target_sr:
        audio_array = resample_audio(audio_array, orig_sr, target_sr)

    audio_array = audio_array.astype(np.float32)
    return audio_array, target_sr


def resample_audio(audio_array: np.ndarray, orig_sr: int, target_sr: int = 24000) -> np.ndarray:
    if orig_sr == target_sr:
        return audio_array

    num_samples = int(len(audio_array) * target_sr / orig_sr)
    resampled = signal.resample(audio_array, num_samples)
    return resampled.astype(np.float32)


def extract_audio_features(audio_array: np.ndarray, sample_rate: int) -> dict:
    duration = len(audio_array) / sample_rate
    rms_energy = np.sqrt(np.mean(audio_array ** 2))

    return {
        'duration': float(duration),
        'sample_rate': int(sample_rate),
        'num_samples': int(len(audio_array)),
        'rms_energy': float(rms_energy)
    }


def encode_audio_to_base64(audio_array: np.ndarray, sample_rate: int) -> str:
    buffer = io.BytesIO()
    sf.write(buffer, audio_array, sample_rate, format='WAV')
    buffer.seek(0)
    audio_bytes = buffer.read()
    return base64.b64encode(audio_bytes).decode('utf-8')


def decode_base64_to_audio(base64_string: str) -> tuple[np.ndarray, int]:
    audio_bytes = base64.b64decode(base64_string)
    buffer = io.BytesIO(audio_bytes)
    audio_array, sample_rate = sf.read(buffer)
    return audio_array, sample_rate


def validate_audio_format(audio_data: bytes) -> bool:
    try:
        buffer = io.BytesIO(audio_data)
        sf.read(buffer)
        return True
    except Exception:
        return False


def get_audio_duration(audio_array: np.ndarray, sample_rate: int) -> float:
    return len(audio_array) / sample_rate


def save_audio_file(
    audio_array: np.ndarray,
    sample_rate: int,
    output_path: str | Path
) -> str:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not isinstance(audio_array, np.ndarray):
        audio_array = np.array(audio_array, dtype=np.float32)

    if audio_array.ndim == 1:
        pass
    elif audio_array.ndim == 2:
        if audio_array.shape[0] < audio_array.shape[1]:
            audio_array = audio_array.T
    else:
        raise ValueError(f"Unexpected audio array shape: {audio_array.shape}")

    audio_array = audio_array.astype(np.float32)

    sf.write(str(output_path), audio_array, sample_rate, format='WAV', subtype='PCM_16')
    return str(output_path)
