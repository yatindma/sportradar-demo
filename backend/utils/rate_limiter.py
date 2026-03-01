"""
Async rate limiter for external API calls.

Sportradar free tier allows 1 request per second. This module ensures
we never exceed that limit, even under concurrent requests.
"""

import asyncio
import time
import logging
import os

logger = logging.getLogger("sportscout.rate_limiter")

_QPS = float(os.getenv("RATE_LIMIT_QPS", "1"))
_BUFFER = 0.1  # 100ms safety buffer for clock drift
_last_call_time: float = 0.0
_lock = asyncio.Lock()


async def rate_limit_acquire():
    """
    Acquire a rate limit slot. Blocks until enough time has passed
    since the last API call.

    Uses an asyncio.Lock to ensure thread-safety across concurrent requests.
    """
    global _last_call_time

    async with _lock:
        now = time.time()
        min_interval = (1.0 / _QPS) + _BUFFER
        elapsed = now - _last_call_time

        if elapsed < min_interval:
            wait_time = min_interval - elapsed
            logger.debug(f"Rate limiter: waiting {wait_time:.3f}s")
            await asyncio.sleep(wait_time)

        _last_call_time = time.time()
