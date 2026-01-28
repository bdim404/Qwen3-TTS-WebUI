from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class CharacterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    voice_source_type: str = Field(..., pattern="^(library|preset)$")
    voice_library_id: Optional[int] = None
    preset_speaker: Optional[str] = None
    default_instruct: Optional[str] = None
    avatar_type: str = Field(..., pattern="^(icon|upload|initial)$")
    avatar_data: Optional[str] = None
    color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    tags: Optional[List[str]] = None
    default_tts_params: Optional[Dict[str, Any]] = None

class CharacterCreate(CharacterBase):
    pass

class CharacterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    voice_source_type: Optional[str] = Field(None, pattern="^(library|preset)$")
    voice_library_id: Optional[int] = None
    preset_speaker: Optional[str] = None
    default_instruct: Optional[str] = None
    avatar_type: Optional[str] = Field(None, pattern="^(icon|upload|initial)$")
    avatar_data: Optional[str] = None
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    tags: Optional[List[str]] = None
    default_tts_params: Optional[Dict[str, Any]] = None

class CharacterResponse(CharacterBase):
    id: int
    user_id: int
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CharacterWithVoice(CharacterResponse):
    voice_library_name: Optional[str] = None
    voice_library_data: Optional[Dict[str, Any]] = None

class CharacterList(BaseModel):
    items: List[CharacterResponse]
    total: int
