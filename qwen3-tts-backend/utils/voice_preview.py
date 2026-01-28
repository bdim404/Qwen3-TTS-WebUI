import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
from core.config import settings
from core.model_manager import ModelManager

logger = logging.getLogger(__name__)

PREVIEW_TEXTS = {
    "zh": "你好，我是人工智能语音助手，这是我的声音预览。",
    "en": "Hello, I am an AI voice assistant, this is my voice preview.",
    "ja": "こんにちは、私はAI音声アシスタントです。これは私の声のプレビューです。"
}

async def generate_preview_audio(
    voice_library_id: int,
    voice_type: str,
    voice_data: Dict[str, Any],
    language: str = "zh"
) -> str:
    output_dir = Path(settings.OUTPUT_DIR) / "voice-library"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"voice_{voice_library_id}_preview_{timestamp}.wav"
    output_path = output_dir / output_filename

    preview_text = PREVIEW_TEXTS.get(language, PREVIEW_TEXTS["zh"])

    model_manager = await ModelManager.get_instance()

    try:
        if voice_type == "custom_voice":
            speaker = voice_data.get("speaker", "Xiaoli")
            await model_manager.load_model("custom-voice")
            current_model, model_instance = await model_manager.get_current_model()

            audio_data = model_instance.inference(
                text=preview_text,
                speaker=speaker,
                language=language
            )

            import soundfile as sf
            sf.write(str(output_path), audio_data, 22050)

        elif voice_type == "voice_design":
            instruct = voice_data.get("instruct", "")
            await model_manager.load_model("voice-design")
            current_model, model_instance = await model_manager.get_current_model()

            audio_data = model_instance.inference(
                text=preview_text,
                instruct=instruct,
                language=language
            )

            import soundfile as sf
            sf.write(str(output_path), audio_data, 22050)

        elif voice_type == "voice_clone":
            voice_cache_id = voice_data.get("voice_cache_id")
            ref_text = voice_data.get("ref_text", "")

            from db.models import VoiceCache
            from core.database import SessionLocal

            db = SessionLocal()
            try:
                voice_cache = db.query(VoiceCache).filter(VoiceCache.id == voice_cache_id).first()
                if not voice_cache or not voice_cache.cache_path:
                    raise ValueError("Voice cache not found or cache not available")

                await model_manager.load_model("voice-clone")
                current_model, model_instance = await model_manager.get_current_model()

                audio_data = model_instance.inference(
                    text=preview_text,
                    ref_audio_path=voice_cache.cache_path,
                    ref_text=ref_text,
                    language=language
                )

                import soundfile as sf
                sf.write(str(output_path), audio_data, 22050)

            finally:
                db.close()

        logger.info(f"Generated preview audio for voice library {voice_library_id}: {output_path}")
        return str(output_path)

    except Exception as e:
        logger.error(f"Failed to generate preview audio for voice library {voice_library_id}: {e}")
        if output_path.exists():
            output_path.unlink()
        raise

def delete_preview_audio(preview_audio_path: Optional[str]) -> bool:
    if not preview_audio_path:
        return True

    try:
        audio_file = Path(preview_audio_path)
        if audio_file.exists():
            audio_file.unlink()
            logger.info(f"Deleted preview audio: {preview_audio_path}")
            return True
        else:
            logger.warning(f"Preview audio file not found: {preview_audio_path}")
            return False
    except Exception as e:
        logger.error(f"Failed to delete preview audio {preview_audio_path}: {e}")
        return False
