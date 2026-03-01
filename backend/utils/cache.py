"""
Simple in-memory TTL cache for API responses.

Used to avoid redundant Sportradar API calls within the same session.
Default TTL is 5 minutes (300 seconds), configurable via CACHE_TTL_SECONDS env var.
"""

import os
import time
import logging
from typing import Any, Optional

logger = logging.getLogger("sportscout.cache")

_cache: dict[str, tuple[Any, float]] = {}  # key → (value, expiry_timestamp)
_DEFAULT_TTL = int(os.getenv("CACHE_TTL_SECONDS", "300"))


def cache_get(key: str) -> Optional[Any]:
    """
    Retrieve a value from cache if it exists and hasn't expired.

    Args:
        key: Cache key (e.g., "player_profile:Nikola Jokic")

    Returns:
        Cached value or None if miss/expired
    """
    if key in _cache:
        value, expiry = _cache[key]
        if time.time() < expiry:
            logger.debug(f"Cache HIT: {key}")
            return value
        else:
            del _cache[key]
            logger.debug(f"Cache EXPIRED: {key}")
    return None


def cache_set(key: str, value: Any, ttl: Optional[int] = None):
    """
    Store a value in cache with a TTL.

    Args:
        key: Cache key
        value: Value to cache
        ttl: Time-to-live in seconds (defaults to CACHE_TTL_SECONDS)
    """
    ttl = ttl or _DEFAULT_TTL
    _cache[key] = (value, time.time() + ttl)
    logger.debug(f"Cache SET: {key} (TTL={ttl}s)")
