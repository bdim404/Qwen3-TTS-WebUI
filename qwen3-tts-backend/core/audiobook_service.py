import logging
import re
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from core.config import settings
from core.llm_service import LLMService
from db import crud
from db.models import AudiobookProject, AudiobookCharacter, User

logger = logging.getLogger(__name__)


def _get_llm_service(user: User) -> LLMService:
    from core.security import decrypt_api_key
    if not user.llm_api_key or not user.llm_base_url or not user.llm_model:
        raise ValueError("LLM config not set. Please configure LLM API key, base URL, and model.")
    api_key = decrypt_api_key(user.llm_api_key)
    if not api_key:
        raise ValueError("Failed to decrypt LLM API key.")
    return LLMService(base_url=user.llm_base_url, api_key=api_key, model=user.llm_model)


def _extract_epub_text(file_path: str) -> str:
    try:
        import ebooklib
        from ebooklib import epub
        from html.parser import HTMLParser

        class TextExtractor(HTMLParser):
            def __init__(self):
                super().__init__()
                self.parts = []
                self._skip = False

            def handle_starttag(self, tag, attrs):
                if tag in ("script", "style"):
                    self._skip = True

            def handle_endtag(self, tag):
                if tag in ("script", "style"):
                    self._skip = False

            def handle_data(self, data):
                if not self._skip:
                    text = data.strip()
                    if text:
                        self.parts.append(text)

        book = epub.read_epub(file_path)
        chapters = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            extractor = TextExtractor()
            extractor.feed(item.get_content().decode("utf-8", errors="ignore"))
            chapter_text = "\n".join(extractor.parts)
            if chapter_text.strip():
                chapters.append(chapter_text)
        return "\n\n".join(chapters)
    except ImportError:
        raise RuntimeError("ebooklib not installed. Run: pip install EbookLib")


def _split_into_chapters(text: str) -> list[str]:
    chapter_pattern = re.compile(r'(?:第[零一二三四五六七八九十百千\d]+[章节回]|Chapter\s+\d+)', re.IGNORECASE)
    matches = list(chapter_pattern.finditer(text))
    if not matches:
        return [text]
    chapters = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chapters.append(text[start:end])
    return chapters


async def analyze_project(project_id: int, user: User, db: Session) -> None:
    project = db.query(AudiobookProject).filter(AudiobookProject.id == project_id).first()
    if not project:
        return

    try:
        crud.update_audiobook_project_status(db, project_id, "analyzing")

        llm = _get_llm_service(user)

        if project.source_type == "epub" and project.source_path:
            text = _extract_epub_text(project.source_path)
            project.source_text = text
            db.commit()
        else:
            text = project.source_text or ""

        if not text.strip():
            raise ValueError("No text content found in project.")

        characters_data = await llm.extract_characters(text)

        has_narrator = any(c.get("name") == "narrator" for c in characters_data)
        if not has_narrator:
            characters_data.insert(0, {
                "name": "narrator",
                "description": "旁白叙述者",
                "instruct": "中性声音，语速平稳，叙述感强"
            })

        crud.delete_audiobook_segments(db, project_id)
        crud.delete_audiobook_characters(db, project_id)

        char_map: dict[str, AudiobookCharacter] = {}
        backend_type = user.user_preferences.get("default_backend", "aliyun") if user.user_preferences else "aliyun"

        for char_data in characters_data:
            name = char_data.get("name", "narrator")
            instruct = char_data.get("instruct", "")
            description = char_data.get("description", "")

            voice_design = crud.create_voice_design(
                db=db,
                user_id=user.id,
                name=f"[有声书] {project.title} - {name}",
                instruct=instruct,
                backend_type=backend_type,
                preview_text=description[:100] if description else None,
            )

            char = crud.create_audiobook_character(
                db=db,
                project_id=project_id,
                name=name,
                description=description,
                instruct=instruct,
                voice_design_id=voice_design.id,
            )
            char_map[name] = char

        chapters = _split_into_chapters(text)
        character_names = [c.get("name") for c in characters_data]

        for chapter_idx, chapter_text in enumerate(chapters):
            if not chapter_text.strip():
                continue
            segments_data = await llm.parse_chapter_segments(chapter_text, character_names)
            for seg_idx, seg in enumerate(segments_data):
                char_name = seg.get("character", "narrator")
                seg_text = seg.get("text", "").strip()
                if not seg_text:
                    continue
                char = char_map.get(char_name) or char_map.get("narrator")
                if char is None:
                    continue
                crud.create_audiobook_segment(
                    db=db,
                    project_id=project_id,
                    character_id=char.id,
                    text=seg_text,
                    chapter_index=chapter_idx,
                    segment_index=seg_idx,
                )

        crud.update_audiobook_project_status(db, project_id, "ready")
        logger.info(f"Project {project_id} analysis complete: {len(char_map)} characters, {len(chapters)} chapters")

    except Exception as e:
        logger.error(f"Analysis failed for project {project_id}: {e}", exc_info=True)
        crud.update_audiobook_project_status(db, project_id, "error", error_message=str(e))


async def generate_project(project_id: int, user: User, db: Session) -> None:
    project = db.query(AudiobookProject).filter(AudiobookProject.id == project_id).first()
    if not project:
        return

    try:
        crud.update_audiobook_project_status(db, project_id, "generating")

        segments = crud.list_audiobook_segments(db, project_id)
        if not segments:
            crud.update_audiobook_project_status(db, project_id, "done")
            return

        output_base = Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "segments"
        output_base.mkdir(parents=True, exist_ok=True)

        from core.tts_service import TTSServiceFactory
        from core.security import decrypt_api_key

        backend_type = user.user_preferences.get("default_backend", "aliyun") if user.user_preferences else "aliyun"

        user_api_key = None
        if backend_type == "aliyun" and user.aliyun_api_key:
            user_api_key = decrypt_api_key(user.aliyun_api_key)

        backend = await TTSServiceFactory.get_backend(backend_type, user_api_key)

        for seg in segments:
            try:
                crud.update_audiobook_segment_status(db, seg.id, "generating")

                char = crud.get_audiobook_character(db, seg.character_id)
                if not char or not char.voice_design_id:
                    crud.update_audiobook_segment_status(db, seg.id, "error")
                    continue

                design = crud.get_voice_design(db, char.voice_design_id, user.id)
                if not design:
                    crud.update_audiobook_segment_status(db, seg.id, "error")
                    continue

                audio_filename = f"ch{seg.chapter_index:03d}_seg{seg.segment_index:04d}.wav"
                audio_path = output_base / audio_filename

                if backend_type == "aliyun":
                    if design.aliyun_voice_id:
                        audio_bytes, _ = await backend.generate_voice_design(
                            {"text": seg.text, "language": "zh"},
                            saved_voice_id=design.aliyun_voice_id
                        )
                    else:
                        audio_bytes, _ = await backend.generate_voice_design({
                            "text": seg.text,
                            "language": "zh",
                            "instruct": design.instruct,
                        })
                else:
                    if design.voice_cache_id:
                        from core.cache_manager import VoiceCacheManager
                        cache_manager = await VoiceCacheManager.get_instance()
                        cache_result = await cache_manager.get_cache_by_id(design.voice_cache_id, db)
                        x_vector = cache_result['data'] if cache_result else None
                        if x_vector:
                            audio_bytes, _ = await backend.generate_voice_clone(
                                {
                                    "text": seg.text,
                                    "language": "Auto",
                                    "max_new_tokens": 2048,
                                    "temperature": 0.3,
                                    "top_k": 10,
                                    "top_p": 0.9,
                                    "repetition_penalty": 1.05,
                                },
                                x_vector=x_vector
                            )
                        else:
                            audio_bytes, _ = await backend.generate_voice_design({
                                "text": seg.text,
                                "language": "Auto",
                                "instruct": design.instruct,
                                "max_new_tokens": 2048,
                                "temperature": 0.3,
                                "top_k": 10,
                                "top_p": 0.9,
                                "repetition_penalty": 1.05,
                            })
                    else:
                        audio_bytes, _ = await backend.generate_voice_design({
                            "text": seg.text,
                            "language": "Auto",
                            "instruct": design.instruct,
                            "max_new_tokens": 2048,
                            "temperature": 0.3,
                            "top_k": 10,
                            "top_p": 0.9,
                            "repetition_penalty": 1.05,
                        })

                with open(audio_path, "wb") as f:
                    f.write(audio_bytes)

                crud.update_audiobook_segment_status(db, seg.id, "done", audio_path=str(audio_path))
                logger.info(f"Segment {seg.id} generated: {audio_path}")

            except Exception as e:
                logger.error(f"Segment {seg.id} generation failed: {e}", exc_info=True)
                crud.update_audiobook_segment_status(db, seg.id, "error")

        crud.update_audiobook_project_status(db, project_id, "done")
        logger.info(f"Project {project_id} generation complete")

    except Exception as e:
        logger.error(f"Generation failed for project {project_id}: {e}", exc_info=True)
        crud.update_audiobook_project_status(db, project_id, "error", error_message=str(e))


def merge_audio_files(audio_paths: list[str], output_path: str) -> None:
    from pydub import AudioSegment

    combined = None
    silence = AudioSegment.silent(duration=300)
    for path in audio_paths:
        if not Path(path).exists():
            continue
        seg = AudioSegment.from_file(path)
        combined = combined + silence + seg if combined else seg

    if combined:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        combined.export(output_path, format="mp3")
