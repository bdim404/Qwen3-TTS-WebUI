import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from db.models import User, Job, VoiceCache, SystemSettings, VoiceDesign, AudiobookProject, AudiobookChapter, AudiobookCharacter, AudiobookSegment

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
    preview_text: Optional[str] = None,
    voice_cache_id: Optional[int] = None,
    ref_audio_path: Optional[str] = None,
    ref_text: Optional[str] = None,
) -> VoiceDesign:
    design = VoiceDesign(
        user_id=user_id,
        name=name,
        backend_type=backend_type,
        instruct=instruct,
        aliyun_voice_id=aliyun_voice_id,
        meta_data=meta_data,
        preview_text=preview_text,
        voice_cache_id=voice_cache_id,
        ref_audio_path=ref_audio_path,
        ref_text=ref_text,
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

def count_voice_designs(
    db: Session,
    user_id: int,
    backend_type: Optional[str] = None
) -> int:
    query = db.query(VoiceDesign).filter(
        VoiceDesign.user_id == user_id,
        VoiceDesign.is_active == True
    )
    if backend_type:
        query = query.filter(VoiceDesign.backend_type == backend_type)
    return query.count()

def delete_voice_design(db: Session, design_id: int, user_id: int) -> bool:
    design = get_voice_design(db, design_id, user_id)
    if not design:
        return False
    db.delete(design)
    db.commit()
    return True

def update_voice_design_usage(db: Session, design_id: int, user_id: int) -> Optional[VoiceDesign]:
    design = get_voice_design(db, design_id, user_id)
    if design:
        design.last_used = datetime.utcnow()
        design.use_count += 1
        db.commit()
        db.refresh(design)
    return design


def update_user_llm_config(
    db: Session,
    user_id: int,
    llm_api_key: Optional[str] = None,
    llm_base_url: Optional[str] = None,
    llm_model: Optional[str] = None,
    clear: bool = False
) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    if clear:
        user.llm_api_key = None
        user.llm_base_url = None
        user.llm_model = None
    else:
        if llm_api_key is not None:
            user.llm_api_key = llm_api_key
        if llm_base_url is not None:
            user.llm_base_url = llm_base_url
        if llm_model is not None:
            user.llm_model = llm_model
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def create_audiobook_project(
    db: Session,
    user_id: int,
    title: str,
    source_type: str,
    source_text: Optional[str] = None,
    source_path: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> AudiobookProject:
    project = AudiobookProject(
        user_id=user_id,
        title=title,
        source_type=source_type,
        source_text=source_text,
        source_path=source_path,
        llm_model=llm_model,
        status="pending",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_audiobook_project(db: Session, project_id: int, user_id: int) -> Optional[AudiobookProject]:
    return db.query(AudiobookProject).filter(
        AudiobookProject.id == project_id,
        AudiobookProject.user_id == user_id
    ).first()


def list_audiobook_projects(db: Session, user_id: int, skip: int = 0, limit: int = 50) -> List[AudiobookProject]:
    return db.query(AudiobookProject).filter(
        AudiobookProject.user_id == user_id
    ).order_by(AudiobookProject.created_at.desc()).offset(skip).limit(limit).all()


def update_audiobook_project_status(
    db: Session,
    project_id: int,
    status: str,
    error_message: Optional[str] = None
) -> Optional[AudiobookProject]:
    project = db.query(AudiobookProject).filter(AudiobookProject.id == project_id).first()
    if not project:
        return None
    project.status = status
    if error_message is not None:
        project.error_message = error_message
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


def delete_audiobook_project(db: Session, project_id: int, user_id: int) -> bool:
    project = get_audiobook_project(db, project_id, user_id)
    if not project:
        return False
    db.delete(project)
    db.commit()
    return True


def create_audiobook_chapter(
    db: Session,
    project_id: int,
    chapter_index: int,
    source_text: str,
    title: Optional[str] = None,
) -> AudiobookChapter:
    chapter = AudiobookChapter(
        project_id=project_id,
        chapter_index=chapter_index,
        source_text=source_text,
        title=title,
        status="pending",
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


def get_audiobook_chapter(db: Session, chapter_id: int) -> Optional[AudiobookChapter]:
    return db.query(AudiobookChapter).filter(AudiobookChapter.id == chapter_id).first()


def list_audiobook_chapters(db: Session, project_id: int) -> List[AudiobookChapter]:
    return db.query(AudiobookChapter).filter(
        AudiobookChapter.project_id == project_id
    ).order_by(AudiobookChapter.chapter_index).all()


def update_audiobook_chapter_status(
    db: Session,
    chapter_id: int,
    status: str,
    error_message: Optional[str] = None,
) -> Optional[AudiobookChapter]:
    chapter = db.query(AudiobookChapter).filter(AudiobookChapter.id == chapter_id).first()
    if not chapter:
        return None
    chapter.status = status
    if error_message is not None:
        chapter.error_message = error_message
    db.commit()
    db.refresh(chapter)
    return chapter


def delete_audiobook_chapters(db: Session, project_id: int) -> None:
    db.query(AudiobookChapter).filter(AudiobookChapter.project_id == project_id).delete()
    db.commit()


def delete_audiobook_segments_for_chapter(db: Session, project_id: int, chapter_index: int) -> None:
    db.query(AudiobookSegment).filter(
        AudiobookSegment.project_id == project_id,
        AudiobookSegment.chapter_index == chapter_index,
    ).delete()
    db.commit()


def create_audiobook_character(
    db: Session,
    project_id: int,
    name: str,
    gender: Optional[str] = None,
    description: Optional[str] = None,
    instruct: Optional[str] = None,
    voice_design_id: Optional[int] = None,
) -> AudiobookCharacter:
    char = AudiobookCharacter(
        project_id=project_id,
        name=name,
        gender=gender,
        description=description,
        instruct=instruct,
        voice_design_id=voice_design_id,
    )
    db.add(char)
    db.commit()
    db.refresh(char)
    return char


def get_audiobook_character(db: Session, char_id: int) -> Optional[AudiobookCharacter]:
    return db.query(AudiobookCharacter).filter(AudiobookCharacter.id == char_id).first()


def list_audiobook_characters(db: Session, project_id: int) -> List[AudiobookCharacter]:
    return db.query(AudiobookCharacter).filter(
        AudiobookCharacter.project_id == project_id
    ).all()


def update_audiobook_character_voice(
    db: Session,
    char_id: int,
    voice_design_id: int
) -> Optional[AudiobookCharacter]:
    char = db.query(AudiobookCharacter).filter(AudiobookCharacter.id == char_id).first()
    if not char:
        return None
    char.voice_design_id = voice_design_id
    db.commit()
    db.refresh(char)
    return char


def update_audiobook_character(
    db: Session,
    char_id: int,
    name: Optional[str] = None,
    gender: Optional[str] = None,
    description: Optional[str] = None,
    instruct: Optional[str] = None,
    voice_design_id: Optional[int] = None,
) -> Optional[AudiobookCharacter]:
    char = db.query(AudiobookCharacter).filter(AudiobookCharacter.id == char_id).first()
    if not char:
        return None
    if name is not None:
        char.name = name
    if gender is not None:
        char.gender = gender
    if description is not None:
        char.description = description
    if instruct is not None:
        char.instruct = instruct
    if voice_design_id is not None:
        char.voice_design_id = voice_design_id
    db.commit()
    db.refresh(char)
    return char


def create_audiobook_segment(
    db: Session,
    project_id: int,
    character_id: int,
    text: str,
    chapter_index: int = 0,
    segment_index: int = 0,
) -> AudiobookSegment:
    seg = AudiobookSegment(
        project_id=project_id,
        character_id=character_id,
        text=text,
        chapter_index=chapter_index,
        segment_index=segment_index,
        status="pending",
    )
    db.add(seg)
    db.commit()
    db.refresh(seg)
    return seg


def list_audiobook_segments(
    db: Session,
    project_id: int,
    chapter_index: Optional[int] = None
) -> List[AudiobookSegment]:
    query = db.query(AudiobookSegment).filter(AudiobookSegment.project_id == project_id)
    if chapter_index is not None:
        query = query.filter(AudiobookSegment.chapter_index == chapter_index)
    return query.order_by(AudiobookSegment.chapter_index, AudiobookSegment.segment_index).all()


def update_audiobook_segment_status(
    db: Session,
    segment_id: int,
    status: str,
    audio_path: Optional[str] = None
) -> Optional[AudiobookSegment]:
    seg = db.query(AudiobookSegment).filter(AudiobookSegment.id == segment_id).first()
    if not seg:
        return None
    seg.status = status
    if audio_path is not None:
        seg.audio_path = audio_path
    db.commit()
    db.refresh(seg)
    return seg


def delete_audiobook_segments(db: Session, project_id: int) -> None:
    db.query(AudiobookSegment).filter(AudiobookSegment.project_id == project_id).delete()
    db.commit()


def delete_audiobook_characters(db: Session, project_id: int) -> None:
    db.query(AudiobookCharacter).filter(AudiobookCharacter.project_id == project_id).delete()
    db.commit()
