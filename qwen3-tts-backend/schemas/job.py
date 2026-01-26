from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict

class JobBase(BaseModel):
    job_type: str

class JobCreate(JobBase):
    input_data: Dict[str, Any]

class Job(JobBase):
    id: int
    user_id: int
    status: str
    output_path: Optional[str] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class JobList(BaseModel):
    total: int
    jobs: List[Job]
