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


def _extract_epub_chapters(file_path: str) -> list[str]:
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

        spine_ids = {item_id for item_id, _ in book.spine}
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            if item.id not in spine_ids:
                continue
            fname = (item.file_name or "").lower()
            if any(kw in fname for kw in ("nav", "toc", "cover", "title", "copyright")):
                continue
            extractor = TextExtractor()
            extractor.feed(item.get_content().decode("utf-8", errors="ignore"))
            text = "\n".join(extractor.parts).strip()
            if len(text) > 200:
                chapters.append(text)

        if not chapters:
            for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
                extractor = TextExtractor()
                extractor.feed(item.get_content().decode("utf-8", errors="ignore"))
                text = "\n".join(extractor.parts).strip()
                if len(text) > 200:
                    chapters.append(text)

        return chapters
    except ImportError:
        raise RuntimeError("ebooklib not installed. Run: pip install EbookLib")


def _chunk_chapter(text: str, max_chars: int = 4000) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    chunks = []
    while text:
        if len(text) <= max_chars:
            chunks.append(text)
            break
        break_at = max(
            text.rfind("。", 0, max_chars),
            text.rfind("\n", 0, max_chars),
        )
        if break_at <= 0:
            break_at = max_chars
        chunks.append(text[:break_at + 1])
        text = text[break_at + 1:]
    return chunks


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
            epub_chapters = _extract_epub_chapters(project.source_path)
            if not epub_chapters:
                raise ValueError("No text content extracted from epub.")
            text = "\n\n".join(epub_chapters)
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

            crud.create_audiobook_character(
                db=db,
                project_id=project_id,
                name=name,
                description=description,
                instruct=instruct,
                voice_design_id=voice_design.id,
            )

        crud.update_audiobook_project_status(db, project_id, "characters_ready")
        logger.info(f"Project {project_id} character extraction complete: {len(characters_data)} characters")

    except Exception as e:
        logger.error(f"Analysis failed for project {project_id}: {e}", exc_info=True)
        crud.update_audiobook_project_status(db, project_id, "error", error_message=str(e))


async def parse_chapters(project_id: int, user: User, db: Session) -> None:
    project = db.query(AudiobookProject).filter(AudiobookProject.id == project_id).first()
    if not project:
        return

    try:
        crud.update_audiobook_project_status(db, project_id, "parsing")

        llm = _get_llm_service(user)

        characters = crud.list_audiobook_characters(db, project_id)
        if not characters:
            raise ValueError("No characters found. Please analyze the project first.")

        char_map: dict[str, AudiobookCharacter] = {c.name: c for c in characters}
        character_names = list(char_map.keys())

        text = project.source_text or ""
        if not text.strip():
            raise ValueError("No text content found in project.")

        if project.source_type == "epub" and project.source_path:
            chapters = _extract_epub_chapters(project.source_path)
        else:
            chapters = _split_into_chapters(text)

        crud.delete_audiobook_segments(db, project_id)

        seg_counters: dict[int, int] = {}
        for chapter_idx, chapter_text in enumerate(chapters):
            if not chapter_text.strip():
                continue
            chunks = _chunk_chapter(chapter_text, max_chars=4000)
            logger.info(f"Chapter {chapter_idx}: {len(chapter_text)} chars → {len(chunks)} chunk(s)")
            for chunk in chunks:
                try:
                    segments_data = await llm.parse_chapter_segments(chunk, character_names)
                except Exception as e:
                    logger.warning(f"Chapter {chapter_idx} chunk LLM parse failed, fallback to narrator: {e}")
                    narrator = char_map.get("narrator")
                    if narrator:
                        idx = seg_counters.get(chapter_idx, 0)
                        crud.create_audiobook_segment(
                            db=db,
                            project_id=project_id,
                            character_id=narrator.id,
                            text=chunk.strip(),
                            chapter_index=chapter_idx,
                            segment_index=idx,
                        )
                        seg_counters[chapter_idx] = idx + 1
                    continue
                for seg in segments_data:
                    char_name = seg.get("character", "narrator")
                    seg_text = seg.get("text", "").strip()
                    if not seg_text:
                        continue
                    char = char_map.get(char_name) or char_map.get("narrator")
                    if char is None:
                        continue
                    idx = seg_counters.get(chapter_idx, 0)
                    crud.create_audiobook_segment(
                        db=db,
                        project_id=project_id,
                        character_id=char.id,
                        text=seg_text,
                        chapter_index=chapter_idx,
                        segment_index=idx,
                    )
                    seg_counters[chapter_idx] = idx + 1

        crud.update_audiobook_project_status(db, project_id, "ready")
        logger.info(f"Project {project_id} chapter parsing complete: {len(chapters)} chapters")

    except Exception as e:
        logger.error(f"Chapter parsing failed for project {project_id}: {e}", exc_info=True)
        crud.update_audiobook_project_status(db, project_id, "error", error_message=str(e))


async def _bootstrap_character_voices(segments, user, backend, backend_type: str, db: Session) -> None:
    bootstrapped: set[int] = set()

    for seg in segments:
        char = crud.get_audiobook_character(db, seg.character_id)
        if not char or not char.voice_design_id or char.voice_design_id in bootstrapped:
            continue
        bootstrapped.add(char.voice_design_id)

        design = crud.get_voice_design(db, char.voice_design_id, user.id)
        if not design:
            continue

        try:
            if backend_type == "local" and not design.voice_cache_id:
                from core.model_manager import ModelManager
                from core.cache_manager import VoiceCacheManager
                from utils.audio import process_ref_audio
                import hashlib

                ref_text = "你好，这是参考音频。"
                ref_audio_bytes, _ = await backend.generate_voice_design({
                    "text": ref_text,
                    "language": "Auto",
                    "instruct": design.instruct or "",
                    "max_new_tokens": 512,
                    "temperature": 0.3,
                    "top_k": 10,
                    "top_p": 0.9,
                    "repetition_penalty": 1.05,
                })

                model_manager = await ModelManager.get_instance()
                await model_manager.load_model("base")
                _, tts = await model_manager.get_current_model()

                ref_audio_array, ref_sr = process_ref_audio(ref_audio_bytes)
                x_vector = tts.create_voice_clone_prompt(
                    ref_audio=(ref_audio_array, ref_sr),
                    ref_text=ref_text,
                )

                cache_manager = await VoiceCacheManager.get_instance()
                ref_audio_hash = hashlib.sha256(ref_audio_bytes).hexdigest()
                cache_id = await cache_manager.set_cache(
                    user.id, ref_audio_hash, x_vector,
                    {"ref_text": ref_text, "instruct": design.instruct},
                    db
                )
                design.voice_cache_id = cache_id
                db.commit()
                logger.info(f"Bootstrapped local voice cache: design_id={design.id}, cache_id={cache_id}")

            elif backend_type == "aliyun" and not design.aliyun_voice_id:
                from core.tts_service import AliyunTTSBackend
                if isinstance(backend, AliyunTTSBackend):
                    voice_id = await backend._create_voice_design(
                        instruct=design.instruct or "",
                        preview_text="你好，这是参考音频。"
                    )
                    design.aliyun_voice_id = voice_id
                    db.commit()
                    logger.info(f"Bootstrapped aliyun voice_id: design_id={design.id}, voice_id={voice_id}")

        except Exception as e:
            logger.error(f"Failed to bootstrap voice for design_id={design.id}: {e}", exc_info=True)


async def generate_project(project_id: int, user: User, db: Session, chapter_index: Optional[int] = None) -> None:
    project = db.query(AudiobookProject).filter(AudiobookProject.id == project_id).first()
    if not project:
        return

    try:
        if chapter_index is None:
            crud.update_audiobook_project_status(db, project_id, "generating")

        segments = crud.list_audiobook_segments(db, project_id, chapter_index=chapter_index)
        pending_segments = [s for s in segments if s.status in ("pending", "error")]
        if not pending_segments:
            if chapter_index is None:
                all_segs = crud.list_audiobook_segments(db, project_id)
                if all_segs and all(s.status == "done" for s in all_segs):
                    crud.update_audiobook_project_status(db, project_id, "done")
                else:
                    crud.update_audiobook_project_status(db, project_id, "ready")
            return
        segments = pending_segments

        output_base = Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "segments"
        output_base.mkdir(parents=True, exist_ok=True)

        from core.tts_service import TTSServiceFactory
        from core.security import decrypt_api_key

        backend_type = user.user_preferences.get("default_backend", "aliyun") if user.user_preferences else "aliyun"

        user_api_key = None
        if backend_type == "aliyun" and user.aliyun_api_key:
            user_api_key = decrypt_api_key(user.aliyun_api_key)

        backend = await TTSServiceFactory.get_backend(backend_type, user_api_key)

        await _bootstrap_character_voices(segments, user, backend, backend_type, db)

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

        all_segs = crud.list_audiobook_segments(db, project_id)
        all_done = all(s.status == "done" for s in all_segs) if all_segs else False
        if all_done:
            crud.update_audiobook_project_status(db, project_id, "done")
        elif chapter_index is None:
            crud.update_audiobook_project_status(db, project_id, "ready")
        logger.info(f"Project {project_id} generation complete (chapter={chapter_index})")

    except Exception as e:
        logger.error(f"Generation failed for project {project_id}: {e}", exc_info=True)
        if chapter_index is None:
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
