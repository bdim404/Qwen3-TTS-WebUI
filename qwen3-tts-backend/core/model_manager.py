import asyncio
import logging
from typing import Optional
import torch
from qwen_tts import Qwen3TTSModel
from core.config import settings

logger = logging.getLogger(__name__)


class ModelManager:
    _instance: Optional['ModelManager'] = None
    _lock = asyncio.Lock()

    MODEL_PATHS = {
        "custom-voice": "Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "voice-design": "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        "base": "Qwen3-TTS-12Hz-1.7B-Base"
    }

    def __init__(self):
        if ModelManager._instance is not None:
            raise RuntimeError("Use get_instance() to get ModelManager")
        self.current_model_name: Optional[str] = None
        self.tts: Optional[Qwen3TTSModel] = None

    @classmethod
    async def get_instance(cls) -> 'ModelManager':
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def load_model(self, model_name: str) -> None:
        if model_name not in self.MODEL_PATHS:
            raise ValueError(
                f"Unknown model: {model_name}. "
                f"Available models: {list(self.MODEL_PATHS.keys())}"
            )

        if self.current_model_name == model_name and self.tts is not None:
            logger.info(f"Model {model_name} already loaded")
            return

        async with self._lock:
            logger.info(f"Loading model: {model_name}")

            if self.tts is not None:
                logger.info(f"Unloading current model: {self.current_model_name}")
                await self._unload_model_internal()

            from pathlib import Path
            model_base_path = Path(settings.MODEL_BASE_PATH)
            local_model_path = model_base_path / self.MODEL_PATHS[model_name]

            if local_model_path.exists():
                model_path = str(local_model_path)
                logger.info(f"Using local model: {model_path}")
            else:
                model_path = f"Qwen/{self.MODEL_PATHS[model_name]}"
                logger.info(f"Local path not found, using HuggingFace: {model_path}")

            try:
                self.tts = Qwen3TTSModel.from_pretrained(
                    str(model_path),
                    device_map=settings.MODEL_DEVICE,
                    torch_dtype=torch.bfloat16
                )
                self.current_model_name = model_name
                logger.info(f"Successfully loaded model: {model_name}")

                if torch.cuda.is_available():
                    allocated = torch.cuda.memory_allocated(0) / 1024**3
                    logger.info(f"GPU memory allocated: {allocated:.2f} GB")

            except Exception as e:
                logger.error(f"Failed to load model {model_name}: {e}")
                self.tts = None
                self.current_model_name = None
                raise

    async def get_current_model(self) -> tuple[Optional[str], Optional[Qwen3TTSModel]]:
        return self.current_model_name, self.tts

    async def unload_model(self) -> None:
        async with self._lock:
            await self._unload_model_internal()

    async def _unload_model_internal(self) -> None:
        if self.tts is not None:
            logger.info(f"Unloading model: {self.current_model_name}")
            del self.tts
            self.tts = None
            self.current_model_name = None

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache")

    async def get_memory_usage(self) -> dict:
        memory_info = {
            "gpu_available": torch.cuda.is_available(),
            "current_model": self.current_model_name
        }

        if torch.cuda.is_available():
            memory_info.update({
                "allocated_gb": torch.cuda.memory_allocated(0) / 1024**3,
                "reserved_gb": torch.cuda.memory_reserved(0) / 1024**3,
                "total_gb": torch.cuda.get_device_properties(0).total_memory / 1024**3
            })

        return memory_info

    def get_model_info(self) -> dict:
        return {
            name: {
                "path": path,
                "loaded": name == self.current_model_name
            }
            for name, path in self.MODEL_PATHS.items()
        }
