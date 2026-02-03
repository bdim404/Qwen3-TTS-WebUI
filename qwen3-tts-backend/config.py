import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

class Settings(BaseSettings):
    SECRET_KEY: str = Field(default="your-secret-key-change-this-in-production")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)

    DATABASE_URL: str = Field(default="sqlite:///./qwen_tts.db")
    CACHE_DIR: str = Field(default="./voice_cache")
    OUTPUT_DIR: str = Field(default="./outputs")
    BASE_URL: str = Field(default="")

    MODEL_DEVICE: str = Field(default="cuda:0")
    MODEL_BASE_PATH: str = Field(default="../Qwen")

    MAX_CACHE_ENTRIES: int = Field(default=100)
    CACHE_TTL_DAYS: int = Field(default=7)

    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    WORKERS: int = Field(default=1)
    LOG_LEVEL: str = Field(default="info")
    LOG_FILE: str = Field(default="./app.log")

    RATE_LIMIT_PER_MINUTE: int = Field(default=50)
    RATE_LIMIT_PER_HOUR: int = Field(default=1000)

    MAX_QUEUE_SIZE: int = Field(default=100)
    BATCH_SIZE: int = Field(default=4)
    BATCH_WAIT_TIME: float = Field(default=0.5)

    MAX_TEXT_LENGTH: int = Field(default=1000)
    MAX_AUDIO_SIZE_MB: int = Field(default=10)

    ALIYUN_REGION: str = Field(default="beijing")

    ALIYUN_MODEL_FLASH: str = Field(default="qwen3-tts-flash-realtime")
    ALIYUN_MODEL_VC: str = Field(default="qwen3-tts-vc-realtime-2026-01-15")
    ALIYUN_MODEL_VD: str = Field(default="qwen3-tts-vd-realtime-2026-01-15")

    DEFAULT_BACKEND: str = Field(default="local")

    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator('MODEL_BASE_PATH')
    @classmethod
    def validate_model_path(cls, v: str) -> str:
        path = Path(v)
        if not path.exists():
            raise ValueError(f"Model base path does not exist: {v}")
        return v

    def validate(self):
        if self.SECRET_KEY == "your-secret-key-change-this-in-production":
            import warnings
            warnings.warn("Using default SECRET_KEY! Change this in production!")

        Path(self.CACHE_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

        if self.WORKERS > 1:
            import warnings
            warnings.warn("WORKERS > 1 not recommended for GPU models. Setting to 1.")
            self.WORKERS = 1

        return True

settings = Settings()
