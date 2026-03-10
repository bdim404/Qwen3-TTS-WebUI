from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class AudiobookProjectCreate(BaseModel):
    title: str
    source_type: str
    source_text: Optional[str] = None


class AudiobookProjectResponse(BaseModel):
    id: int
    user_id: int
    title: str
    source_type: str
    status: str
    llm_model: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AudiobookCharacterResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    instruct: Optional[str] = None
    voice_design_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AudiobookChapterResponse(BaseModel):
    id: int
    project_id: int
    chapter_index: int
    title: Optional[str] = None
    status: str
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AudiobookProjectDetail(AudiobookProjectResponse):
    characters: List[AudiobookCharacterResponse] = []
    chapters: List[AudiobookChapterResponse] = []


class AudiobookGenerateRequest(BaseModel):
    chapter_index: Optional[int] = None


class AudiobookCharacterUpdate(BaseModel):
    voice_design_id: int


class AudiobookCharacterEdit(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instruct: Optional[str] = None
    voice_design_id: Optional[int] = None


class AudiobookSegmentResponse(BaseModel):
    id: int
    project_id: int
    chapter_index: int
    segment_index: int
    character_id: int
    character_name: Optional[str] = None
    text: str
    audio_path: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class LLMConfigUpdate(BaseModel):
    base_url: str
    api_key: str
    model: str


class LLMConfigResponse(BaseModel):
    base_url: Optional[str] = None
    model: Optional[str] = None
    has_key: bool
