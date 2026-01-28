import os
from pathlib import Path
from core.config import settings

def cleanup_dialogue_audio(dialogue_id: int):
    output_dir = Path(settings.OUTPUT_DIR) / "dialogues" / str(dialogue_id)
    if output_dir.exists():
        import shutil
        shutil.rmtree(output_dir)

def cleanup_line_audio(line_id: int, audio_path: str = None):
    if audio_path and os.path.exists(audio_path):
        os.remove(audio_path)
