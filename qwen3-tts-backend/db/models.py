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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    aliyun_api_key = Column(Text, nullable=True)
    user_preferences = Column(JSON, nullable=True, default=lambda: {"default_backend": "local", "onboarding_completed": False})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    voice_caches = relationship("VoiceCache", back_populates="user", cascade="all, delete-orphan")

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
