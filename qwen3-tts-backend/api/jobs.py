import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.database import get_db
from core.config import settings
from core.security import decode_access_token
from db.models import Job, JobStatus, User
from db.crud import get_user_by_username
from api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])

limiter = Limiter(key_func=get_remote_address)


async def get_user_from_token_or_query(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    auth_token = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        auth_token = auth_header.split(" ")[1]
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token"
        )

    username = decode_access_token(auth_token)
    if username is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = get_user_by_username(db, username=username)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


@router.get("/{job_id}")
@limiter.limit("30/minute")
async def get_job(
    request: Request,
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    download_url = None
    if job.status == JobStatus.COMPLETED and job.output_path:
        output_file = Path(job.output_path)
        if output_file.exists():
            download_url = f"{settings.BASE_URL}/jobs/{job.id}/download"

    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "input_params": job.input_params,
        "output_path": job.output_path,
        "download_url": download_url,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() + 'Z' if job.created_at else None,
        "started_at": job.started_at.isoformat() + 'Z' if job.started_at else None,
        "completed_at": job.completed_at.isoformat() + 'Z' if job.completed_at else None
    }


@router.get("")
@limiter.limit("30/minute")
async def list_jobs(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Job).filter(Job.user_id == current_user.id)

    if status:
        try:
            status_enum = JobStatus(status)
            query = query.filter(Job.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()

    jobs_data = []
    for job in jobs:
        download_url = None
        if job.status == JobStatus.COMPLETED and job.output_path:
            output_file = Path(job.output_path)
            if output_file.exists():
                download_url = f"{settings.BASE_URL}/jobs/{job.id}/download"

        jobs_data.append({
            "id": job.id,
            "job_type": job.job_type,
            "status": job.status,
            "input_params": job.input_params,
            "output_path": job.output_path,
            "download_url": download_url,
            "error_message": job.error_message,
            "created_at": job.created_at.isoformat() + 'Z' if job.created_at else None,
            "completed_at": job.completed_at.isoformat() + 'Z' if job.completed_at else None
        })

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "jobs": jobs_data
    }


@router.delete("/{job_id}")
@limiter.limit("30/minute")
async def delete_job(
    request: Request,
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if job.output_path:
        output_file = Path(job.output_path)
        if output_file.exists():
            try:
                output_file.unlink()
                logger.info(f"Deleted output file: {output_file}")
            except Exception as e:
                logger.error(f"Failed to delete output file {output_file}: {e}")

    db.delete(job)
    db.commit()

    return {"message": "Job deleted successfully"}


@router.get("/{job_id}/download")
@limiter.limit("30/minute")
async def download_job_output(
    request: Request,
    job_id: int,
    current_user: User = Depends(get_user_from_token_or_query),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")

    if not job.output_path:
        raise HTTPException(status_code=404, detail="Output file not found")

    output_file = Path(job.output_path)
    if not output_file.exists():
        raise HTTPException(status_code=404, detail="Output file does not exist")

    output_dir = Path(settings.OUTPUT_DIR).resolve()
    if not output_file.resolve().is_relative_to(output_dir):
        logger.warning(f"Path traversal attempt detected: {output_file}")
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        path=str(output_file),
        media_type="audio/wav",
        filename=output_file.name,
        headers={
            "Content-Disposition": f'attachment; filename="{output_file.name}"'
        }
    )
