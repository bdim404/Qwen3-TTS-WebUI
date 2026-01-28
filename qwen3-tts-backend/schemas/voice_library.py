from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class VoiceLibraryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    voice_type: str = Field(..., pattern="^(custom_voice|voice_design|voice_clone)$")
    voice_data: Dict[str, Any]
    tags: Optional[List[str]] = None

class VoiceLibraryCreate(VoiceLibraryBase):
    pass

class VoiceLibraryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    voice_type: Optional[str] = Field(None, pattern="^(custom_voice|voice_design|voice_clone)$")
    voice_data: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None

class VoiceLibraryResponse(VoiceLibraryBase):
    id: int
    user_id: int
    preview_audio_path: Optional[str] = None
    created_at: datetime
    last_used_at: Optional[datetime] = None
    usage_count: int

    model_config = ConfigDict(from_attributes=True)

class VoiceLibraryWithReferences(VoiceLibraryResponse):
    reference_count: int
    referenced_characters: Optional[List[str]] = None

class VoiceLibraryList(BaseModel):
    items: List[VoiceLibraryResponse]
    total: int
