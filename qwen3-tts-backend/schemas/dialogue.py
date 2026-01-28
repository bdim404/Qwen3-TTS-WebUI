from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class DialogueBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    merge_config: Optional[Dict[str, Any]] = None

class DialogueCreate(DialogueBase):
    pass

class DialogueUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    merge_config: Optional[Dict[str, Any]] = None

class DialogueResponse(DialogueBase):
    id: int
    user_id: int
    status: str
    generation_mode: Optional[str] = None
    total_lines: int
    success_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    merged_audio_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DialogueLineBase(BaseModel):
    character_id: int
    text: str = Field(..., min_length=1, max_length=2000)
    instruct_override: Optional[str] = None
    tts_params_override: Optional[Dict[str, Any]] = None

class DialogueLineCreate(DialogueLineBase):
    order: Optional[int] = None

class DialogueLineUpdate(BaseModel):
    character_id: Optional[int] = None
    text: Optional[str] = Field(None, min_length=1, max_length=2000)
    instruct_override: Optional[str] = None
    tts_params_override: Optional[Dict[str, Any]] = None

class DialogueLineResponse(DialogueLineBase):
    id: int
    dialogue_id: int
    order: int
    status: str
    output_audio_path: Optional[str] = None
    audio_duration: Optional[float] = None
    error_message: Optional[str] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DialogueLineWithCharacter(DialogueLineResponse):
    character_name: str
    character_color: str
    character_avatar_type: str
    character_avatar_data: Optional[str] = None

class DialogueDetail(DialogueResponse):
    lines: List[DialogueLineWithCharacter]

class DialogueList(BaseModel):
    items: List[DialogueResponse]
    total: int

class ReorderLinesRequest(BaseModel):
    line_ids: List[int]
