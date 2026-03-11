import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from api.auth import get_current_user
from core.database import get_db
from db import crud
from db.models import User, AudiobookSegment
from schemas.audiobook import (
    AudiobookProjectCreate,
    AudiobookProjectResponse,
    AudiobookProjectDetail,
    AudiobookCharacterResponse,
    AudiobookChapterResponse,
    AudiobookCharacterEdit,
    AudiobookSegmentResponse,
    AudiobookGenerateRequest,
    AudiobookAnalyzeRequest,
)
from core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audiobook", tags=["audiobook"])


def _project_to_response(project) -> AudiobookProjectResponse:
    return AudiobookProjectResponse(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        source_type=project.source_type,
        status=project.status,
        llm_model=project.llm_model,
        error_message=project.error_message,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _project_to_detail(project, db: Session) -> AudiobookProjectDetail:
    characters = [
        AudiobookCharacterResponse(
            id=c.id,
            project_id=c.project_id,
            name=c.name,
            description=c.description,
            instruct=c.instruct,
            voice_design_id=c.voice_design_id,
        )
        for c in (project.characters or [])
    ]
    chapters = [
        AudiobookChapterResponse(
            id=ch.id,
            project_id=ch.project_id,
            chapter_index=ch.chapter_index,
            title=ch.title,
            status=ch.status,
            error_message=ch.error_message,
        )
        for ch in (project.chapters or [])
    ]
    return AudiobookProjectDetail(
        id=project.id,
        user_id=project.user_id,
        title=project.title,
        source_type=project.source_type,
        status=project.status,
        llm_model=project.llm_model,
        error_message=project.error_message,
        created_at=project.created_at,
        updated_at=project.updated_at,
        characters=characters,
        chapters=chapters,
    )


@router.post("/projects", response_model=AudiobookProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: AudiobookProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.source_type not in ("text", "epub"):
        raise HTTPException(status_code=400, detail="source_type must be 'text' or 'epub'")
    if data.source_type == "text" and not data.source_text:
        raise HTTPException(status_code=400, detail="source_text required for text type")

    project = crud.create_audiobook_project(
        db=db,
        user_id=current_user.id,
        title=data.title,
        source_type=data.source_type,
        source_text=data.source_text,
        llm_model=current_user.llm_model,
    )
    return _project_to_response(project)


@router.post("/projects/upload", response_model=AudiobookProjectResponse, status_code=status.HTTP_201_CREATED)
async def upload_epub_project(
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".epub"):
        raise HTTPException(status_code=400, detail="Only .epub files are supported")

    upload_dir = Path(settings.OUTPUT_DIR) / "audiobook" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._-")
    file_path = upload_dir / f"{ts}_{safe_name}"

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    project = crud.create_audiobook_project(
        db=db,
        user_id=current_user.id,
        title=title,
        source_type="epub",
        source_path=str(file_path),
        llm_model=current_user.llm_model,
    )
    return _project_to_response(project)


@router.get("/projects", response_model=list[AudiobookProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = crud.list_audiobook_projects(db, current_user.id, skip=skip, limit=limit)
    return [_project_to_response(p) for p in projects]


@router.get("/projects/{project_id}", response_model=AudiobookProjectDetail)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_detail(project, db)


@router.post("/projects/{project_id}/analyze")
async def analyze_project(
    project_id: int,
    data: AudiobookAnalyzeRequest = AudiobookAnalyzeRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status in ("analyzing", "generating", "parsing"):
        raise HTTPException(status_code=400, detail=f"Project is currently {project.status}, please wait")

    if not current_user.llm_api_key or not current_user.llm_base_url or not current_user.llm_model:
        raise HTTPException(status_code=400, detail="LLM config not set. Please configure LLM API key first.")

    from core.audiobook_service import analyze_project as _analyze
    from core.database import SessionLocal

    turbo = data.turbo

    async def run_analysis():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await _analyze(project_id, db_user, async_db, turbo=turbo)
        finally:
            async_db.close()

    asyncio.create_task(run_analysis())
    return {"message": "Analysis started", "project_id": project_id, "turbo": turbo}


@router.post("/projects/{project_id}/confirm")
async def confirm_characters(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != "characters_ready":
        raise HTTPException(status_code=400, detail="Project must be in 'characters_ready' state to confirm characters")

    from core.audiobook_service import identify_chapters
    try:
        identify_chapters(project_id, db, project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Chapters identified", "project_id": project_id}


@router.get("/projects/{project_id}/chapters", response_model=list[AudiobookChapterResponse])
async def list_chapters(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    chapters = crud.list_audiobook_chapters(db, project_id)
    return [
        AudiobookChapterResponse(
            id=ch.id, project_id=ch.project_id, chapter_index=ch.chapter_index,
            title=ch.title, status=ch.status, error_message=ch.error_message,
        )
        for ch in chapters
    ]


@router.post("/projects/{project_id}/chapters/{chapter_id}/parse")
async def parse_chapter(
    project_id: int,
    chapter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chapter = crud.get_audiobook_chapter(db, chapter_id)
    if not chapter or chapter.project_id != project_id:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if chapter.status == "parsing":
        raise HTTPException(status_code=400, detail="Chapter is already being parsed")

    if not current_user.llm_api_key or not current_user.llm_base_url or not current_user.llm_model:
        raise HTTPException(status_code=400, detail="LLM config not set")

    from core.audiobook_service import parse_one_chapter
    from core.database import SessionLocal

    async def run():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await parse_one_chapter(project_id, chapter_id, db_user, async_db)
        finally:
            async_db.close()

    asyncio.create_task(run())
    return {"message": "Parsing started", "chapter_id": chapter_id}


@router.post("/projects/{project_id}/parse-all")
async def parse_all_chapters_endpoint(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status not in ("ready", "done", "error"):
        raise HTTPException(status_code=400, detail=f"Project must be in 'ready' state, current: {project.status}")

    if not current_user.llm_api_key or not current_user.llm_base_url or not current_user.llm_model:
        raise HTTPException(status_code=400, detail="LLM config not set")

    from core.audiobook_service import parse_all_chapters
    from core.database import SessionLocal

    async def run():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await parse_all_chapters(project_id, db_user, async_db)
        finally:
            async_db.close()

    asyncio.create_task(run())
    return {"message": "Batch parsing started", "project_id": project_id}


@router.post("/projects/{project_id}/process-all")
async def process_all_endpoint(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status not in ("ready", "generating", "done", "error"):
        raise HTTPException(status_code=400, detail=f"Project must be in 'ready' state, current: {project.status}")

    if not current_user.llm_api_key or not current_user.llm_base_url or not current_user.llm_model:
        raise HTTPException(status_code=400, detail="LLM config not set")

    from core.audiobook_service import process_all
    from core.database import SessionLocal

    async def run():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await process_all(project_id, db_user, async_db)
        finally:
            async_db.close()

    asyncio.create_task(run())
    return {"message": "Full processing started", "project_id": project_id}


@router.post("/projects/{project_id}/cancel-batch")
async def cancel_batch_endpoint(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from core.audiobook_service import cancel_batch
    cancel_batch(project_id)
    return {"message": "Cancellation signalled", "project_id": project_id}


@router.put("/projects/{project_id}/characters/{char_id}", response_model=AudiobookCharacterResponse)
async def update_character(
    project_id: int,
    char_id: int,
    data: AudiobookCharacterEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    char = crud.get_audiobook_character(db, char_id)
    if not char or char.project_id != project_id:
        raise HTTPException(status_code=404, detail="Character not found")

    if data.voice_design_id is not None:
        voice_design = crud.get_voice_design(db, data.voice_design_id, current_user.id)
        if not voice_design:
            raise HTTPException(status_code=404, detail="Voice design not found")

    char = crud.update_audiobook_character(
        db, char_id,
        name=data.name,
        gender=data.gender,
        description=data.description,
        instruct=data.instruct,
        voice_design_id=data.voice_design_id,
    )

    if data.instruct is not None and char.voice_design_id:
        voice_design = crud.get_voice_design(db, char.voice_design_id, current_user.id)
        if voice_design:
            voice_design.instruct = data.instruct
            db.commit()

    return AudiobookCharacterResponse(
        id=char.id,
        project_id=char.project_id,
        name=char.name,
        description=char.description,
        instruct=char.instruct,
        voice_design_id=char.voice_design_id,
    )


@router.post("/projects/{project_id}/generate")
async def generate_project(
    project_id: int,
    data: AudiobookGenerateRequest = AudiobookGenerateRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status == "analyzing":
        raise HTTPException(status_code=400, detail="Project is currently analyzing, please wait")
    if project.status not in ("ready", "generating", "done", "error"):
        raise HTTPException(status_code=400, detail=f"Project must be in 'ready' state, current: {project.status}")

    from core.audiobook_service import generate_project as _generate
    from core.database import SessionLocal

    chapter_index = data.chapter_index

    async def run_generation():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await _generate(project_id, db_user, async_db, chapter_index=chapter_index)
        finally:
            async_db.close()

    asyncio.create_task(run_generation())
    msg = f"Generation started for chapter {chapter_index}" if chapter_index is not None else "Generation started"
    return {"message": msg, "project_id": project_id, "chapter_index": chapter_index}


@router.get("/projects/{project_id}/logs")
async def stream_project_logs(
    project_id: int,
    chapter_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    from core import progress_store as ps

    log_key = f"ch_{chapter_id}" if chapter_id is not None else str(project_id)

    async def generator():
        sent_complete = -1
        last_streaming = ""
        while True:
            state = ps.get_snapshot(log_key)
            lines = state["lines"]
            n = len(lines)

            for i in range(sent_complete + 1, max(0, n - 1)):
                yield f"data: {json.dumps({'index': i, 'line': lines[i]})}\n\n"
                sent_complete = i

            if n > 0:
                cur = lines[n - 1]
                if cur != last_streaming or (sent_complete < n - 1):
                    yield f"data: {json.dumps({'index': n - 1, 'line': cur})}\n\n"
                    last_streaming = cur
                    sent_complete = max(sent_complete, n - 2)

            if state["done"]:
                yield f"data: {json.dumps({'done': True})}\n\n"
                break

            await asyncio.sleep(0.05)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/projects/{project_id}/segments", response_model=list[AudiobookSegmentResponse])
async def get_segments(
    project_id: int,
    chapter: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    segments = crud.list_audiobook_segments(db, project_id, chapter_index=chapter)
    result = []
    for seg in segments:
        char_name = seg.character.name if seg.character else None
        result.append(AudiobookSegmentResponse(
            id=seg.id,
            project_id=seg.project_id,
            chapter_index=seg.chapter_index,
            segment_index=seg.segment_index,
            character_id=seg.character_id,
            character_name=char_name,
            text=seg.text,
            audio_path=seg.audio_path,
            status=seg.status,
        ))
    return result


@router.get("/projects/{project_id}/segments/{segment_id}/audio")
async def get_segment_audio(
    project_id: int,
    segment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    seg = db.query(AudiobookSegment).filter(
        AudiobookSegment.id == segment_id,
        AudiobookSegment.project_id == project_id,
    ).first()
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    if not seg.audio_path or not Path(seg.audio_path).exists():
        raise HTTPException(status_code=404, detail="Audio not available")

    return FileResponse(seg.audio_path, media_type="audio/wav")


@router.get("/projects/{project_id}/download")
async def download_project(
    project_id: int,
    chapter: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    segments = crud.list_audiobook_segments(db, project_id, chapter_index=chapter)
    done_segments = [s for s in segments if s.status == "done" and s.audio_path]

    if not done_segments:
        raise HTTPException(status_code=404, detail="No completed audio segments found")

    audio_paths = [s.audio_path for s in done_segments]

    if chapter is not None:
        output_path = str(
            Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "chapters" / f"chapter_{chapter}.wav"
        )
    else:
        output_path = str(
            Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "full.wav"
        )

    if not Path(output_path).exists():
        from core.audiobook_service import merge_audio_files
        merge_audio_files(audio_paths, output_path)

    filename = f"chapter_{chapter}.wav" if chapter is not None else f"{project.title}.wav"
    return FileResponse(output_path, media_type="audio/wav", filename=filename)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_dir = Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id)
    if project_dir.exists():
        import shutil
        shutil.rmtree(project_dir, ignore_errors=True)

    if project.source_path:
        source_file = Path(project.source_path)
        if source_file.exists():
            source_file.unlink(missing_ok=True)

    crud.delete_audiobook_project(db, project_id, current_user.id)
