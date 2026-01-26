import logging
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings
from core.cache_manager import VoiceCacheManager
from db.models import Job

logger = logging.getLogger(__name__)


async def cleanup_expired_caches(db_url: str) -> dict:
    try:
        engine = create_engine(db_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        cache_manager = await VoiceCacheManager.get_instance()
        deleted_count = await cache_manager.cleanup_expired(db)

        freed_space_mb = 0

        db.close()

        logger.info(f"Cleanup: deleted {deleted_count} expired caches")

        return {
            'deleted_count': deleted_count,
            'freed_space_mb': freed_space_mb
        }

    except Exception as e:
        logger.error(f"Expired cache cleanup failed: {e}", exc_info=True)
        return {
            'deleted_count': 0,
            'freed_space_mb': 0,
            'error': str(e)
        }


async def cleanup_old_jobs(db_url: str, days: int = 7) -> dict:
    try:
        engine = create_engine(db_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        old_jobs = db.query(Job).filter(
            Job.completed_at < cutoff_date,
            Job.status.in_(['completed', 'failed'])
        ).all()

        deleted_files = 0
        for job in old_jobs:
            if job.output_path:
                output_file = Path(job.output_path)
                if output_file.exists():
                    output_file.unlink()
                    deleted_files += 1

            db.delete(job)

        db.commit()
        deleted_jobs = len(old_jobs)

        db.close()

        logger.info(f"Cleanup: deleted {deleted_jobs} old jobs, {deleted_files} files")

        return {
            'deleted_jobs': deleted_jobs,
            'deleted_files': deleted_files
        }

    except Exception as e:
        logger.error(f"Old job cleanup failed: {e}", exc_info=True)
        return {
            'deleted_jobs': 0,
            'deleted_files': 0,
            'error': str(e)
        }


async def cleanup_orphaned_files(db_url: str) -> dict:
    try:
        engine = create_engine(db_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        output_dir = Path(settings.OUTPUT_DIR)
        cache_dir = Path(settings.CACHE_DIR)

        output_files_in_db = {Path(job.output_path).name for job in db.query(Job.output_path).filter(Job.output_path.isnot(None)).all()}

        from db.models import VoiceCache
        cache_files_in_db = {Path(cache.cache_path).name for cache in db.query(VoiceCache.cache_path).all()}

        deleted_orphans = 0
        freed_space_bytes = 0

        if output_dir.exists():
            for output_file in output_dir.glob("*.wav"):
                if output_file.name not in output_files_in_db:
                    size = output_file.stat().st_size
                    output_file.unlink()
                    deleted_orphans += 1
                    freed_space_bytes += size

        if cache_dir.exists():
            for cache_file in cache_dir.glob("*.pkl"):
                if cache_file.name not in cache_files_in_db:
                    size = cache_file.stat().st_size
                    cache_file.unlink()
                    deleted_orphans += 1
                    freed_space_bytes += size

        freed_space_mb = freed_space_bytes / (1024 * 1024)

        db.close()

        logger.info(f"Cleanup: deleted {deleted_orphans} orphaned files, freed {freed_space_mb:.2f} MB")

        return {
            'deleted_orphans': deleted_orphans,
            'freed_space_mb': freed_space_mb
        }

    except Exception as e:
        logger.error(f"Orphaned file cleanup failed: {e}", exc_info=True)
        return {
            'deleted_orphans': 0,
            'freed_space_mb': 0,
            'error': str(e)
        }


async def run_scheduled_cleanup(db_url: str) -> dict:
    logger.info("Starting scheduled cleanup task...")

    try:
        cache_result = await cleanup_expired_caches(db_url)
        job_result = await cleanup_old_jobs(db_url)
        orphan_result = await cleanup_orphaned_files(db_url)

        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'expired_caches': cache_result,
            'old_jobs': job_result,
            'orphaned_files': orphan_result,
            'status': 'completed'
        }

        logger.info(f"Scheduled cleanup completed: {result}")

        return result

    except Exception as e:
        logger.error(f"Scheduled cleanup failed: {e}", exc_info=True)
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'failed',
            'error': str(e)
        }
