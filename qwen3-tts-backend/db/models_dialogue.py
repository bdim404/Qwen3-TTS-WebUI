from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index, JSON, Float
from sqlalchemy.orm import relationship

from db.database import Base

class VoiceType(str, Enum):
    CUSTOM_VOICE = "custom_voice"
    VOICE_DESIGN = "voice_design"
    VOICE_CLONE = "voice_clone"

class VoiceSourceType(str, Enum):
    LIBRARY = "library"
    PRESET = "preset"

class AvatarType(str, Enum):
    ICON = "icon"
    UPLOAD = "upload"
    INITIAL = "initial"

class DialogueStatus(str, Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"

class DialogueLineStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class JobType(str, Enum):
    SEQUENTIAL = "sequential"
    BATCH = "batch"

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class VoiceLibrary(Base):
    __tablename__ = "voice_libraries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    voice_type = Column(String(20), nullable=False)
    voice_data = Column(JSON, nullable=False)
    tags = Column(JSON, nullable=True)
    preview_audio_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    usage_count = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="voice_libraries")
    characters = relationship("Character", back_populates="voice_library")

    __table_args__ = (
        Index('idx_user_voice_library', 'user_id', 'created_at'),
    )

class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    voice_source_type = Column(String(20), nullable=False)
    voice_library_id = Column(Integer, ForeignKey("voice_libraries.id", ondelete="SET NULL"), nullable=True, index=True)
    preset_speaker = Column(String(100), nullable=True)
    default_instruct = Column(Text, nullable=True)
    avatar_type = Column(String(20), nullable=False)
    avatar_data = Column(String(500), nullable=True)
    color = Column(String(7), nullable=False)
    tags = Column(JSON, nullable=True)
    default_tts_params = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="characters")
    voice_library = relationship("VoiceLibrary", back_populates="characters")
    dialogue_lines = relationship("DialogueLine", back_populates="character")

    __table_args__ = (
        Index('idx_user_character', 'user_id', 'created_at'),
    )

class Dialogue(Base):
    __tablename__ = "dialogues"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    status = Column(String(20), default="draft", nullable=False, index=True)
    generation_mode = Column(String(20), nullable=True)
    merge_config = Column(JSON, nullable=True)
    total_lines = Column(Integer, default=0, nullable=False)
    success_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    merged_audio_path = Column(String(500), nullable=True)

    user = relationship("User", back_populates="dialogues")
    lines = relationship("DialogueLine", back_populates="dialogue", cascade="all, delete-orphan", order_by="DialogueLine.order")
    generation_jobs = relationship("DialogueGenerationJob", back_populates="dialogue", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_user_dialogue_status', 'user_id', 'status'),
        Index('idx_user_dialogue_created', 'user_id', 'created_at'),
    )

class DialogueLine(Base):
    __tablename__ = "dialogue_lines"

    id = Column(Integer, primary_key=True, index=True)
    dialogue_id = Column(Integer, ForeignKey("dialogues.id", ondelete="CASCADE"), nullable=False, index=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="RESTRICT"), nullable=False, index=True)
    order = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    instruct_override = Column(Text, nullable=True)
    tts_params_override = Column(JSON, nullable=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    output_audio_path = Column(String(500), nullable=True)
    audio_duration = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    dialogue = relationship("Dialogue", back_populates="lines")
    character = relationship("Character", back_populates="dialogue_lines")

    __table_args__ = (
        Index('idx_dialogue_line_order', 'dialogue_id', 'order'),
        Index('idx_dialogue_line_status', 'dialogue_id', 'status'),
    )

class DialogueGenerationJob(Base):
    __tablename__ = "dialogue_generation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    dialogue_id = Column(Integer, ForeignKey("dialogues.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, index=True)
    current_line_id = Column(Integer, nullable=True)
    total_lines = Column(Integer, nullable=False)
    completed_lines = Column(Integer, default=0, nullable=False)
    failed_lines = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    dialogue = relationship("Dialogue", back_populates="generation_jobs")
    user = relationship("User", back_populates="dialogue_generation_jobs")

    __table_args__ = (
        Index('idx_user_job_status', 'user_id', 'status'),
        Index('idx_dialogue_job', 'dialogue_id'),
    )
