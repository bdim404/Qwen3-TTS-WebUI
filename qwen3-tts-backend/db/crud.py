import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from db.models import User, Job, VoiceCache, SystemSettings, VoiceDesign

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def count_users(db: Session) -> int:
    return db.query(User).count()

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
    is_superuser: bool = False,
    can_use_local_model: bool = False
) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        is_superuser=is_superuser,
        can_use_local_model=can_use_local_model
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
    is_superuser: Optional[bool] = None,
    can_use_local_model: Optional[bool] = None
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
    if can_use_local_model is not None:
        user.can_use_local_model = can_use_local_model

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

def change_user_password(
    db: Session,
    user_id: int,
    new_hashed_password: str
) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    user.hashed_password = new_hashed_password
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

def update_user_aliyun_key(
    db: Session,
    user_id: int,
    encrypted_api_key: Optional[str]
) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    user.aliyun_api_key = encrypted_api_key
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

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

def get_user_preferences(db: Session, user_id: int) -> dict:
    user = get_user_by_id(db, user_id)
    if not user or not user.user_preferences:
        return {"default_backend": "aliyun", "onboarding_completed": False}
    return user.user_preferences

def update_user_preferences(db: Session, user_id: int, preferences: dict) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    user.user_preferences = preferences
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

def get_system_setting(db: Session, key: str) -> Optional[dict]:
    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        return None
    return setting.value

def update_system_setting(db: Session, key: str, value: dict) -> SystemSettings:
    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if setting:
        setting.value = value
        setting.updated_at = datetime.utcnow()
    else:
        setting = SystemSettings(key=key, value=value, updated_at=datetime.utcnow())
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting

def can_user_use_local_model(user: User) -> bool:
    return user.is_superuser or user.can_use_local_model

def create_voice_design(
    db: Session,
    user_id: int,
    name: str,
    instruct: str,
    backend_type: str,
    aliyun_voice_id: Optional[str] = None,
    meta_data: Optional[Dict[str, Any]] = None,
    preview_text: Optional[str] = None
) -> VoiceDesign:
    design = VoiceDesign(
        user_id=user_id,
        name=name,
        backend_type=backend_type,
        instruct=instruct,
        aliyun_voice_id=aliyun_voice_id,
        meta_data=json.dumps(meta_data) if meta_data else None,
        preview_text=preview_text,
        created_at=datetime.utcnow(),
        last_used=datetime.utcnow()
    )
    db.add(design)
    db.commit()
    db.refresh(design)
    return design

def get_voice_design(db: Session, design_id: int, user_id: int) -> Optional[VoiceDesign]:
    return db.query(VoiceDesign).filter(
        VoiceDesign.id == design_id,
        VoiceDesign.user_id == user_id,
        VoiceDesign.is_active == True
    ).first()

def list_voice_designs(
    db: Session,
    user_id: int,
    backend_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[VoiceDesign]:
    query = db.query(VoiceDesign).filter(
        VoiceDesign.user_id == user_id,
        VoiceDesign.is_active == True
    )
    if backend_type:
        query = query.filter(VoiceDesign.backend_type == backend_type)
    return query.order_by(VoiceDesign.last_used.desc()).offset(skip).limit(limit).all()

def update_voice_design_usage(db: Session, design_id: int, user_id: int) -> Optional[VoiceDesign]:
    design = get_voice_design(db, design_id, user_id)
    if design:
        design.last_used = datetime.utcnow()
        design.use_count += 1
        db.commit()
        db.refresh(design)
    return design

def update_voice_design(
    db: Session,
    design_id: int,
    user_id: int,
    name: Optional[str] = None
) -> Optional[VoiceDesign]:
    design = get_voice_design(db, design_id, user_id)
    if not design:
        return None
    if name is not None:
        design.name = name
    db.commit()
    db.refresh(design)
    return design

def delete_voice_design(db: Session, design_id: int, user_id: int) -> bool:
    design = get_voice_design(db, design_id, user_id)
    if not design:
        return False
    design.is_active = False
    db.commit()
    return True
