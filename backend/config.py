import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env", override=False)


def _path(name: str, default: str) -> Path:
    return (BASE_DIR / Path(os.getenv(name) or default).expanduser()).resolve()


HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

PASSWORD = os.getenv("WEBUI_PASSWORD", "")

DATA_DIR = _path("DATA_DIR", "./data")
MODEL_DIR = _path("MODEL_DIR", str(DATA_DIR / "models"))
FRONTEND_DIST = _path("FRONTEND_DIST", "../frontend/dist")

DEVICE = os.getenv("DEVICE", "auto")
MODEL_SIZE = os.getenv("MODEL_SIZE", "1.7B")
MAX_LOADED_MODELS = max(1, int(os.getenv("MAX_LOADED_MODELS", "1")))
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "2000"))

HISTORY_DIR = DATA_DIR / "history"
VOICES_DIR = DATA_DIR / "voices"

for d in (HISTORY_DIR, VOICES_DIR, MODEL_DIR):
    d.mkdir(parents=True, exist_ok=True)


def _secret_key() -> str:
    key = os.getenv("SECRET_KEY", "")
    if key:
        return key
    key_file = DATA_DIR / "secret.key"
    if key_file.is_file() and key_file.read_text().strip():
        return key_file.read_text().strip()
    key = secrets.token_urlsafe(48)
    key_file.write_text(key)
    key_file.chmod(0o600)
    return key


SECRET_KEY = _secret_key()
