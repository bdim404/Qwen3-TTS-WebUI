import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.database import get_db
from api.auth import get_current_user
from db.models import User
from db import crud
from schemas.voice_design import (
    VoiceDesignCreate,
    VoiceDesignResponse,
    VoiceDesignUpdate,
    VoiceDesignListResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice-designs", tags=["voice-designs"])
limiter = Limiter(key_func=get_remote_address)

@router.post("", response_model=VoiceDesignResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_voice_design(
    request: Request,
    data: VoiceDesignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        design = crud.create_voice_design(
            db=db,
            user_id=current_user.id,
            name=data.name,
            instruct=data.instruct,
            backend_type=data.backend_type,
            aliyun_voice_id=data.aliyun_voice_id,
            meta_data=data.meta_data,
            preview_text=data.preview_text
        )
        return VoiceDesignResponse.from_orm(design)
    except Exception as e:
        logger.error(f"Failed to save voice design: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save voice design")

@router.get("", response_model=VoiceDesignListResponse)
@limiter.limit("30/minute")
async def list_voice_designs(
    request: Request,
    backend_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    designs = crud.list_voice_designs(db, current_user.id, backend_type, skip, limit)
    return VoiceDesignListResponse(designs=[VoiceDesignResponse.from_orm(d) for d in designs], total=len(designs))

@router.get("/{design_id}", response_model=VoiceDesignResponse)
@limiter.limit("30/minute")
async def get_voice_design(
    request: Request,
    design_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    design = crud.get_voice_design(db, design_id, current_user.id)
    if not design:
        raise HTTPException(status_code=404, detail="Voice design not found")
    return VoiceDesignResponse.from_orm(design)

@router.patch("/{design_id}", response_model=VoiceDesignResponse)
@limiter.limit("30/minute")
async def update_voice_design(
    request: Request,
    design_id: int,
    data: VoiceDesignUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    design = crud.update_voice_design(db, design_id, current_user.id, data.name)
    if not design:
        raise HTTPException(status_code=404, detail="Voice design not found")
    return VoiceDesignResponse.from_orm(design)

@router.delete("/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_voice_design(
    request: Request,
    design_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = crud.delete_voice_design(db, design_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Voice design not found")
