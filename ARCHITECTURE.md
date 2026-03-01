# SportScout AI — Architecture Guide

## Kya Hai Yeh?

NBA analytics agent — user natural language mein poochta hai, AI agent KHUD decide karta hai kya tools call kare, results DEKHTA hai, aur phir decide karta hai aur tools chahiye ya response likh de. Sab LIVE stream hota hai frontend pe 3 panels mein.

```
User Query → Agent (Claude Sonnet) ←→ Tools (fetch/analyze/compare/watchlist) → Final Response → Frontend
                                   ↑                                          ↓
                                   └── Agent SEES results, decides next step ─┘
```

**ReAct Pattern:** Agent thinks → acts → observes → thinks again. Max 2 rounds, then responds.

---

## Architecture — ReAct Agent (Single Agent, No Planner/Worker/Narrator)

### OLD Architecture (Deleted):
```
Planner (Sonnet) → Worker (blind execution) → Recovery (Sonnet) → Narrator (Haiku)
3-4 LLM calls, lossy handoffs, narrator never saw actual data
```

### NEW Architecture:
```
User: "Compare LeBron vs Curry"
  ↓
Agent (Sonnet): "I need both profiles"
  → calls fetch_sports_data(LeBron) + fetch_sports_data(Curry)
  ← SEES actual data: "LeBron 25.3 PPG, Curry 26.8 PPG"
  ↓
Agent: "Now let me compare them visually"
  → calls compare_entities([LeBron, Curry])
  ← SEES chart generated
  ↓
Agent: "I have everything. Here's my analysis:
  LeBron leads in rebounds (7.2 vs 4.5) while Curry dominates 3PT% (42.1% vs 35.8%)..."
```

**1 LLM conversation.** Agent sees ALL data. No handoff loss. No separate narrator needed.

---

## 4 Tools — Kya Karta Hai Kaun

### 1. `fetch_sports_data` — DATA LAANE WALA

Sportradar NBA API ka **single gateway**. Saara real-world data isi se aata hai.

| Query Type | Kya Milta Hai | Example |
|---|---|---|
| `player_profile` | Bio + season averages (PPG, RPG, APG, FG%) + career + injury | "LeBron stats dikhao" |
| `player_game_logs` | Full season game-by-game data | "Luka ke recent games" |
| `standings` | Conference standings (W-L, streak) | "Eastern conference standings" |
| `game_scores` | Aaj ke scores / schedule | "Aaj NBA mein kya hua?" |
| `league_leaders` | Top scorers, rebounders, etc. | "Assists mein kaun lead karta hai?" |

**Smart Trimming:** 50KB raw → ~2-3KB useful data (name, team, season_stats, career, draft, injury). Full raw always in cache.

**Features:**
- 1 req/sec rate limit with retry + exponential backoff
- In-memory cache (5 min TTL)
- 180+ player fuzzy name registry

---

### 2. `analyze_stats` — MATH WALA

**Zero API calls.** Pehle fetch hua data le ke statistical analysis karta hai.

| Analysis Type | Kya Karta Hai |
|---|---|
| `percentile_rank` | Player stats vs league average |
| `trend_analysis` | First half vs second half — trending up ya down? |
| `per_36_normalize` | Stats normalize to per-36-min |
| `hot_cold_streak` | Recent games mein hot/cold streaks detect |
| `efficiency_score` | PER-like composite + letter grade (A+ to D) |

**Depends on:** Prior `fetch_sports_data` call. Agent knows this — it fetches first, then analyzes.

---

### 3. `compare_entities` — VISUAL SHOWSTOPPER

2-4 players/teams compare → **Radar Chart + Comparison Table** generate.

**Depends on:** Prior `fetch_sports_data` for each entity.

**Client actions:** `render_chart` (radar) + `render_table` (comparison) → ResultsPanel pe dikhta hai.

---

### 4. `manage_watchlist` — DATABASE + APPROVAL

SQLite watchlist. Write ops pe user approval required.

| Action | Approval? |
|---|---|
| `add` | YES — ApprovalModal |
| `remove` | YES |
| `update` | YES |
| `list` | NO — read-only |

---

## Agent Tool Chaining — How It Works

Agent KHUD decide karta hai tools kaise chain kare. `context` dict accumulates results — `{step_id: result}`.

**Simple Query:** "LeBron stats"
```
Round 1: Agent calls fetch_sports_data(player_profile, LeBron)
         Agent SEES the result → writes response with actual numbers
         Done in 1 round.
```

**Comparison:** "Compare LeBron vs Curry"
```
Round 1: Agent calls fetch_sports_data(LeBron) + fetch_sports_data(Curry)
         Both run, agent SEES both profiles
Round 2: Agent calls compare_entities([LeBron, Curry])
         Agent SEES chart generated → writes comparison response
```

**Deep Analysis:** "Jokic ki efficiency aur streaks"
```
Round 1: Agent calls fetch_sports_data(profile) + fetch_sports_data(game_logs)
Round 2: Agent calls analyze_stats(efficiency) + analyze_stats(hot_cold_streak)
         Agent SEES all results → writes comprehensive analysis
```

**Max 2 rounds of tool calls.** After round 2, agent MUST respond with what it has. Safety cap: 8 total tool calls per request.

---

## Context Management — Kya Data Kahan Jaata Hai

### For Tool Chaining (context dict):
- Full tool results stored in `context[step_id]`
- Next tools read from context (e.g., analyze_stats reads player data from prior fetch)
- Full 2-3KB trimmed data available

### For Claude's Conversation (concise):
- Tool results sent back to Claude as `_format_for_claude()` — concise version
- Player profiles: season_stats + career (no raw game arrays)
- Game logs: last 10 games + total count (not full 82)
- Compare results: summary + leaders only (chart data is for frontend, not Claude)
- This keeps Claude's context window lean (~500-1000 tokens per tool result)

### For Frontend (SSE events):
- `tool_result` events carry summary + data
- `client_action` events trigger chart/table rendering

---

## SSE Event Flow — Backend → Frontend

```
1. agent_thinking     → Agent ki reasoning (optional, jab tools ke saath text aaye)
2. plan_step (running) → Tool execution start — TracePanel mein glow
3. tool_call           → Tool name + params (expandable in trace)
4. tool_retry          → Rate limit retry (attempt 2/3, backoff 3s)
5. tool_result         → Success/fail + elapsed time
6. client_action       → render_chart / render_table / show_toast
7. plan_step (done)    → Green checkmark in TracePanel
8. response_chunk      → Final response TOKEN-BY-TOKEN stream
9. final_response      → Complete response for chat history
10. stream_end         → Done, UI reset
```

**Removed events** (no longer needed):
- `planning_started` — no separate planning phase
- `planning_thinking` — agent thinks inline
- `planning_complete` — no pre-planned steps
- `plan_step (pending)` — steps aren't pre-planned, they appear as agent calls them

---

## Safety Limits

| Limit | Value | Why |
|---|---|---|
| Max tool rounds | 2 | Prevents infinite loops |
| Max total tool calls | 8 | Safety cap per request |
| Approval timeout | 120 seconds | User must respond or action is denied |
| Rate limit | 1 req/sec (Sportradar) | API tier restriction |
| Cache TTL | 5 minutes | Avoid redundant API calls |

---

## Frontend 3-Panel Layout

```
┌─────────────────┬──────────────────┬─────────────────┐
│   CHAT PANEL    │   TRACE PANEL    │  RESULTS PANEL  │
│   (33% width)   │   (32% width)    │  (35% width)    │
│                 │                  │                 │
│ • Conversation  │ • Tool calls     │ • Radar Chart   │
│ • Live typing   │ • Tool results   │ • Stats Table   │
│   with cursor   │ • Retries        │                 │
│ • User/AI       │ • LIVE badge     │ • Empty state   │
│   messages      │ • Elapsed times  │   until data    │
└─────────────────┴──────────────────┴─────────────────┘
                    INPUT BAR (bottom)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, Framer Motion, Recharts, Tailwind CSS |
| Backend | FastAPI, SSE-Starlette, Python 3.11 |
| AI | Claude Sonnet 4.6 (single agent with tool_use) |
| Data | Sportradar NBA API v8 |
| Database | SQLite (watchlist) |
| Streaming | Server-Sent Events (SSE) |
| Pattern | ReAct (Reason + Act) agent loop |

---

## Cost Per Query

| Query Type | Tools Called | Approx Cost |
|---|---|---|
| Simple (standings, scores) | 1 tool, 1 round | ~$0.005 |
| Player lookup | 1-2 tools, 1 round | ~$0.008 |
| Comparison (2 players) | 3-4 tools, 2 rounds | ~$0.015 |
| Deep analysis (efficiency + streaks) | 4-5 tools, 2 rounds | ~$0.020 |

All costs at Claude Sonnet 4.6 pricing: $3/MTok input, $15/MTok output.
