"""
Simple in-memory store for downloadable CSV files.
Keys are UUID strings, values are CSV content strings.
"""
import uuid

_store: dict[str, str] = {}


def save(content: str) -> str:
    """Store CSV content and return a unique key."""
    key = str(uuid.uuid4())
    _store[key] = content
    return key


def get(key: str) -> str | None:
    """Retrieve CSV content by key."""
    return _store.get(key)
