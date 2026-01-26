from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class CacheEntry(BaseModel):
    id: int
    user_id: int
    ref_audio_hash: str
    cache_path: str
    meta_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    last_accessed: datetime
    access_count: int

    model_config = ConfigDict(from_attributes=True)
