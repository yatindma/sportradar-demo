"""
SQLite database client for SportScout AI.

Uses aiosqlite for async operations. The database stores:
  - watchlist: User's saved players/teams with tags and notes
  - search_history: Record of past searches for analytics
"""

import os
import logging
import aiosqlite

logger = logging.getLogger("sportscout.db")

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sportscout.db"))

_db: aiosqlite.Connection | None = None


async def init_db():
    """
    Initialize the SQLite database and create tables if they don't exist.
    Called once on application startup.
    """
    global _db
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    _db = await aiosqlite.connect(DB_PATH)
    _db.row_factory = aiosqlite.Row

    await _db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT '',
            session_id TEXT NOT NULL,
            query TEXT NOT NULL,
            plan_steps INTEGER DEFAULT 0,
            tools_used TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auth_tokens (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    await _ensure_column(_db, "search_history", "user_id", "TEXT NOT NULL DEFAULT ''")
    await _init_search_history_fts(_db)
    await _db.commit()
    logger.info(f"Database initialized at {DB_PATH}")


async def get_db() -> aiosqlite.Connection:
    """Get the database connection, initializing if needed."""
    global _db
    if _db is None:
        await init_db()
    return _db


async def _ensure_column(db: aiosqlite.Connection, table: str, column: str, column_def: str) -> None:
    """Add a missing column for lightweight SQLite migrations."""
    async with db.execute(f"PRAGMA table_info({table})") as cursor:
        rows = await cursor.fetchall()
        cols = {row["name"] for row in rows}
    if column not in cols:
        await db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_def}")


async def _init_search_history_fts(db: aiosqlite.Connection) -> None:
    """
    Initialize FTS5 index for search_history with BM25 ranking.
    Uses external-content FTS table + triggers to keep index in sync.
    """
    await db.executescript("""
        CREATE VIRTUAL TABLE IF NOT EXISTS search_history_fts
        USING fts5(query, user_id UNINDEXED, content='search_history', content_rowid='id');

        CREATE TRIGGER IF NOT EXISTS search_history_ai AFTER INSERT ON search_history BEGIN
            INSERT INTO search_history_fts(rowid, query, user_id)
            VALUES (new.id, new.query, new.user_id);
        END;

        CREATE TRIGGER IF NOT EXISTS search_history_ad AFTER DELETE ON search_history BEGIN
            INSERT INTO search_history_fts(search_history_fts, rowid, query, user_id)
            VALUES ('delete', old.id, old.query, old.user_id);
        END;

        CREATE TRIGGER IF NOT EXISTS search_history_au AFTER UPDATE ON search_history BEGIN
            INSERT INTO search_history_fts(search_history_fts, rowid, query, user_id)
            VALUES ('delete', old.id, old.query, old.user_id);
            INSERT INTO search_history_fts(rowid, query, user_id)
            VALUES (new.id, new.query, new.user_id);
        END;
    """)
    # Backfill existing rows safely (idempotent if table was already empty/new).
    await db.execute("""
        INSERT INTO search_history_fts(rowid, query, user_id)
        SELECT sh.id, sh.query, sh.user_id
        FROM search_history sh
        LEFT JOIN search_history_fts fts ON fts.rowid = sh.id
        WHERE fts.rowid IS NULL
    """)
