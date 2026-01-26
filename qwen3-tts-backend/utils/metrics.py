import threading
from typing import Dict
from pathlib import Path
from sqlalchemy.orm import Session
from db.models import VoiceCache


class CacheMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        self.cache_hits = 0
        self.cache_misses = 0
        self._user_hits: Dict[int, int] = {}
        self._user_misses: Dict[int, int] = {}

    def record_hit(self, user_id: int):
        with self._lock:
            self.cache_hits += 1
            self._user_hits[user_id] = self._user_hits.get(user_id, 0) + 1

    def record_miss(self, user_id: int):
        with self._lock:
            self.cache_misses += 1
            self._user_misses[user_id] = self._user_misses.get(user_id, 0) + 1

    def get_stats(self, db: Session, cache_dir: str) -> dict:
        with self._lock:
            total_requests = self.cache_hits + self.cache_misses
            hit_rate = self.cache_hits / total_requests if total_requests > 0 else 0.0

            total_entries = db.query(VoiceCache).count()

            total_size_bytes = 0
            cache_path = Path(cache_dir)
            if cache_path.exists():
                for cache_file in cache_path.glob("*.pkl"):
                    total_size_bytes += cache_file.stat().st_size

            total_size_mb = total_size_bytes / (1024 * 1024)

            user_stats = []
            for user_id in set(list(self._user_hits.keys()) + list(self._user_misses.keys())):
                hits = self._user_hits.get(user_id, 0)
                misses = self._user_misses.get(user_id, 0)
                total = hits + misses
                user_hit_rate = hits / total if total > 0 else 0.0

                user_cache_count = db.query(VoiceCache).filter(
                    VoiceCache.user_id == user_id
                ).count()

                user_stats.append({
                    'user_id': user_id,
                    'hits': hits,
                    'misses': misses,
                    'hit_rate': user_hit_rate,
                    'cache_entries': user_cache_count
                })

            return {
                'global': {
                    'total_requests': total_requests,
                    'cache_hits': self.cache_hits,
                    'cache_misses': self.cache_misses,
                    'hit_rate': hit_rate,
                    'total_entries': total_entries,
                    'total_size_mb': total_size_mb
                },
                'users': user_stats
            }

    def reset(self):
        with self._lock:
            self.cache_hits = 0
            self.cache_misses = 0
            self._user_hits.clear()
            self._user_misses.clear()


cache_metrics = CacheMetrics()
