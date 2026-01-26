import logging
import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.config import settings
from core.database import get_db
from core.cache_manager import VoiceCacheManager
from api.auth import get_current_user
from db.crud import list_cache_entries, delete_cache_entry
from db.models import VoiceCache, User
from utils.metrics import cache_metrics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cache", tags=["cache"])

limiter = Limiter(key_func=get_remote_address)


@router.get("/voices")
@limiter.limit("30/minute")
async def list_user_caches(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    caches = list_cache_entries(db, current_user.id, skip=skip, limit=limit)

    result = []
    for cache in caches:
        meta_data = json.loads(cache.meta_data) if cache.meta_data else {}
        cache_file = Path(cache.cache_path)
        file_size_mb = cache_file.stat().st_size / (1024 * 1024) if cache_file.exists() else 0

        result.append({
            'id': cache.id,
            'ref_audio_hash': cache.ref_audio_hash,
            'created_at': cache.created_at.isoformat(),
            'last_accessed': cache.last_accessed.isoformat(),
            'access_count': cache.access_count,
            'metadata': meta_data,
            'size_mb': round(file_size_mb, 2)
        })

    return {
        'caches': result,
        'total': len(result)
    }


@router.delete("/voices/{cache_id}")
@limiter.limit("30/minute")
async def delete_user_cache(
    request: Request,
    cache_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cache = db.query(VoiceCache).filter(
        VoiceCache.id == cache_id,
        VoiceCache.user_id == current_user.id
    ).first()

    if not cache:
        raise HTTPException(status_code=404, detail="Cache not found")

    cache_file = Path(cache.cache_path)
    if cache_file.exists():
        cache_file.unlink()

    success = delete_cache_entry(db, cache_id, current_user.id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete cache")

    logger.info(f"Cache deleted: id={cache_id}, user={current_user.id}")

    return {
        'message': 'Cache deleted successfully',
        'cache_id': cache_id
    }


@router.delete("/voices")
@limiter.limit("10/minute")
async def cleanup_expired_caches(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cache_manager = await VoiceCacheManager.get_instance()
    deleted_count = await cache_manager.cleanup_expired(db)

    logger.info(f"Expired cache cleanup: user={current_user.id}, deleted={deleted_count}")

    return {
        'message': 'Expired caches cleaned up',
        'deleted_count': deleted_count
    }


@router.post("/voices/prune")
@limiter.limit("10/minute")
async def prune_caches(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cache_manager = await VoiceCacheManager.get_instance()
    deleted_count = await cache_manager.enforce_max_entries(current_user.id, db)

    logger.info(f"LRU prune: user={current_user.id}, deleted={deleted_count}")

    return {
        'message': 'LRU pruning completed',
        'deleted_count': deleted_count
    }


@router.get("/stats")
@limiter.limit("30/minute")
async def get_cache_stats(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stats = cache_metrics.get_stats(db, settings.CACHE_DIR)

    user_stats = None
    for user_stat in stats['users']:
        if user_stat['user_id'] == current_user.id:
            user_stats = user_stat
            break

    if user_stats is None:
        user_cache_count = db.query(VoiceCache).filter(
            VoiceCache.user_id == current_user.id
        ).count()
        user_stats = {
            'user_id': current_user.id,
            'hits': 0,
            'misses': 0,
            'hit_rate': 0.0,
            'cache_entries': user_cache_count
        }

    return {
        'global': stats['global'],
        'user': user_stats
    }
