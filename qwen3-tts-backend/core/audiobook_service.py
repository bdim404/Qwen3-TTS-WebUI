import asyncio
import logging
import re
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from core.config import settings
from core.llm_service import LLMService
from core import progress_store as ps
from db import crud
from db.models import AudiobookProject, AudiobookCharacter, User

logger = logging.getLogger(__name__)

# Cancellation events for batch operations, keyed by project_id
_cancel_events: dict[int, asyncio.Event] = {}


def cancel_batch(project_id: int) -> None:
    """Signal cancellation for any running batch operation on this project."""
    ev = _cancel_events.get(project_id)
    if ev:
        ev.set()
        logger.info(f"cancel_batch: project={project_id} cancellation signalled")


def _get_llm_service(user: User) -> LLMService:
    from core.security import decrypt_api_key
    if not user.llm_api_key or not user.llm_base_url or not user.llm_model:
        raise ValueError("LLM config not set. Please configure LLM API key, base URL, and model.")
    api_key = decrypt_api_key(user.llm_api_key)
    if not api_key:
        raise ValueError("Failed to decrypt LLM API key.")
    return LLMService(base_url=user.llm_base_url, api_key=api_key, model=user.llm_model)


def _get_gendered_instruct(gender: Optional[str], base_instruct: str) -> str:
    """Ensure the instruction sent to the TTS model has explicit gender cues if known."""
    if not gender or gender == "未知":
        return base_instruct
    
    # We want to force a clear gender bias at the start of the prompt
    prefix = ""
    if gender == "男":
        prefix = "男性声音，"
    elif gender == "女":
        prefix = "女性声音，"
    
    if prefix and prefix not in base_instruct:
        # Prepend prefix, but try to be smart if the first line starts with "音色信息："
        if base_instruct.startswith("音色信息："):
            return base_instruct.replace("音色信息：", f"音色信息：{prefix}", 1)
        return f"{prefix}{base_instruct}"
    return base_instruct


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


def _sample_full_text(text: str, n_samples: int = 8, sample_size: int = 3000) -> list[str]:
    if len(text) <= 30000:
        return [text]
    segment_size = len(text) // n_samples
    samples = []
    for i in range(n_samples):
        start = i * segment_size
        boundary = text.find("。", start, start + 200)
        actual_start = boundary + 1 if boundary != -1 else start
        samples.append(text[actual_start:actual_start + sample_size])
    return samples


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


async def analyze_project(project_id: int, user: User, db: Session, turbo: bool = False) -> None:
    project = db.query(AudiobookProject).filter(AudiobookProject.id == project_id).first()
    if not project:
        return

    key = str(project_id)
    ps.reset(key)
    try:
        crud.update_audiobook_project_status(db, project_id, "analyzing")
        ps.append_line(key, f"[分析] 项目「{project.title}」开始角色分析")

        llm = _get_llm_service(user)

        if project.source_type == "epub" and project.source_path:
            ps.append_line(key, "[解析] 正在提取 EPUB 章节内容...")
            epub_chapters = _extract_epub_chapters(project.source_path)
            if not epub_chapters:
                raise ValueError("No text content extracted from epub.")
            text = "\n\n".join(epub_chapters)
            ps.append_line(key, f"[解析] 提取完成，共 {len(epub_chapters)} 章，{len(text)} 字")
            project.source_text = text
            db.commit()
        else:
            text = project.source_text or ""

        if not text.strip():
            raise ValueError("No text content found in project.")

        samples = _sample_full_text(text)
        n = len(samples)
        
        # Ensure previews directory is clean for new analysis
        previews_dir = Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "previews"
        if previews_dir.exists():
            import shutil
            try:
                shutil.rmtree(previews_dir)
            except Exception as e:
                logger.warning(f"Failed to clear previews directory: {e}")
        previews_dir.mkdir(parents=True, exist_ok=True)

        mode_label = "极速并发" if turbo else "顺序"
        ps.append_line(key, f"\n[LLM] 模型：{user.llm_model}，共 {n} 个采样段（{mode_label}模式），正在分析角色...\n")
        ps.append_line(key, "")

        def on_token(token: str) -> None:
            ps.append_token(key, token)

        completed_count = 0
        def on_sample(i: int, total: int) -> None:
            nonlocal completed_count
            completed_count += 1
            if completed_count < total:
                ps.append_line(key, f"\n[LLM] 采样段 {completed_count}/{total} 完成，继续分析...\n")
            else:
                ps.append_line(key, f"\n[LLM] 全部 {total} 个采样段完成，正在合并角色列表...\n")
            ps.append_line(key, "")

        characters_data = await llm.extract_characters(
            samples,
            on_token=on_token,
            on_sample=on_sample,
            turbo=turbo,
        )

        has_narrator = any(c.get("name") == "narrator" for c in characters_data)
        if not has_narrator:
            characters_data.insert(0, {
                "name": "narrator",
                "description": "旁白叙述者",
                "instruct": "中性声音，语速平稳，叙述感强"
            })

        ps.append_line(key, f"\n\n[完成] 发现 {len(characters_data)} 个角色：{', '.join(c.get('name', '') for c in characters_data)}")

        crud.delete_audiobook_segments(db, project_id)
        crud.delete_audiobook_characters(db, project_id)

        backend_type = user.user_preferences.get("default_backend", "aliyun") if user.user_preferences else "aliyun"

        for char_data in characters_data:
            name = char_data.get("name", "narrator")
            instruct = char_data.get("instruct", "")
            description = char_data.get("description", "")
            gender = char_data.get("gender") or ("未知" if name == "narrator" else None)
            try:
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
                    gender=gender,
                    description=description,
                    instruct=instruct,
                    voice_design_id=voice_design.id,
                )
            except Exception as e:
                logger.error(f"Failed to create char/voice for {name}: {e}")

        crud.update_audiobook_project_status(db, project_id, "characters_ready")
        ps.mark_done(key)
        logger.info(f"Project {project_id} character extraction complete: {len(characters_data)} characters")

        # Kick off background preview generation
        import asyncio
        from core.database import SessionLocal
        
        user_id = user.id

        async def _generate_all_previews():
            # Get character IDs first using a temporary session
            temp_db = SessionLocal()
            try:
                characters = crud.list_audiobook_characters(temp_db, project_id)
                char_ids = [c.id for c in characters]
            finally:
                temp_db.close()
            
            if not char_ids:
                return

            # Use a semaphore to limit concurrent TTS requests
            sem = asyncio.Semaphore(3)
            
            async def _gen(char_id: int):
                async with sem:
                    # Each concurrent task MUST have its own dedicated session
                    local_db = SessionLocal()
                    try:
                        db_user = crud.get_user_by_id(local_db, user_id)
                        await generate_character_preview(project_id, char_id, db_user, local_db)
                    except Exception as e:
                        logger.error(f"Background preview generation failed for char {char_id}: {e}")
                    finally:
                        local_db.close()
            
            tasks = [_gen(cid) for cid in char_ids]
            await asyncio.gather(*tasks)
                
        asyncio.create_task(_generate_all_previews())

    except Exception as e:
        logger.error(f"Analysis failed for project {project_id}: {e}", exc_info=True)
        ps.append_line(key, f"\n[错误] {e}")
        ps.mark_done(key)
        crud.update_audiobook_project_status(db, project_id, "error", error_message=str(e))


def _get_chapter_title(text: str) -> str:
    first_line = text.strip().split('\n')[0].strip()
    return first_line[:80] if len(first_line) <= 80 else first_line[:77] + '...'


def identify_chapters(project_id: int, db, project) -> None:
    if project.source_type == "epub" and project.source_path:
        texts = _extract_epub_chapters(project.source_path)
    else:
        texts = _split_into_chapters(project.source_text or "")

    crud.delete_audiobook_chapters(db, project_id)
    crud.delete_audiobook_segments(db, project_id)

    real_idx = 0
    for text in texts:
        if text.strip():
            crud.create_audiobook_chapter(
                db, project_id, real_idx, text.strip(),
                title=_get_chapter_title(text),
            )
            real_idx += 1

    crud.update_audiobook_project_status(db, project_id, "ready")
    logger.info(f"Project {project_id} chapters identified: {real_idx} chapters")


async def parse_one_chapter(project_id: int, chapter_id: int, user: User, db) -> None:
    chapter = crud.get_audiobook_chapter(db, chapter_id)
    if not chapter:
        return

    key = f"ch_{chapter_id}"
    ps.reset(key)
    try:
        crud.update_audiobook_chapter_status(db, chapter_id, "parsing")

        llm = _get_llm_service(user)
        characters = crud.list_audiobook_characters(db, project_id)
        if not characters:
            raise ValueError("No characters found. Please analyze the project first.")

        char_map: dict[str, AudiobookCharacter] = {c.name: c for c in characters}
        character_names = list(char_map.keys())

        label = chapter.title or f"第 {chapter.chapter_index + 1} 章"
        ps.append_line(key, f"[{label}] 开始解析 ({len(chapter.source_text)} 字)")

        crud.delete_audiobook_segments_for_chapter(db, project_id, chapter.chapter_index)

        chunks = _chunk_chapter(chapter.source_text, max_chars=4000)
        ps.append_line(key, f"共 {len(chunks)} 块\n")

        seg_counter = 0
        failed_chunks = 0
        last_error = ""
        for i, chunk in enumerate(chunks):
            ps.append_line(key, f"块 {i + 1}/{len(chunks)} → ")
            ps.append_line(key, "")

            def on_token(token: str) -> None:
                ps.append_token(key, token)

            try:
                segments_data = await llm.parse_chapter_segments(chunk, character_names, on_token=on_token)
            except Exception as e:
                logger.warning(f"Chapter {chapter_id} chunk {i} failed: {e}")
                ps.append_line(key, f"\n[回退] {e}")
                failed_chunks += 1
                last_error = str(e)
                narrator = char_map.get("narrator")
                if narrator:
                    crud.create_audiobook_segment(
                        db, project_id, narrator.id, chunk.strip(),
                        chapter.chapter_index, seg_counter,
                    )
                    seg_counter += 1
                continue

            chunk_count = 0
            for seg in segments_data:
                seg_text = seg.get("text", "").strip()
                if not seg_text:
                    continue
                char = char_map.get(seg.get("character", "narrator")) or char_map.get("narrator")
                if not char:
                    continue
                crud.create_audiobook_segment(
                    db, project_id, char.id, seg_text,
                    chapter.chapter_index, seg_counter,
                )
                seg_counter += 1
                chunk_count += 1

            ps.append_line(key, f"\n✓ {chunk_count} 段")

        if failed_chunks == len(chunks):
            # All chunks failed — mark chapter as error, remove fallback segments
            crud.delete_audiobook_segments_for_chapter(db, project_id, chapter.chapter_index)
            error_msg = f"所有 {len(chunks)} 个块均解析失败: {last_error}"
            ps.append_line(key, f"\n[错误] {error_msg}")
            crud.update_audiobook_chapter_status(db, chapter_id, "error", error_message=error_msg)
        elif failed_chunks > 0:
            ps.append_line(key, f"\n[完成] 共 {seg_counter} 段（{failed_chunks}/{len(chunks)} 块回退到旁白）")
            crud.update_audiobook_chapter_status(db, chapter_id, "ready")
        else:
            ps.append_line(key, f"\n[完成] 共 {seg_counter} 段")
            crud.update_audiobook_chapter_status(db, chapter_id, "ready")
        ps.mark_done(key)
        logger.info(f"Chapter {chapter_id} parsed: {seg_counter} segments")

    except Exception as e:
        logger.error(f"parse_one_chapter {chapter_id} failed: {e}", exc_info=True)
        ps.append_line(key, f"\n[错误] {e}")
        ps.mark_done(key)
        crud.update_audiobook_chapter_status(db, chapter_id, "error", error_message=str(e))


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
                            "instruct": _get_gendered_instruct(char.gender, design.instruct),
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
                                "instruct": _get_gendered_instruct(char.gender, design.instruct),
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
                            "instruct": _get_gendered_instruct(char.gender, design.instruct),
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
        combined.export(output_path, format="wav")


async def parse_all_chapters(project_id: int, user: User, db: Session, statuses: tuple = ("pending", "error", "ready")) -> None:
    """Concurrently parse chapters with matching statuses using asyncio.Semaphore."""
    from core.database import SessionLocal

    chapters = crud.list_audiobook_chapters(db, project_id)
    pending = [ch for ch in chapters if ch.status in statuses]
    if not pending:
        return

    cancel_ev = asyncio.Event()
    _cancel_events[project_id] = cancel_ev

    max_concurrent = settings.AUDIOBOOK_PARSE_CONCURRENCY
    semaphore = asyncio.Semaphore(max_concurrent)
    logger.info(f"parse_all_chapters: project={project_id}, {len(pending)} chapters, concurrency={max_concurrent}")
    
    key = f"project_{project_id}"
    ps.append_line(key, f"\n[状态] 开启章节并发解析，共 {len(pending)} 章待处理，最大并发: {max_concurrent}...\n")

    async def parse_with_limit(chapter):
        if cancel_ev.is_set():
            return
        async with semaphore:
            if cancel_ev.is_set():
                return
            task_db = SessionLocal()
            try:
                db_user = crud.get_user_by_id(task_db, user.id)
                await parse_one_chapter(project_id, chapter.id, db_user, task_db)
            except Exception as e:
                logger.error(f"parse_all_chapters: chapter {chapter.id} failed: {e}", exc_info=True)
            finally:
                task_db.close()

    await asyncio.gather(*[parse_with_limit(ch) for ch in pending])
    _cancel_events.pop(project_id, None)
    
    if cancel_ev.is_set():
        ps.append_line(key, f"\n[状态] 章节批量解析被用户取消\n")
    else:
        ps.append_line(key, f"\n[状态] 所有章节批量解析已完成\n")
        
    logger.info(f"parse_all_chapters: project={project_id} {'cancelled' if cancel_ev.is_set() else 'complete'}")


async def generate_all_chapters(project_id: int, user: User, db: Session) -> None:
    """Concurrently generate audio for all ready chapters using asyncio.Semaphore."""
    from core.database import SessionLocal

    chapters = crud.list_audiobook_chapters(db, project_id)
    ready = [ch for ch in chapters if ch.status == "ready"]
    if not ready:
        return

    cancel_ev = _cancel_events.get(project_id)
    if not cancel_ev:
        cancel_ev = asyncio.Event()
        _cancel_events[project_id] = cancel_ev

    crud.update_audiobook_project_status(db, project_id, "generating")

    max_concurrent = settings.AUDIOBOOK_GENERATE_CONCURRENCY
    semaphore = asyncio.Semaphore(max_concurrent)
    logger.info(f"generate_all_chapters: project={project_id}, {len(ready)} chapters, concurrency={max_concurrent}")

    async def generate_with_limit(chapter):
        if cancel_ev.is_set():
            return
        async with semaphore:
            if cancel_ev.is_set():
                return
            task_db = SessionLocal()
            try:
                db_user = crud.get_user_by_id(task_db, user.id)
                await generate_project(project_id, db_user, task_db, chapter_index=chapter.chapter_index)
            except Exception as e:
                logger.error(f"generate_all_chapters: chapter {chapter.chapter_index} failed: {e}", exc_info=True)
            finally:
                task_db.close()

    await asyncio.gather(*[generate_with_limit(ch) for ch in ready])

    # Check final project status
    final_db = SessionLocal()
    try:
        all_segs = crud.list_audiobook_segments(final_db, project_id)
        all_done = all(s.status == "done" for s in all_segs) if all_segs else False
        if all_done:
            crud.update_audiobook_project_status(final_db, project_id, "done")
        else:
            crud.update_audiobook_project_status(final_db, project_id, "ready")
    finally:
        final_db.close()

    _cancel_events.pop(project_id, None)
    logger.info(f"generate_all_chapters: project={project_id} {'cancelled' if cancel_ev.is_set() else 'complete'}")


async def process_all(project_id: int, user: User, db: Session) -> None:
    """Parse all pending chapters, then generate all ready chapters — both with concurrency."""
    from core.database import SessionLocal

    # Phase 1: parse all pending chapters concurrently
    await parse_all_chapters(project_id, user, db)

    # Phase 2: reload chapters and generate all ready ones concurrently
    phase2_db = SessionLocal()
    try:
        await generate_all_chapters(project_id, user, phase2_db)
    finally:
        phase2_db.close()

    logger.info(f"process_all: project={project_id} complete")


async def generate_character_preview(project_id: int, char_id: int, user: User, db: Session) -> None:
    """Generate a short audio preview for a specific character."""
    project = crud.get_audiobook_project(db, project_id, user.id)
    if not project:
        raise ValueError("Project not found")

    char = crud.get_audiobook_character(db, char_id)
    if not char or char.project_id != project_id:
        raise ValueError("Character not found or doesn't belong to this project")

    if not char.voice_design_id:
        raise ValueError("Character has no associated voice design")

    design = crud.get_voice_design(db, char.voice_design_id, user.id)
    if not design:
        raise ValueError("Voice design not found")

    output_base = Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "previews"
    output_base.mkdir(parents=True, exist_ok=True)
    audio_path = output_base / f"char_{char_id}.wav"

    preview_name = char.name
    if preview_name == "narrator":
        preview_name = "旁白"
        
    preview_desc = ""
    if char.description:
        # Take a short snippet of description to make it sound natural
        preview_desc = "，" + char.description[:30].replace('\n', '，')
        if not preview_desc.endswith('。') and not preview_desc.endswith('！'):
            preview_desc += "。"

    preview_text = f"你好，我是{preview_name}{preview_desc}"

    from core.tts_service import TTSServiceFactory
    from core.security import decrypt_api_key

    backend_type = user.user_preferences.get("default_backend", "aliyun") if user.user_preferences else "aliyun"
    user_api_key = None
    if backend_type == "aliyun" and user.aliyun_api_key:
        user_api_key = decrypt_api_key(user.aliyun_api_key)

    backend = await TTSServiceFactory.get_backend(backend_type, user_api_key)

    try:
        if backend_type == "local" and not design.voice_cache_id:
            logger.info(f"Local voice cache missing for char {char_id}. Bootstrapping now...")
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
            logger.info(f"Bootstrapped local voice cache for preview: design_id={design.id}, cache_id={cache_id}")

        if backend_type == "aliyun" and not design.aliyun_voice_id:
            from core.tts_service import AliyunTTSBackend
            if isinstance(backend, AliyunTTSBackend):
                try:
                    voice_id = await backend._create_voice_design(
                        instruct=_get_gendered_instruct(char.gender, design.instruct),
                        preview_text=preview_text,
                    )
                    design.aliyun_voice_id = voice_id
                    db.commit()
                    logger.info(f"Bootstrapped aliyun voice_id for preview: design_id={design.id}, voice_id={voice_id}")
                except Exception as e:
                    logger.warning(f"Failed to bootstrap aliyun voice_id for preview, falling back to instruct: {e}")

        if backend_type == "aliyun":
            if design.aliyun_voice_id:
                audio_bytes, _ = await backend.generate_voice_design(
                    {"text": preview_text, "language": "zh"},
                    saved_voice_id=design.aliyun_voice_id
                )
            else:
                audio_bytes, _ = await backend.generate_voice_design({
                    "text": preview_text,
                    "language": "zh",
                    "instruct": _get_gendered_instruct(char.gender, design.instruct),
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
                            "text": preview_text,
                            "language": "Auto",
                            "max_new_tokens": 512,
                            "temperature": 0.3,
                            "top_k": 10,
                            "top_p": 0.9,
                            "repetition_penalty": 1.05,
                        },
                        x_vector=x_vector
                    )
                else:
                    audio_bytes, _ = await backend.generate_voice_design({
                        "text": preview_text,
                        "language": "Auto",
                        "instruct": _get_gendered_instruct(char.gender, design.instruct),
                        "max_new_tokens": 512,
                        "temperature": 0.3,
                        "top_k": 10,
                        "top_p": 0.9,
                        "repetition_penalty": 1.05,
                    })
            else:
                audio_bytes, _ = await backend.generate_voice_design({
                    "text": preview_text,
                    "language": "Auto",
                    "instruct": design.instruct,
                    "max_new_tokens": 512,
                    "temperature": 0.3,
                    "top_k": 10,
                    "top_p": 0.9,
                    "repetition_penalty": 1.05,
                })

        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
            
        logger.info(f"Preview generated for char {char_id}: {audio_path}")
    except Exception as e:
        logger.error(f"Failed to generate preview for char {char_id}: {e}")
        raise
