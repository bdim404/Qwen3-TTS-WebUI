from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from pathlib import Path
import shutil

from db.database import get_db
from db import crud_dialogue
from schemas.dialogue import (
    DialogueCreate, DialogueUpdate, DialogueResponse, DialogueDetail, DialogueList,
    DialogueLineWithCharacter
)
from api.auth import get_current_user
from db.models import User
from db.models_dialogue import Dialogue

router = APIRouter(prefix="/dialogues", tags=["dialogues"])

@router.post("", response_model=DialogueResponse, status_code=status.HTTP_201_CREATED)
def create_dialogue(
    dialogue: DialogueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        db_dialogue = crud_dialogue.create_dialogue(
            db=db,
            user_id=current_user.id,
            title=dialogue.title,
            merge_config=dialogue.merge_config
        )
        return db_dialogue
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建对话失败: {str(e)}"
        )

@router.get("", response_model=DialogueList)
def get_dialogues(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items, total = crud_dialogue.get_dialogues(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        status=status_filter
    )
    return DialogueList(items=items, total=total)

@router.get("/{dialogue_id}", response_model=DialogueDetail)
def get_dialogue(
    dialogue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dialogue = crud_dialogue.get_dialogue(db, dialogue_id, current_user.id)
    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    lines = crud_dialogue.get_dialogue_lines(db, dialogue_id)

    lines_with_character = []
    for line in lines:
        line_dict = {
            "id": line.id,
            "dialogue_id": line.dialogue_id,
            "character_id": line.character_id,
            "order": line.order,
            "text": line.text,
            "instruct_override": line.instruct_override,
            "tts_params_override": line.tts_params_override,
            "status": line.status,
            "output_audio_path": line.output_audio_path,
            "audio_duration": line.audio_duration,
            "error_message": line.error_message,
            "retry_count": line.retry_count,
            "created_at": line.created_at,
            "updated_at": line.updated_at,
            "completed_at": line.completed_at,
            "character_name": line.character.name,
            "character_color": line.character.color,
            "character_avatar_type": line.character.avatar_type,
            "character_avatar_data": line.character.avatar_data
        }
        lines_with_character.append(DialogueLineWithCharacter(**line_dict))

    return DialogueDetail(
        id=dialogue.id,
        user_id=dialogue.user_id,
        title=dialogue.title,
        status=dialogue.status,
        generation_mode=dialogue.generation_mode,
        merge_config=dialogue.merge_config,
        total_lines=dialogue.total_lines,
        success_count=dialogue.success_count,
        failed_count=dialogue.failed_count,
        created_at=dialogue.created_at,
        updated_at=dialogue.updated_at,
        completed_at=dialogue.completed_at,
        merged_audio_path=dialogue.merged_audio_path,
        lines=lines_with_character
    )

@router.patch("/{dialogue_id}", response_model=DialogueResponse)
def update_dialogue(
    dialogue_id: int,
    dialogue_update: DialogueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_dialogue = crud_dialogue.get_dialogue(db, dialogue_id, current_user.id)
    if not existing_dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    update_data = dialogue_update.model_dump(exclude_unset=True)

    try:
        updated_dialogue = crud_dialogue.update_dialogue(
            db=db,
            dialogue_id=dialogue_id,
            user_id=current_user.id,
            **update_data
        )
        return updated_dialogue
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新对话失败: {str(e)}"
        )

@router.delete("/{dialogue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dialogue(
    dialogue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dialogue = crud_dialogue.get_dialogue(db, dialogue_id, current_user.id)
    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    try:
        from utils.file_cleanup import cleanup_dialogue_audio
        cleanup_dialogue_audio(dialogue_id)
    except Exception as e:
        pass

    try:
        success = crud_dialogue.delete_dialogue(db, dialogue_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除对话失败: {str(e)}"
        )

@router.post("/{dialogue_id}/duplicate", response_model=DialogueResponse, status_code=status.HTTP_201_CREATED)
def duplicate_dialogue(
    dialogue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    original_dialogue = crud_dialogue.get_dialogue(db, dialogue_id, current_user.id)
    if not original_dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    try:
        new_dialogue = crud_dialogue.create_dialogue(
            db=db,
            user_id=current_user.id,
            title=f"{original_dialogue.title} (副本)",
            merge_config=original_dialogue.merge_config
        )

        original_lines = crud_dialogue.get_dialogue_lines(db, dialogue_id)
        for line in original_lines:
            crud_dialogue.create_dialogue_line(
                db=db,
                dialogue_id=new_dialogue.id,
                character_id=line.character_id,
                text=line.text,
                order=line.order,
                instruct_override=line.instruct_override,
                tts_params_override=line.tts_params_override
            )

        return new_dialogue
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"复制对话失败: {str(e)}"
        )
