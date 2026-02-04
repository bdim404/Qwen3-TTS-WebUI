import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from pathlib import Path

from core.database import get_db
from api.auth import get_current_user
from db.models import User, Job, JobStatus
from db import crud
from schemas.voice_design import (
    VoiceDesignCreate,
    VoiceDesignResponse,
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

@router.post("/{design_id}/prepare-clone")
@limiter.limit("10/minute")
async def prepare_voice_clone_prompt(
    request: Request,
    design_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from core.tts_service import TTSServiceFactory
    from core.cache_manager import VoiceCacheManager
    from utils.audio import process_ref_audio, extract_audio_features
    from core.config import settings
    from db.crud import can_user_use_local_model
    from datetime import datetime

    design = crud.get_voice_design(db, design_id, current_user.id)
    if not design:
        raise HTTPException(status_code=404, detail="Voice design not found")

    if design.backend_type != "local":
        raise HTTPException(
            status_code=400,
            detail="Voice clone prompt preparation is only supported for local backend"
        )

    if not can_user_use_local_model(current_user):
        raise HTTPException(
            status_code=403,
            detail="Local model access required"
        )

    if design.voice_cache_id:
        return {
            "message": "Voice clone prompt already exists",
            "cache_id": design.voice_cache_id
        }

    try:
        backend = await TTSServiceFactory.get_backend("local")

        ref_text = design.preview_text or design.instruct[:100]

        logger.info(f"Generating reference audio for voice design {design_id}")
        ref_audio_bytes, sample_rate = await backend.generate_voice_design({
            "text": ref_text,
            "language": "Auto",
            "instruct": design.instruct,
            "max_new_tokens": 2048,
            "temperature": 0.3,
            "top_k": 10,
            "top_p": 0.5,
            "repetition_penalty": 1.05
        })

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        ref_filename = f"voice_design_{design_id}_{timestamp}.wav"
        ref_audio_path = Path(settings.OUTPUT_DIR) / ref_filename

        with open(ref_audio_path, 'wb') as f:
            f.write(ref_audio_bytes)

        logger.info(f"Extracting voice clone prompt from reference audio")
        ref_audio_array, ref_sr = process_ref_audio(ref_audio_bytes)

        from core.model_manager import ModelManager
        model_manager = await ModelManager.get_instance()
        await model_manager.load_model("base")
        _, tts = await model_manager.get_current_model()

        if tts is None:
            raise RuntimeError("Failed to load base model")

        x_vector = tts.create_voice_clone_prompt(
            ref_audio=(ref_audio_array, ref_sr),
            ref_text=ref_text,
            x_vector_only_mode=True
        )

        cache_manager = await VoiceCacheManager.get_instance()
        ref_audio_hash = cache_manager.get_audio_hash(ref_audio_bytes)

        features = extract_audio_features(ref_audio_array, ref_sr)
        metadata = {
            'duration': features['duration'],
            'sample_rate': features['sample_rate'],
            'ref_text': ref_text,
            'x_vector_only_mode': True,
            'voice_design_id': design_id,
            'instruct': design.instruct
        }

        cache_id = await cache_manager.set_cache(
            current_user.id, ref_audio_hash, x_vector, metadata, db
        )

        design.voice_cache_id = cache_id
        design.ref_audio_path = str(ref_audio_path)
        design.ref_text = ref_text
        db.commit()

        logger.info(f"Voice clone prompt prepared for design {design_id}, cache_id={cache_id}")

        return {
            "message": "Voice clone prompt prepared successfully",
            "cache_id": cache_id,
            "ref_text": ref_text
        }

    except Exception as e:
        logger.error(f"Failed to prepare voice clone prompt: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
