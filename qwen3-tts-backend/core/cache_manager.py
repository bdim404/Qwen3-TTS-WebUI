import hashlib
import pickle
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from sqlalchemy.orm import Session
from db.crud import (
    create_cache_entry,
    get_cache_entry,
    list_cache_entries,
    delete_cache_entry
)
from db.models import VoiceCache
from core.config import settings

logger = logging.getLogger(__name__)


class VoiceCacheManager:
    _instance = None
    _lock = asyncio.Lock()

    def __init__(self, cache_dir: str, max_entries: int, ttl_days: int):
        self.cache_dir = Path(cache_dir)
        self.max_entries = max_entries
        self.ttl_days = ttl_days
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"VoiceCacheManager initialized: dir={cache_dir}, max={max_entries}, ttl={ttl_days}d")

    @classmethod
    async def get_instance(cls) -> 'VoiceCacheManager':
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = VoiceCacheManager(
                        cache_dir=settings.CACHE_DIR,
                        max_entries=settings.MAX_CACHE_ENTRIES,
                        ttl_days=settings.CACHE_TTL_DAYS
                    )
        return cls._instance

    def get_audio_hash(self, audio_data: bytes) -> str:
        return hashlib.sha256(audio_data).hexdigest()

    async def get_cache(self, user_id: int, ref_audio_hash: str, db: Session) -> Optional[Dict[str, Any]]:
        try:
            cache_entry = get_cache_entry(db, user_id, ref_audio_hash)
            if not cache_entry:
                logger.debug(f"Cache miss: user={user_id}, hash={ref_audio_hash[:8]}...")
                return None

            cache_file = Path(cache_entry.cache_path)
            if not cache_file.exists():
                logger.warning(f"Cache file missing: {cache_file}")
                delete_cache_entry(db, cache_entry.id, user_id)
                return None

            with open(cache_file, 'rb') as f:
                cache_data = pickle.load(f)

            logger.info(f"Cache hit: user={user_id}, hash={ref_audio_hash[:8]}..., access_count={cache_entry.access_count}")
            return {
                'cache_id': cache_entry.id,
                'data': cache_data,
                'metadata': cache_entry.meta_data
            }

        except Exception as e:
            logger.error(f"Cache retrieval error: {e}", exc_info=True)
            return None

    async def set_cache(
        self,
        user_id: int,
        ref_audio_hash: str,
        cache_data: Any,
        metadata: Dict[str, Any],
        db: Session
    ) -> str:
        async with self._lock:
            try:
                cache_filename = f"{user_id}_{ref_audio_hash}.pkl"
                cache_path = self.cache_dir / cache_filename

                with open(cache_path, 'wb') as f:
                    pickle.dump(cache_data, f)

                cache_entry = create_cache_entry(
                    db=db,
                    user_id=user_id,
                    ref_audio_hash=ref_audio_hash,
                    cache_path=str(cache_path),
                    meta_data=metadata
                )

                await self.enforce_max_entries(user_id, db)

                logger.info(f"Cache created: user={user_id}, hash={ref_audio_hash[:8]}..., id={cache_entry.id}")
                return cache_entry.id

            except Exception as e:
                logger.error(f"Cache creation error: {e}", exc_info=True)
                if cache_path.exists():
                    cache_path.unlink()
                raise

    async def enforce_max_entries(self, user_id: int, db: Session) -> int:
        try:
            all_caches = list_cache_entries(db, user_id, skip=0, limit=9999)
            if len(all_caches) <= self.max_entries:
                return 0

            caches_to_delete = all_caches[self.max_entries:]
            deleted_count = 0

            for cache in caches_to_delete:
                cache_file = Path(cache.cache_path)
                if cache_file.exists():
                    cache_file.unlink()

                delete_cache_entry(db, cache.id, user_id)
                deleted_count += 1

            if deleted_count > 0:
                logger.info(f"LRU eviction: user={user_id}, deleted={deleted_count} entries")

            return deleted_count

        except Exception as e:
            logger.error(f"LRU enforcement error: {e}", exc_info=True)
            return 0

    async def cleanup_expired(self, db: Session) -> int:
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.ttl_days)
            expired_caches = db.query(VoiceCache).filter(
                VoiceCache.last_accessed < cutoff_date
            ).all()

            deleted_count = 0
            for cache in expired_caches:
                cache_file = Path(cache.cache_path)
                if cache_file.exists():
                    cache_file.unlink()

                db.delete(cache)
                deleted_count += 1

            if deleted_count > 0:
                db.commit()
                logger.info(f"Expired cache cleanup: deleted={deleted_count} entries")

            return deleted_count

        except Exception as e:
            logger.error(f"Expired cache cleanup error: {e}", exc_info=True)
            db.rollback()
            return 0
