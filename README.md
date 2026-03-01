# SportScout AI — NBA Analytics Agent

An agentic web application that accepts natural-language goals about NBA basketball, produces a visible execution plan, and completes tasks using both server-side tools and client-side actions.

Built for the Sportradar VIBE Coding Exercise.

## What I Built and Why

**SportScout AI** is an NBA analytics agent powered by Claude Sonnet 4.6. Rather than building a simple chatbot, I built a **plan-then-execute agent** that:

1. **Plans visibly** — For every query requiring tools, the agent first generates a lightweight numbered plan (2-5 steps) that appears in the Trace panel before any tool execution begins. Users see exactly what the agent intends to do.

2. **Executes with real tools** — 5 server-side tools that do actual work: API calls to Sportradar, pandas-powered local player search, multi-entity comparison with chart generation, session history recall, and Excel export.

3. **Acts on the client** — Agent triggers observable browser actions: radar charts, data tables, file downloads, and toast notifications.

4. **Uses knowledge visibly** — BM25-ranked search over the user's prior session queries (SQLite FTS5) surfaces relevant context from past interactions. The UI displays a "Knowledge Active" badge in the Trace panel listing which prior queries were referenced.

### Why this architecture?
- **ReAct agent** with native Claude tool_use — no fragile keyword routing. Cost is ~$0.003/call.
- **Plan-first approach** — Agent describes its strategy before executing, giving users visibility and trust.
- **SSE streaming** provides real-time visibility into every execution step.

---

## Server-Side Tools (5 tools)

| Tool | What it does | Real work |
|------|-------------|-----------|
| `query_players` | Pandas-powered local player search | Filters 500+ cached player bios by age, weight, height, college, status, and more — zero API calls |
| `fetch_sports_data` | Sportradar NBA API gateway | Direct NBA v8 HTTP calls, response trimming, 5-min caching, rate limiting |
| `compare_entities` | Multi-entity comparison | Radar/bar/histogram chart data generation, comparison tables with winner detection |
| `search_history` | BM25-ranked session history search | SQLite FTS5 keyword search over the user's prior queries to recall preferences and context |
| `generate_excel` | CSV export | Generates a downloadable CSV file from the latest table output (opens in Excel, Google Sheets, etc.) |

## Client-Side Actions (4 actions)

| Action | Trigger | Observable behavior |
|--------|---------|-------------------|
| `render_chart` | Player/team comparison | Radar, bar, histogram, scatter, pie, gaussian, or line/area chart renders inline in the conversation |
| `render_table` | Stats comparison | Data table with winner highlighting renders inline in the conversation |
| `download_file` | CSV export request | Download button appears in chat; click triggers browser CSV download |
| `show_toast` | Notable agent events | Toast notification appears |

## Knowledge Mechanism

**How it works:**

The agent has two complementary memory layers:

1. **Session history injection** — The last 6 conversation turns are automatically included in every request so the agent can reference what was just discussed.

2. **`search_history` tool (BM25 / SQLite FTS5)** — The agent can explicitly search the logged-in user's full prior query history using BM25-ranked keyword matching. This lets it recall user preferences (favourite players, teams, stat focus) from sessions beyond the immediate context window.

**UI visibility:** When `search_history` returns matches, the Trace panel shows a "Knowledge Active" badge listing which prior queries were referenced, making the recall step transparent to the user.

---

## How to Run

### Prerequisites
- Docker & Docker Compose
- Anthropic API key (Claude Sonnet 4.6)
- Sportradar NBA API key (trial tier works)

### One-Command Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your API keys

# 2. Launch
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health check: http://localhost:8000/health

### Local Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Architecture

```
User types goal
      |
React Frontend --> POST /api/chat (SSE stream)
      |
FastAPI Backend
      |
REACT AGENT (Claude Sonnet 4.6 with tool_use)
  1. Generates visible plan (text)
  2. Calls tools (up to 8 rounds, 8 tool calls max)
  3. Streams results via SSE
      |
  plan_step | tool_call | tool_result | client_action | knowledge_used | final_response
      |
React Frontend (2-panel UI: Chat + collapsible Trace sidebar; charts/tables render inline)
```

## Web Proof

Evidence of real client-server interaction:

1. **Network tab** — POST `/api/chat` returns SSE stream with `event: tool_call`, `event: tool_result`, `event: client_action` events
2. **Server execution** — `fetch_sports_data` makes real HTTP calls to `api.sportradar.com/nba/trial/v8/en/` with rate limiting and retry logic; `query_players` filters a 500+ player local dataset via pandas with zero outbound requests
3. **UI mutation** — `client_action: render_chart` causes a Recharts radar/bar/histogram chart to render inline; `client_action: download_file` surfaces a download button that triggers a browser CSV download
4. **Knowledge recall** — `event: knowledge_used` fires when `search_history` returns prior-query matches; the Trace panel shows a "Knowledge Active" badge with the matched queries

## Tradeoffs + Next Steps

### Tradeoffs Made
- **Local player dataset** — `query_players` operates on a static cache of 500+ player bios filtered via pandas. No live roster sync; stale data is the tradeoff for zero-latency, zero-API-cost player lookups.
- **In-memory cache** — TTL cache is per-process. Fine for single-instance demo; Redis needed for production.
- **SQLite** — Chosen for zero-config setup. PostgreSQL for production.
- **No auth** — Single-user demo. Production needs session auth.
- **ReAct over pipeline** — Single-agent loop is simpler and more robust than a separate Planner/Worker/Narrator pipeline. Tradeoff: less granular control over planning vs execution phases.

### Next Steps
- **Parallel tool execution** — Tools without dependencies could run concurrently
- **Langfuse integration** — Observability traces for cost/latency monitoring
- **Live roster sync** — Periodically refresh the local player dataset from full team rosters
- **More client actions** — Sortable tables, highlight animations, comparison overlays
- **Persistent sessions** — Redis-backed conversation history for multi-session support

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| LLM | Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Backend | FastAPI | 0.135.1 |
| Frontend | React + Vite | React 18, Vite 6 |
| Styling | Tailwind CSS | v4 |
| Charts | Recharts | 2.15 |
| Animations | Framer Motion | 12.x |
| Database | SQLite (aiosqlite) | 0.20 |
| API Client | Anthropic Python SDK | 0.84.0 |
| Sports Data | Sportradar NBA API | v8 |
| Streaming | SSE (sse-starlette) | 2.2.1 |
