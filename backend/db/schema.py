"""
Database query helpers for search_history and user auth tables.

All functions accept an aiosqlite.Connection and return dicts (not Row objects)
for easy JSON serialization.
"""

import json
import logging
import os
import hashlib
import hmac
import uuid
import aiosqlite

logger = logging.getLogger("sportscout.db.schema")

_PBKDF2_ROUNDS = 120_000


# ---------------------------------------------------------------------------
# Search History Operations
# ---------------------------------------------------------------------------
async def record_search(
    db: aiosqlite.Connection,
    user_id: str,
    session_id: str,
    query: str,
    plan_steps: int = 0,
    tools_used: list[str] | None = None,
):
    """Record a search query for analytics."""
    await db.execute(
        "INSERT INTO search_history (user_id, session_id, query, plan_steps, tools_used) VALUES (?, ?, ?, ?, ?)",
        (user_id, session_id, query, plan_steps, json.dumps(tools_used or [])),
    )
    await db.commit()


async def search_history_keywords(
    db: aiosqlite.Connection,
    user_id: str,
    query: str,
    limit: int = 5,
) -> list[dict]:
    """
    BM25-ranked keyword search over prior user queries via SQLite FTS5.
    Only searches within the same user_id.
    """
    tokens = [t.strip().lower() for t in query.split() if len(t.strip()) >= 2]
    if not tokens:
        return []

    # Prefix query terms for partial matching.
    match_query = " OR ".join(f"{t}*" for t in tokens)

    matches: list[dict] = []
    sql = """
        SELECT
            sh.id,
            sh.session_id,
            sh.query,
            sh.created_at,
            bm25(search_history_fts) AS bm25_rank
        FROM search_history_fts
        JOIN search_history sh ON sh.id = search_history_fts.rowid
        WHERE search_history_fts MATCH ?
          AND sh.user_id = ?
        ORDER BY bm25_rank ASC
        LIMIT ?
    """
    params = (match_query, user_id, max(1, min(limit, 20)))
    async with db.execute(sql, params) as cursor:
        rows = await cursor.fetchall()
        for row in rows:
            row_dict = dict(row)
            # Lower bm25 is better; expose positive relevance for UI/debug.
            bm25_rank = float(row_dict.get("bm25_rank", 0.0))
            row_dict["bm25_rank"] = bm25_rank
            row_dict["relevance_score"] = round(1.0 / (1.0 + max(0.0, bm25_rank)), 6)
            matches.append(row_dict)

    return matches


# ---------------------------------------------------------------------------
# User Auth Operations
# ---------------------------------------------------------------------------
def _hash_password(password: str, salt_hex: str) -> str:
    """Derive a PBKDF2 hash for password verification/storage."""
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        _PBKDF2_ROUNDS,
    )
    return dk.hex()


async def create_user(db: aiosqlite.Connection, username: str, password: str) -> dict:
    """Create a new user with salted password hash."""
    normalized = username.strip().lower()
    if len(normalized) < 3:
        raise ValueError("Username must be at least 3 characters.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    async with db.execute("SELECT id FROM users WHERE username = ?", (normalized,)) as cursor:
        if await cursor.fetchone():
            raise ValueError("Username already exists.")

    user_id = str(uuid.uuid4())
    salt_hex = os.urandom(16).hex()
    password_hash = _hash_password(password, salt_hex)

    await db.execute(
        "INSERT INTO users (id, username, password_hash, password_salt) VALUES (?, ?, ?, ?)",
        (user_id, normalized, password_hash, salt_hex),
    )
    await db.commit()
    return {"id": user_id, "username": normalized}


async def authenticate_user(
    db: aiosqlite.Connection,
    username: str,
    password: str,
) -> dict | None:
    """Validate username/password and return user dict on success."""
    normalized = username.strip().lower()
    async with db.execute(
        "SELECT id, username, password_hash, password_salt FROM users WHERE username = ?",
        (normalized,),
    ) as cursor:
        row = await cursor.fetchone()

    if not row:
        return None

    expected_hash = row["password_hash"]
    actual_hash = _hash_password(password, row["password_salt"])
    if not hmac.compare_digest(expected_hash, actual_hash):
        return None

    return {"id": row["id"], "username": row["username"]}


async def seed_demo_users(db: aiosqlite.Connection) -> list[str]:
    """
    Seed demo users for local testing (idempotent).

    All demo accounts use simple known passwords for interview/demo setup.
    """
    demo_users = [
        ("demo_analyst_1", "DemoPass123"),
        ("demo_analyst_2", "DemoPass123"),
        ("demo_coach_1", "DemoPass123"),
        ("demo_scout_1", "DemoPass123"),
        ("demo_admin_1", "DemoPass123"),
    ]

    created: list[str] = []
    for username, password in demo_users:
        try:
            await create_user(db, username, password)
            created.append(username)
        except ValueError:
            # Already exists (or invalid); ignore existing demo users.
            pass
    return created


# ---------------------------------------------------------------------------
# Auth Token Persistence
# ---------------------------------------------------------------------------
async def save_auth_token(db: aiosqlite.Connection, token: str, user: dict) -> None:
    """Persist an auth token to the database so it survives server restarts."""
    await db.execute(
        "INSERT OR REPLACE INTO auth_tokens (token, user_id, username) VALUES (?, ?, ?)",
        (token, user["id"], user["username"]),
    )
    await db.commit()


async def load_all_auth_tokens(db: aiosqlite.Connection) -> dict[str, dict]:
    """Load all persisted auth tokens from DB. Returns {token: {id, username}}."""
    sessions: dict[str, dict] = {}
    async with db.execute("SELECT token, user_id, username FROM auth_tokens") as cursor:
        rows = await cursor.fetchall()
        for row in rows:
            sessions[row["token"]] = {"id": row["user_id"], "username": row["username"]}
    return sessions


async def delete_auth_token(db: aiosqlite.Connection, token: str) -> None:
    """Remove a persisted auth token (on logout)."""
    await db.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
    await db.commit()
