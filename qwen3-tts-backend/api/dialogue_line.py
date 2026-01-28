from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.database import get_db
from db import crud_dialogue
from schemas.dialogue import (
    DialogueLineCreate, DialogueLineUpdate, DialogueLineResponse,
    DialogueLineWithCharacter, ReorderLinesRequest
)
from api.auth import get_current_user
from db.models import User
from db.models_dialogue import DialogueLine

router = APIRouter(prefix="/dialogues", tags=["dialogue_lines"])

@router.post("/{dialogue_id}/lines", response_model=DialogueLineResponse, status_code=status.HTTP_201_CREATED)
def create_dialogue_line(
    dialogue_id: int,
    line: DialogueLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dialogue = crud_dialogue.get_dialogue(db, dialogue_id, current_user.id)
    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    character = crud_dialogue.get_character(db, line.character_id, current_user.id)
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )

    try:
        db_line = crud_dialogue.create_dialogue_line(
            db=db,
            dialogue_id=dialogue_id,
            character_id=line.character_id,
            text=line.text,
            order=line.order,
            instruct_override=line.instruct_override,
            tts_params_override=line.tts_params_override
        )
        return db_line
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建对话行失败: {str(e)}"
        )

@router.get("/{dialogue_id}/lines", response_model=list[DialogueLineWithCharacter])
def get_dialogue_lines(
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

    return lines_with_character

@router.patch("/dialogue-lines/{line_id}", response_model=DialogueLineResponse)
def update_dialogue_line(
    line_id: int,
    line_update: DialogueLineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    line = crud_dialogue.get_dialogue_line(db, line_id)
    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话行不存在"
        )

    dialogue = crud_dialogue.get_dialogue(db, line.dialogue_id, current_user.id)
    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    if line_update.character_id:
        character = crud_dialogue.get_character(db, line_update.character_id, current_user.id)
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )

    update_data = line_update.model_dump(exclude_unset=True)

    try:
        updated_line = crud_dialogue.update_dialogue_line(
            db=db,
            line_id=line_id,
            **update_data
        )
        return updated_line
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新对话行失败: {str(e)}"
        )

@router.delete("/dialogue-lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dialogue_line(
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    line = crud_dialogue.get_dialogue_line(db, line_id)
    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话行不存在"
        )

    dialogue = crud_dialogue.get_dialogue(db, line.dialogue_id, current_user.id)
    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对话不存在"
        )

    try:
        from utils.file_cleanup import cleanup_line_audio
        cleanup_line_audio(line_id, line.output_audio_path)
    except Exception as e:
        pass

    try:
        success = crud_dialogue.delete_dialogue_line(db, line_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话行不存在"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除对话行失败: {str(e)}"
        )

@router.put("/{dialogue_id}/lines/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_dialogue_lines(
    dialogue_id: int,
    reorder_request: ReorderLinesRequest,
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
        success = crud_dialogue.reorder_dialogue_lines(
            db=db,
            dialogue_id=dialogue_id,
            line_ids=reorder_request.line_ids
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="重新排序失败"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重新排序失败: {str(e)}"
        )
