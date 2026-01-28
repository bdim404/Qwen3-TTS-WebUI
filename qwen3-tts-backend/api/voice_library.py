import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.database import get_db
from core.config import settings
from db.models import User
from db.models_dialogue import VoiceLibrary, Character
from db.crud_dialogue import (
    create_voice_library, get_voice_libraries, get_voice_library,
    update_voice_library, delete_voice_library
)
from schemas.voice_library import (
    VoiceLibraryCreate, VoiceLibraryUpdate, VoiceLibraryResponse,
    VoiceLibraryWithReferences, VoiceLibraryList
)
from api.auth import get_current_user
from utils.voice_preview import generate_preview_audio, delete_preview_audio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice-library", tags=["voice-library"])

limiter = Limiter(key_func=get_remote_address)

@router.post("", response_model=VoiceLibraryResponse)
@limiter.limit("30/minute")
async def create_voice(
    request: Request,
    voice: VoiceLibraryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        voice_library = create_voice_library(
            db=db,
            user_id=current_user.id,
            name=voice.name,
            voice_type=voice.voice_type,
            voice_data=voice.voice_data,
            description=voice.description,
            tags=voice.tags
        )

        try:
            preview_path = await generate_preview_audio(
                voice_library_id=voice_library.id,
                voice_type=voice.voice_type,
                voice_data=voice.voice_data,
                language="zh"
            )

            voice_library = update_voice_library(
                db=db,
                voice_id=voice_library.id,
                user_id=current_user.id,
                preview_audio_path=preview_path
            )
        except Exception as e:
            logger.warning(f"Failed to generate preview audio for voice library {voice_library.id}: {e}")

        return voice_library

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create voice library: {e}")
        raise HTTPException(status_code=500, detail="Failed to create voice library")

@router.get("", response_model=VoiceLibraryList)
@limiter.limit("30/minute")
async def list_voices(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    tags: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tag_list = tags.split(",") if tags else None

    items, total = get_voice_libraries(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        tags=tag_list
    )

    return VoiceLibraryList(items=items, total=total)

@router.get("/{voice_id}", response_model=VoiceLibraryResponse)
@limiter.limit("30/minute")
async def get_voice(
    request: Request,
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voice_library = get_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

    if not voice_library:
        raise HTTPException(status_code=404, detail="Voice library not found")

    return voice_library

@router.patch("/{voice_id}", response_model=VoiceLibraryResponse)
@limiter.limit("30/minute")
async def update_voice(
    request: Request,
    voice_id: int,
    voice: VoiceLibraryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voice_library = get_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

    if not voice_library:
        raise HTTPException(status_code=404, detail="Voice library not found")

    update_data = voice.model_dump(exclude_unset=True)

    try:
        updated_voice = update_voice_library(
            db=db,
            voice_id=voice_id,
            user_id=current_user.id,
            **update_data
        )

        return updated_voice

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update voice library {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update voice library")

@router.delete("/{voice_id}")
@limiter.limit("30/minute")
async def delete_voice(
    request: Request,
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voice_library = get_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

    if not voice_library:
        raise HTTPException(status_code=404, detail="Voice library not found")

    try:
        old_preview_path = voice_library.preview_audio_path

        delete_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

        if old_preview_path:
            delete_preview_audio(old_preview_path)

        return {"message": "Voice library deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to delete voice library {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete voice library")

@router.get("/{voice_id}/references", response_model=VoiceLibraryWithReferences)
@limiter.limit("30/minute")
async def get_voice_references(
    request: Request,
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voice_library = get_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

    if not voice_library:
        raise HTTPException(status_code=404, detail="Voice library not found")

    characters = db.query(Character).filter(
        Character.voice_library_id == voice_id,
        Character.user_id == current_user.id
    ).all()

    voice_dict = VoiceLibraryResponse.model_validate(voice_library).model_dump()
    voice_dict["reference_count"] = len(characters)
    voice_dict["referenced_characters"] = [char.name for char in characters]

    return VoiceLibraryWithReferences(**voice_dict)

@router.post("/{voice_id}/regenerate-preview", response_model=VoiceLibraryResponse)
@limiter.limit("10/minute")
async def regenerate_preview(
    request: Request,
    voice_id: int,
    language: str = Query("zh", regex="^(zh|en|ja)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voice_library = get_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

    if not voice_library:
        raise HTTPException(status_code=404, detail="Voice library not found")

    try:
        old_preview_path = voice_library.preview_audio_path

        preview_path = await generate_preview_audio(
            voice_library_id=voice_library.id,
            voice_type=voice_library.voice_type,
            voice_data=voice_library.voice_data,
            language=language
        )

        updated_voice = update_voice_library(
            db=db,
            voice_id=voice_id,
            user_id=current_user.id,
            preview_audio_path=preview_path
        )

        if old_preview_path and old_preview_path != preview_path:
            delete_preview_audio(old_preview_path)

        return updated_voice

    except Exception as e:
        logger.error(f"Failed to regenerate preview audio for voice library {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to regenerate preview audio")

@router.get("/{voice_id}/preview/audio")
@limiter.limit("60/minute")
async def get_preview_audio(
    request: Request,
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voice_library = get_voice_library(db=db, voice_id=voice_id, user_id=current_user.id)

    if not voice_library:
        raise HTTPException(status_code=404, detail="Voice library not found")

    if not voice_library.preview_audio_path:
        raise HTTPException(status_code=404, detail="Preview audio not available")

    audio_file = Path(voice_library.preview_audio_path)

    if not audio_file.exists():
        raise HTTPException(status_code=404, detail="Preview audio file not found")

    return FileResponse(
        path=str(audio_file),
        media_type="audio/wav",
        filename=audio_file.name
    )

@router.get("/tags")
@limiter.limit("30/minute")
async def get_tags(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    predefined_tags = ["男声", "女声", "温柔", "有力", "播音", "对话"]

    user_voices = db.query(VoiceLibrary).filter(
        VoiceLibrary.user_id == current_user.id
    ).all()

    user_tags = set()
    for voice in user_voices:
        if voice.tags:
            user_tags.update(voice.tags)

    user_custom_tags = list(user_tags - set(predefined_tags))

    return {
        "predefined": predefined_tags,
        "user_custom": user_custom_tags
    }
