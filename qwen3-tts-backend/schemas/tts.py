from typing import Optional, List
from pydantic import BaseModel, Field

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    ref_audio: Optional[str] = None
    ref_text: Optional[str] = None
    language: str = Field(default="en")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)

class TTSResponse(BaseModel):
    job_id: int
    status: str
    audio_url: Optional[str] = None


class CustomVoiceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="Auto")
    speaker: str
    instruct: Optional[str] = Field(default="")
    max_new_tokens: Optional[int] = Field(default=2048, ge=128, le=4096)
    temperature: Optional[float] = Field(default=0.9, ge=0.1, le=2.0)
    top_k: Optional[int] = Field(default=50, ge=1, le=100)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    repetition_penalty: Optional[float] = Field(default=1.05, ge=1.0, le=2.0)


class VoiceDesignRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="Auto")
    instruct: str = Field(..., min_length=1)
    max_new_tokens: Optional[int] = Field(default=2048, ge=128, le=4096)
    temperature: Optional[float] = Field(default=0.9, ge=0.1, le=2.0)
    top_k: Optional[int] = Field(default=50, ge=1, le=100)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    repetition_penalty: Optional[float] = Field(default=1.05, ge=1.0, le=2.0)


class VoiceCloneRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="Auto")
    ref_text: Optional[str] = Field(default=None, max_length=500)
    use_cache: bool = Field(default=True)
    x_vector_only_mode: bool = Field(default=False)
    max_new_tokens: Optional[int] = Field(default=2048, ge=128, le=4096)
    temperature: Optional[float] = Field(default=0.9, ge=0.1, le=2.0)
    top_k: Optional[int] = Field(default=50, ge=1, le=100)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    repetition_penalty: Optional[float] = Field(default=1.05, ge=1.0, le=2.0)
