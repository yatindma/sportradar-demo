"""
SportScout AI — FastAPI Backend Entry Point

Endpoints:
  - POST /api/chat  → SSE stream for agent interactions
  - GET  /health    → Health check
"""

import os
import json
import uuid
import asyncio
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agent import run_agent
from tools.fetch_nba_data import init_player_registry
from utils.sse import sse_event
from utils.download_store import get as get_download
from db.client import get_db
from db.schema import record_search, create_user, authenticate_user, seed_demo_users, save_auth_token, load_all_auth_tokens, delete_auth_token

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("anthropic._base_client").setLevel(logging.WARNING)
logging.getLogger("aiosqlite").setLevel(logging.WARNING)
logging.getLogger("sse_starlette").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").addFilter(lambda r: "/health" not in r.getMessage())
logger = logging.getLogger("sportscout")

conversation_history: dict[str, list[dict]] = {}
pending_approvals: dict[str, asyncio.Event] = {}
approval_results: dict[str, bool] = {}
auth_sessions: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SportScout AI backend...")
    db = await get_db()
    seeded = await seed_demo_users(db)
    if seeded:
        logger.info(f"Seeded demo users: {', '.join(seeded)}")
    # Restore persisted auth sessions from DB so tokens survive server restarts
    restored = await load_all_auth_tokens(db)
    auth_sessions.update(restored)
    logger.info(f"Restored {len(restored)} auth sessions from database")
    api_key = os.getenv("SPORTRADAR_API_KEY")
    if not api_key:
        logger.warning("SPORTRADAR_API_KEY not set — API calls will fail")
    else:
        player_count = await init_player_registry()
        logger.info(f"Player registry loaded: {player_count} players")
    yield
    logger.info("Shutting down SportScout AI backend...")


app = FastAPI(
    title="SportScout AI",
    description="NBA analytics agent with real-time streaming",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    auth_token: str


class ApprovalRequest(BaseModel):
    step_id: int
    session_id: str
    approved: bool
    auth_token: str


class AuthRequest(BaseModel):
    username: str
    password: str


def get_history(history_key: str) -> list[dict]:
    return conversation_history.get(history_key, [])[-6:]


def add_to_history(history_key: str, role: str, content: str):
    if history_key not in conversation_history:
        conversation_history[history_key] = []
    conversation_history[history_key].append({
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
    })


def _require_auth(auth_token: str) -> dict:
    user = auth_sessions.get(auth_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token")
    return user


async def process_message(message: str, session_id: str, user_id: str):
    history_key = f"{user_id}:{session_id}"
    logger.info(
        f"\n{'#'*60}\n"
        f"  📨 NEW QUERY: {message[:120]}\n"
        f"  👤 user={user_id[:12]}... | session={session_id[:12]}...\n"
        f"{'#'*60}"
    )
    try:
        db = await get_db()
        await record_search(db, user_id=user_id, session_id=session_id, query=message)
    except Exception as e:
        logger.warning(f"Failed to record search history: {e}")

    try:
        final_message = ""
        tool_summaries: list[str] = []
        async for event in run_agent(
            message=message,
            session_id=session_id,
            user_id=user_id,
            conversation_history=get_history(history_key),
            pending_approvals=pending_approvals,
            approval_results=approval_results,
        ):
            if event.get("event") == "final_response":
                final_message = event["data"].get("message", "")
            elif event.get("event") == "tool_result":
                data = event.get("data", {})
                if data.get("status") == "success" and data.get("summary"):
                    tool_summaries.append(data["summary"])
            yield event

        # Save both user and assistant messages to history AFTER agent completes
        # (not before, to avoid duplicate user messages in conversation)
        add_to_history(history_key, "user", message)
        if final_message:
            history_content = final_message
            if tool_summaries:
                history_content += "\n[Tool data used: " + "; ".join(tool_summaries) + "]"
            add_to_history(history_key, "assistant", history_content)

    except Exception as e:
        logger.error(f"Agent failed: {e}", exc_info=True)
        yield sse_event("error", {"message": f"Agent error: {str(e)}"})

    yield sse_event("stream_end", {})


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    user = _require_auth(request.auth_token)
    user_id = user["id"]
    session_id = request.session_id or str(uuid.uuid4())

    async def event_generator():
        async for event in process_message(request.message, session_id, user_id):
            event_type = event.get("event", "message")
            event_data = json.dumps(event.get("data", {}))
            yield {"event": event_type, "data": event_data}

    return EventSourceResponse(event_generator())


@app.get("/api/download/{key}")
async def download_csv(key: str):
    content = get_download(key)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found or expired")
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sportscout-{key[:8]}.csv"},
    )


@app.post("/api/approve")
async def approve_action(request: ApprovalRequest):
    user = _require_auth(request.auth_token)
    key = f"{user['id']}:{request.session_id}:{request.step_id}"
    approval_results[key] = request.approved
    event = pending_approvals.get(key)
    if event:
        event.set()
    logger.info(f"Approval {'granted' if request.approved else 'denied'} for step {request.step_id} (session={request.session_id})")
    return {"status": "ok"}


@app.post("/api/register")
async def register_endpoint(request: AuthRequest):
    db = await get_db()
    try:
        user = await create_user(db, request.username, request.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = str(uuid.uuid4())
    auth_sessions[token] = user
    await save_auth_token(db, token, user)
    logger.info(f"User registered: {user['username']} ({user['id']})")
    return {"token": token, "user": user}


@app.post("/api/login")
async def login_endpoint(request: AuthRequest):
    db = await get_db()
    await seed_demo_users(db)
    user = await authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = str(uuid.uuid4())
    auth_sessions[token] = user
    await save_auth_token(db, token, user)
    logger.info(f"User login: {user['username']} ({user['id']})")
    return {"token": token, "user": user}


class TokenRequest(BaseModel):
    auth_token: str


@app.post("/api/validate-token")
async def validate_token_endpoint(request: TokenRequest):
    """Check if a token is still valid. Returns user info or 401."""
    user = auth_sessions.get(request.auth_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token")
    return {"valid": True, "user": user}


@app.post("/api/logout")
async def logout_endpoint(request: TokenRequest):
    """Invalidate a token on both memory and DB."""
    auth_sessions.pop(request.auth_token, None)
    try:
        db = await get_db()
        await delete_auth_token(db, request.auth_token)
    except Exception as e:
        logger.warning(f"Failed to delete token from DB: {e}")
    return {"status": "ok"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "sportscout-ai", "timestamp": datetime.utcnow().isoformat()}
