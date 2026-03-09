import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from api.auth import get_current_user
from core.database import get_db
from db import crud
from db.models import User
from schemas.audiobook import (
    AudiobookProjectCreate,
    AudiobookProjectResponse,
    AudiobookProjectDetail,
    AudiobookCharacterResponse,
    AudiobookCharacterUpdate,
    AudiobookSegmentResponse,
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


def _project_to_detail(project) -> AudiobookProjectDetail:
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
    return _project_to_detail(project)


@router.post("/projects/{project_id}/analyze")
async def analyze_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status in ("analyzing", "generating"):
        raise HTTPException(status_code=400, detail=f"Project is already {project.status}")

    if not current_user.llm_api_key or not current_user.llm_base_url or not current_user.llm_model:
        raise HTTPException(status_code=400, detail="LLM config not set. Please configure LLM API key first.")

    from core.audiobook_service import analyze_project as _analyze
    from core.database import SessionLocal

    async def run_analysis():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await _analyze(project_id, db_user, async_db)
        finally:
            async_db.close()

    background_tasks.add_task(run_analysis)
    return {"message": "Analysis started", "project_id": project_id}


@router.put("/projects/{project_id}/characters/{char_id}", response_model=AudiobookCharacterResponse)
async def update_character_voice(
    project_id: int,
    char_id: int,
    data: AudiobookCharacterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    char = crud.get_audiobook_character(db, char_id)
    if not char or char.project_id != project_id:
        raise HTTPException(status_code=404, detail="Character not found")

    voice_design = crud.get_voice_design(db, data.voice_design_id, current_user.id)
    if not voice_design:
        raise HTTPException(status_code=404, detail="Voice design not found")

    char = crud.update_audiobook_character_voice(db, char_id, data.voice_design_id)
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = crud.get_audiobook_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status not in ("ready", "done", "error"):
        raise HTTPException(status_code=400, detail=f"Project must be in 'ready' state, current: {project.status}")

    from core.audiobook_service import generate_project as _generate
    from core.database import SessionLocal

    async def run_generation():
        async_db = SessionLocal()
        try:
            db_user = crud.get_user_by_id(async_db, current_user.id)
            await _generate(project_id, db_user, async_db)
        finally:
            async_db.close()

    background_tasks.add_task(run_generation)
    return {"message": "Generation started", "project_id": project_id}


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
            Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "chapters" / f"chapter_{chapter}.mp3"
        )
    else:
        output_path = str(
            Path(settings.OUTPUT_DIR) / "audiobook" / str(project_id) / "full.mp3"
        )

    if not Path(output_path).exists():
        from core.audiobook_service import merge_audio_files
        merge_audio_files(audio_paths, output_path)

    filename = f"chapter_{chapter}.mp3" if chapter is not None else f"{project.title}.mp3"
    return FileResponse(output_path, media_type="audio/mpeg", filename=filename)


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

    crud.delete_audiobook_project(db, project_id, current_user.id)
