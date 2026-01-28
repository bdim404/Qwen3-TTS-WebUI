from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
from db import crud_dialogue
from schemas.character import CharacterCreate, CharacterUpdate, CharacterResponse, CharacterList, CharacterWithVoice
from api.auth import get_current_user
from db.models import User
from db.models_dialogue import Character, VoiceLibrary

router = APIRouter(prefix="/characters", tags=["characters"])

@router.post("", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
def create_character(
    character: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if character.voice_source_type == "library":
        if not character.voice_library_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="选择音色库模式时必须提供 voice_library_id"
            )
        voice_library = db.query(VoiceLibrary).filter(
            VoiceLibrary.id == character.voice_library_id,
            VoiceLibrary.user_id == current_user.id
        ).first()
        if not voice_library:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="音色库不存在"
            )
    elif character.voice_source_type == "preset":
        if not character.preset_speaker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="选择预设音色模式时必须提供 preset_speaker"
            )

    try:
        db_character = crud_dialogue.create_character(
            db=db,
            user_id=current_user.id,
            name=character.name,
            voice_source_type=character.voice_source_type,
            avatar_type=character.avatar_type,
            color=character.color,
            voice_library_id=character.voice_library_id,
            preset_speaker=character.preset_speaker,
            default_instruct=character.default_instruct,
            avatar_data=character.avatar_data,
            description=character.description,
            tags=character.tags,
            default_tts_params=character.default_tts_params
        )
        return db_character
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建角色失败: {str(e)}"
        )

@router.get("", response_model=CharacterList)
def get_characters(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tags: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tag_list = tags.split(",") if tags else None

    items, total = crud_dialogue.get_characters(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        tags=tag_list
    )

    return CharacterList(items=items, total=total)

@router.get("/{character_id}", response_model=CharacterWithVoice)
def get_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    character = crud_dialogue.get_character(db, character_id, current_user.id)
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    response_data = {
        "id": character.id,
        "user_id": character.user_id,
        "name": character.name,
        "description": character.description,
        "voice_source_type": character.voice_source_type,
        "voice_library_id": character.voice_library_id,
        "preset_speaker": character.preset_speaker,
        "default_instruct": character.default_instruct,
        "avatar_type": character.avatar_type,
        "avatar_data": character.avatar_data,
        "color": character.color,
        "tags": character.tags,
        "default_tts_params": character.default_tts_params,
        "created_at": character.created_at,
        "last_used_at": character.last_used_at,
        "voice_library_name": None,
        "voice_library_data": None
    }

    if character.voice_library:
        response_data["voice_library_name"] = character.voice_library.name
        response_data["voice_library_data"] = character.voice_library.voice_data

    return response_data

@router.patch("/{character_id}", response_model=CharacterResponse)
def update_character(
    character_id: int,
    character_update: CharacterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_character = crud_dialogue.get_character(db, character_id, current_user.id)
    if not existing_character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    if character_update.voice_source_type == "library" and character_update.voice_library_id:
        voice_library = db.query(VoiceLibrary).filter(
            VoiceLibrary.id == character_update.voice_library_id,
            VoiceLibrary.user_id == current_user.id
        ).first()
        if not voice_library:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="音色库不存在"
            )

    update_data = character_update.model_dump(exclude_unset=True)

    try:
        updated_character = crud_dialogue.update_character(
            db=db,
            character_id=character_id,
            user_id=current_user.id,
            **update_data
        )
        return updated_character
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新角色失败: {str(e)}"
        )

@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        success = crud_dialogue.delete_character(db, character_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除角色失败: {str(e)}"
        )
