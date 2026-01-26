import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from db.models import User, Job, VoiceCache

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, username: str, email: str, hashed_password: str) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=hashed_password
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def create_user_by_admin(
    db: Session,
    username: str,
    email: str,
    hashed_password: str,
    is_superuser: bool = False
) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        is_superuser=is_superuser
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def list_users(db: Session, skip: int = 0, limit: int = 100) -> tuple[List[User], int]:
    total = db.query(User).count()
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users, total

def update_user(
    db: Session,
    user_id: int,
    username: Optional[str] = None,
    email: Optional[str] = None,
    hashed_password: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_superuser: Optional[bool] = None
) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    if username is not None:
        user.username = username
    if email is not None:
        user.email = email
    if hashed_password is not None:
        user.hashed_password = hashed_password
    if is_active is not None:
        user.is_active = is_active
    if is_superuser is not None:
        user.is_superuser = is_superuser

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user_id: int) -> bool:
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True

def create_job(db: Session, user_id: int, job_type: str, input_data: Dict[str, Any]) -> Job:
    job = Job(
        user_id=user_id,
        job_type=job_type,
        input_data=json.dumps(input_data),
        status="pending"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

def get_job(db: Session, job_id: int, user_id: int) -> Optional[Job]:
    return db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()

def list_jobs(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None
) -> List[Job]:
    query = db.query(Job).filter(Job.user_id == user_id)
    if status:
        query = query.filter(Job.status == status)
    return query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()

def update_job_status(
    db: Session,
    job_id: int,
    user_id: int,
    status: str,
    output_path: Optional[str] = None,
    error_message: Optional[str] = None
) -> Optional[Job]:
    job = get_job(db, job_id, user_id)
    if not job:
        return None

    job.status = status
    if output_path:
        job.output_path = output_path
    if error_message:
        job.error_message = error_message
    if status in ["completed", "failed"]:
        job.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(job)
    return job

def delete_job(db: Session, job_id: int, user_id: int) -> bool:
    job = get_job(db, job_id, user_id)
    if not job:
        return False
    db.delete(job)
    db.commit()
    return True

def create_cache_entry(
    db: Session,
    user_id: int,
    ref_audio_hash: str,
    cache_path: str,
    meta_data: Optional[Dict[str, Any]] = None
) -> VoiceCache:
    cache = VoiceCache(
        user_id=user_id,
        ref_audio_hash=ref_audio_hash,
        cache_path=cache_path,
        meta_data=json.dumps(meta_data) if meta_data else None
    )
    db.add(cache)
    db.commit()
    db.refresh(cache)
    return cache

def get_cache_entry(db: Session, user_id: int, ref_audio_hash: str) -> Optional[VoiceCache]:
    cache = db.query(VoiceCache).filter(
        VoiceCache.user_id == user_id,
        VoiceCache.ref_audio_hash == ref_audio_hash
    ).first()

    if cache:
        cache.last_accessed = datetime.utcnow()
        cache.access_count += 1
        db.commit()
        db.refresh(cache)

    return cache

def list_cache_entries(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[VoiceCache]:
    return db.query(VoiceCache).filter(
        VoiceCache.user_id == user_id
    ).order_by(VoiceCache.last_accessed.desc()).offset(skip).limit(limit).all()

def delete_cache_entry(db: Session, cache_id: int, user_id: int) -> bool:
    cache = db.query(VoiceCache).filter(
        VoiceCache.id == cache_id,
        VoiceCache.user_id == user_id
    ).first()
    if not cache:
        return False
    db.delete(cache)
    db.commit()
    return True
