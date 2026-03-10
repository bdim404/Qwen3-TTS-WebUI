from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index, JSON
from sqlalchemy.orm import relationship

from db.database import Base

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AudiobookStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    READY = "ready"
    GENERATING = "generating"
    DONE = "done"
    ERROR = "error"

class SegmentStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    DONE = "done"
    ERROR = "error"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    aliyun_api_key = Column(Text, nullable=True)
    llm_api_key = Column(Text, nullable=True)
    llm_base_url = Column(String(500), nullable=True)
    llm_model = Column(String(200), nullable=True)
    can_use_local_model = Column(Boolean, default=False, nullable=False)
    user_preferences = Column(JSON, nullable=True, default=lambda: {"default_backend": "aliyun", "onboarding_completed": False})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    voice_caches = relationship("VoiceCache", back_populates="user", cascade="all, delete-orphan")
    voice_designs = relationship("VoiceDesign", back_populates="user", cascade="all, delete-orphan")
    audiobook_projects = relationship("AudiobookProject", back_populates="user", cascade="all, delete-orphan")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_type = Column(String(50), nullable=False)
    status = Column(String(50), default="pending", nullable=False, index=True)
    backend_type = Column(String(20), default="local", nullable=False)
    input_data = Column(Text, nullable=True)
    input_params = Column(JSON, nullable=True)
    output_path = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="jobs")

    __table_args__ = (
        Index('idx_user_status', 'user_id', 'status'),
        Index('idx_user_created', 'user_id', 'created_at'),
    )

class VoiceCache(Base):
    __tablename__ = "voice_caches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ref_audio_hash = Column(String(64), nullable=False, index=True)
    cache_path = Column(String(500), nullable=False)
    meta_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_accessed = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    access_count = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="voice_caches")

    __table_args__ = (
        Index('idx_user_hash', 'user_id', 'ref_audio_hash'),
    )

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class VoiceDesign(Base):
    __tablename__ = "voice_designs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    backend_type = Column(String(20), nullable=False, index=True)
    instruct = Column(Text, nullable=False)
    aliyun_voice_id = Column(String(255), nullable=True)
    meta_data = Column(JSON, nullable=True)
    preview_text = Column(Text, nullable=True)
    ref_audio_path = Column(String(500), nullable=True)
    ref_text = Column(Text, nullable=True)
    voice_cache_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    use_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="voice_designs")

    __table_args__ = (
        Index('idx_user_backend', 'user_id', 'backend_type'),
        Index('idx_user_active', 'user_id', 'is_active'),
    )


class AudiobookProject(Base):
    __tablename__ = "audiobook_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    source_type = Column(String(10), nullable=False)
    source_path = Column(String(500), nullable=True)
    source_text = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    llm_model = Column(String(200), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="audiobook_projects")
    characters = relationship("AudiobookCharacter", back_populates="project", cascade="all, delete-orphan")
    chapters = relationship("AudiobookChapter", back_populates="project", cascade="all, delete-orphan", order_by="AudiobookChapter.chapter_index")
    segments = relationship("AudiobookSegment", back_populates="project", cascade="all, delete-orphan")


class AudiobookChapter(Base):
    __tablename__ = "audiobook_chapters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("audiobook_projects.id"), nullable=False, index=True)
    chapter_index = Column(Integer, nullable=False)
    title = Column(String(500), nullable=True)
    source_text = Column(Text, nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    error_message = Column(Text, nullable=True)

    project = relationship("AudiobookProject", back_populates="chapters")

    __table_args__ = (
        Index('idx_chapter_project_idx', 'project_id', 'chapter_index'),
    )


class AudiobookCharacter(Base):
    __tablename__ = "audiobook_characters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("audiobook_projects.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    instruct = Column(Text, nullable=True)
    voice_design_id = Column(Integer, ForeignKey("voice_designs.id"), nullable=True)

    project = relationship("AudiobookProject", back_populates="characters")
    voice_design = relationship("VoiceDesign")
    segments = relationship("AudiobookSegment", back_populates="character")


class AudiobookSegment(Base):
    __tablename__ = "audiobook_segments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("audiobook_projects.id"), nullable=False, index=True)
    chapter_index = Column(Integer, nullable=False, default=0)
    segment_index = Column(Integer, nullable=False)
    character_id = Column(Integer, ForeignKey("audiobook_characters.id"), nullable=False)
    text = Column(Text, nullable=False)
    audio_path = Column(String(500), nullable=True)
    status = Column(String(20), default="pending", nullable=False)

    project = relationship("AudiobookProject", back_populates="segments")
    character = relationship("AudiobookCharacter", back_populates="segments")

    __table_args__ = (
        Index('idx_project_chapter', 'project_id', 'chapter_index', 'segment_index'),
    )
