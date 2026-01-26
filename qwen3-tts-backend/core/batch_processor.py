import asyncio
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import deque

from core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class BatchRequest:
    request_id: str
    data: Dict[str, Any]
    future: asyncio.Future
    timestamp: float


class BatchProcessor:
    _instance: Optional['BatchProcessor'] = None
    _lock = asyncio.Lock()

    def __init__(self, batch_size: int = None, batch_wait_time: float = None):
        self.batch_size = batch_size or settings.BATCH_SIZE
        self.batch_wait_time = batch_wait_time or settings.BATCH_WAIT_TIME
        self.queue: deque = deque()
        self.queue_lock = asyncio.Lock()
        self.processing = False
        self._processor_task: Optional[asyncio.Task] = None
        logger.info(f"BatchProcessor initialized with batch_size={self.batch_size}, wait_time={self.batch_wait_time}s")

    @classmethod
    async def get_instance(cls) -> 'BatchProcessor':
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
                    cls._instance._start_processor()
        return cls._instance

    def _start_processor(self):
        if not self._processor_task or self._processor_task.done():
            self._processor_task = asyncio.create_task(self._process_batches())
            logger.info("Batch processor task started")

    async def _process_batches(self):
        logger.info("Batch processing loop started")
        while True:
            try:
                await asyncio.sleep(0.1)

                async with self.queue_lock:
                    if not self.queue:
                        continue

                    current_time = time.time()
                    oldest_request = self.queue[0]
                    wait_duration = current_time - oldest_request.timestamp

                    should_process = (
                        len(self.queue) >= self.batch_size or
                        wait_duration >= self.batch_wait_time
                    )

                    if should_process:
                        batch = []
                        for _ in range(min(self.batch_size, len(self.queue))):
                            if self.queue:
                                batch.append(self.queue.popleft())

                        if batch:
                            logger.info(f"Processing batch of {len(batch)} requests (queue_wait={wait_duration:.3f}s)")
                            asyncio.create_task(self._process_batch(batch))

            except Exception as e:
                logger.error(f"Error in batch processor loop: {e}", exc_info=True)
                await asyncio.sleep(1)

    async def _process_batch(self, batch: List[BatchRequest]):
        for request in batch:
            try:
                if not request.future.done():
                    result = await self._execute_single_request(request.data)
                    request.future.set_result(result)
            except Exception as e:
                logger.error(f"Error processing request {request.request_id}: {e}", exc_info=True)
                if not request.future.done():
                    request.future.set_exception(e)

    async def _execute_single_request(self, data: Dict[str, Any]) -> Any:
        raise NotImplementedError("Subclass must implement _execute_single_request")

    async def submit(self, request_id: str, data: Dict[str, Any], timeout: float = 300) -> Any:
        future = asyncio.Future()
        request = BatchRequest(
            request_id=request_id,
            data=data,
            future=future,
            timestamp=time.time()
        )

        async with self.queue_lock:
            self.queue.append(request)
            queue_size = len(self.queue)

        logger.debug(f"Request {request_id} queued (queue_size={queue_size})")

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            logger.error(f"Request {request_id} timed out after {timeout}s")
            async with self.queue_lock:
                if request in self.queue:
                    self.queue.remove(request)
            raise TimeoutError(f"Request timed out after {timeout}s")

    async def get_queue_length(self) -> int:
        async with self.queue_lock:
            return len(self.queue)

    async def get_stats(self) -> Dict[str, Any]:
        queue_length = await self.get_queue_length()
        return {
            "queue_length": queue_length,
            "batch_size": self.batch_size,
            "batch_wait_time": self.batch_wait_time,
            "processor_running": self._processor_task is not None and not self._processor_task.done()
        }


class TTSBatchProcessor(BatchProcessor):

    def __init__(self, process_func: Callable, batch_size: int = None, batch_wait_time: float = None):
        super().__init__(batch_size, batch_wait_time)
        self.process_func = process_func

    async def _execute_single_request(self, data: Dict[str, Any]) -> Any:
        return await self.process_func(**data)
