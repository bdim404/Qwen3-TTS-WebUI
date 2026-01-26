import logging
from fastapi import APIRouter

from core.metrics import MetricsCollector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("")
async def get_metrics():
    metrics = await MetricsCollector.get_instance()
    data = await metrics.get_metrics()
    return data


@router.post("/reset")
async def reset_metrics():
    metrics = await MetricsCollector.get_instance()
    await metrics.reset()
    return {"message": "Metrics reset successfully"}
