import time
import logging
from collections import deque, defaultdict
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import asyncio
import statistics

logger = logging.getLogger(__name__)


@dataclass
class RequestMetric:
    timestamp: float
    endpoint: str
    duration: float
    status_code: int
    queue_time: float = 0.0


class MetricsCollector:
    _instance: Optional['MetricsCollector'] = None
    _lock = asyncio.Lock()

    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.requests: deque = deque(maxlen=window_size)
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.total_requests = 0
        self.start_time = time.time()
        self.batch_stats = {
            'total_batches': 0,
            'total_requests_batched': 0,
            'avg_batch_size': 0.0
        }
        self._lock_local = asyncio.Lock()
        logger.info("MetricsCollector initialized")

    @classmethod
    async def get_instance(cls) -> 'MetricsCollector':
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def record_request(
        self,
        endpoint: str,
        duration: float,
        status_code: int,
        queue_time: float = 0.0
    ):
        async with self._lock_local:
            metric = RequestMetric(
                timestamp=time.time(),
                endpoint=endpoint,
                duration=duration,
                status_code=status_code,
                queue_time=queue_time
            )
            self.requests.append(metric)
            self.request_counts[endpoint] += 1
            self.total_requests += 1

            if status_code >= 400:
                self.error_counts[endpoint] += 1

    async def record_batch(self, batch_size: int):
        async with self._lock_local:
            self.batch_stats['total_batches'] += 1
            self.batch_stats['total_requests_batched'] += batch_size

            total_batches = self.batch_stats['total_batches']
            total_requests = self.batch_stats['total_requests_batched']
            self.batch_stats['avg_batch_size'] = total_requests / total_batches if total_batches > 0 else 0.0

    async def get_metrics(self) -> Dict[str, Any]:
        async with self._lock_local:
            current_time = time.time()
            uptime = current_time - self.start_time

            recent_requests = [r for r in self.requests if current_time - r.timestamp < 60]

            durations = [r.duration for r in self.requests if r.duration > 0]
            queue_times = [r.queue_time for r in self.requests if r.queue_time > 0]

            percentiles = {}
            if durations:
                sorted_durations = sorted(durations)
                percentiles = {
                    'p50': statistics.median(sorted_durations),
                    'p95': sorted_durations[int(len(sorted_durations) * 0.95)] if len(sorted_durations) > 0 else 0,
                    'p99': sorted_durations[int(len(sorted_durations) * 0.99)] if len(sorted_durations) > 0 else 0,
                    'avg': statistics.mean(sorted_durations),
                    'min': min(sorted_durations),
                    'max': max(sorted_durations)
                }

            queue_percentiles = {}
            if queue_times:
                sorted_queue_times = sorted(queue_times)
                queue_percentiles = {
                    'p50': statistics.median(sorted_queue_times),
                    'p95': sorted_queue_times[int(len(sorted_queue_times) * 0.95)] if len(sorted_queue_times) > 0 else 0,
                    'p99': sorted_queue_times[int(len(sorted_queue_times) * 0.99)] if len(sorted_queue_times) > 0 else 0,
                    'avg': statistics.mean(sorted_queue_times)
                }

            requests_per_second = len(recent_requests) / 60.0 if recent_requests else 0.0

            import torch
            gpu_stats = {}
            if torch.cuda.is_available():
                gpu_stats = {
                    'gpu_available': True,
                    'gpu_memory_allocated_mb': torch.cuda.memory_allocated(0) / 1024**2,
                    'gpu_memory_reserved_mb': torch.cuda.memory_reserved(0) / 1024**2,
                    'gpu_memory_total_mb': torch.cuda.get_device_properties(0).total_memory / 1024**2
                }
            else:
                gpu_stats = {'gpu_available': False}

            from core.batch_processor import BatchProcessor
            batch_processor = await BatchProcessor.get_instance()
            batch_stats_current = await batch_processor.get_stats()

            return {
                'uptime_seconds': uptime,
                'total_requests': self.total_requests,
                'requests_per_second': requests_per_second,
                'request_counts_by_endpoint': dict(self.request_counts),
                'error_counts_by_endpoint': dict(self.error_counts),
                'latency': percentiles,
                'queue_time': queue_percentiles,
                'batch_processing': {
                    **self.batch_stats,
                    **batch_stats_current
                },
                'gpu': gpu_stats
            }

    async def reset(self):
        async with self._lock_local:
            self.requests.clear()
            self.request_counts.clear()
            self.error_counts.clear()
            self.total_requests = 0
            self.start_time = time.time()
            self.batch_stats = {
                'total_batches': 0,
                'total_requests_batched': 0,
                'avg_batch_size': 0.0
            }
            logger.info("Metrics reset")
