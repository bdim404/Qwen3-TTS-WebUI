import io
import json
import re
import secrets
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ID_RE = re.compile(r"^[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$")


def new_id() -> str:
    return time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(3)


def write_wav(path: Path, audio: np.ndarray, sr: int):
    sf.write(path, np.clip(audio, -1.0, 1.0), sr, subtype="PCM_16")


def read_wav(data: bytes) -> tuple[np.ndarray, int]:
    audio, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    return audio.mean(axis=1), sr


class Store:
    def __init__(self, root: Path):
        self.root = root

    def _paths(self, item_id: str) -> tuple[Path, Path]:
        if not ID_RE.match(item_id):
            raise KeyError(item_id)
        return self.root / f"{item_id}.json", self.root / f"{item_id}.wav"

    def add(self, meta: dict, audio: np.ndarray, sr: int) -> dict:
        item_id = new_id()
        meta_path, wav_path = self._paths(item_id)
        write_wav(wav_path, audio, sr)
        meta = {"id": item_id, "created_at": time.time(), "duration": round(len(audio) / sr, 2), **meta}
        meta_path.write_text(json.dumps(meta, ensure_ascii=False))
        return meta

    def get(self, item_id: str) -> dict:
        meta_path, _ = self._paths(item_id)
        if not meta_path.is_file():
            raise KeyError(item_id)
        return json.loads(meta_path.read_text())

    def audio_path(self, item_id: str) -> Path:
        _, wav_path = self._paths(item_id)
        if not wav_path.is_file():
            raise KeyError(item_id)
        return wav_path

    def list(self) -> list[dict]:
        items = []
        for p in self.root.glob("*.json"):
            try:
                items.append(json.loads(p.read_text()))
            except (OSError, ValueError):
                continue
        return sorted(items, key=lambda m: m.get("created_at", 0), reverse=True)

    def delete(self, item_id: str):
        for p in self._paths(item_id):
            p.unlink(missing_ok=True)
