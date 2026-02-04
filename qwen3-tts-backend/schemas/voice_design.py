from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field

class VoiceDesignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    instruct: str = Field(..., min_length=1)
    backend_type: str = Field(..., pattern="^(local|aliyun)$")
    aliyun_voice_id: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    preview_text: Optional[str] = None

class VoiceDesignResponse(BaseModel):
    id: int
    user_id: int
    name: str
    backend_type: str
    instruct: str
    aliyun_voice_id: Optional[str]
    meta_data: Optional[Dict[str, Any]]
    preview_text: Optional[str]
    created_at: datetime
    last_used: datetime
    use_count: int

    class Config:
        from_attributes = True

class VoiceDesignListResponse(BaseModel):
    designs: List[VoiceDesignResponse]
    total: int
