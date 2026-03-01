# SportScout AI — Deep Dive Guide (Hinglish)

> Yatin ke liye: Pura system kaise kaam karta hai — LLM se lekar tools tak, tool calling se lekar response tak.

---

## 📖 Table of Contents

1. [Bada Picture — System Overview](#1-bada-picture)
2. [LLM (Claude Sonnet) — Dimaag](#2-llm-claude-sonnet)
3. [ReAct Agent Loop — Core Engine](#3-react-agent-loop)
4. [Tool Definitions — Claude ko kya dikhte hai](#4-tool-definitions)
5. [5 Tools — Ek Ek ka Deep Dive](#5-5-tools)
6. [Tool Calling — Kaise hota hai step by step](#6-tool-calling)
7. [Context Management — Data ka Flow](#7-context-management)
8. [SSE Response — Frontend ko kaise milta hai](#8-sse-response)
9. [Approval Flow — User Permission System](#9-approval-flow)
10. [Full Example Walkthrough](#10-full-example-walkthrough)
11. [Safety & Smart Features](#11-safety--smart-features)

---

## 1. Bada Picture

```
User: "Compare LeBron vs Curry"
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React)                                    │
│  POST /api/chat { message, session_id }              │
│  EventSource se SSE events sunte hai                 │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  BACKEND (FastAPI — main.py)                         │
│  process_message() → run_agent() call karta hai      │
│  SSE events yield karta hai EventSourceResponse mein │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  REACT AGENT (agent.py)                              │
│  Claude Sonnet se baat karta hai                     │
│  Tools execute karta hai                             │
│  Results Claude ko wapas bhejta hai                  │
│  Final response stream karta hai                     │
└─────────────────────┬───────────────────────────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│  TOOLS (5 tools) │  │  CLAUDE SONNET   │
│  Python classes   │  │  (Anthropic API) │
│  execute() method │  │  tool_use feature│
└──────────────────┘  └──────────────────┘
```

**Ek line mein:** User bolta hai → Agent Claude se poochta hai kya karna hai → Claude bolta hai kaunsa tool call karo → Agent tool execute karta hai → Result Claude ko dikhata hai → Claude ya toh aur tools maangta hai ya final answer likhta hai → Response SSE se frontend pe stream hota hai.

---

## 2. LLM (Claude Sonnet) — Dimaag

### Kya hai:
Claude Sonnet 4.6 (`claude-sonnet-4-6`) — Anthropic ka LLM model. Ye sirf TEXT generate nahi karta, balki **tool_use** feature ke through tools bhi call kar sakta hai.

### Kaise connect hota hai:
```python
# agent.py — line 60
from anthropic import AsyncAnthropic
client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
```
`AsyncAnthropic` class use hoti hai — ye Anthropic ka official Python SDK hai. Async hai kyunki FastAPI async framework hai.

### Claude ko kya milta hai har request mein:

| Cheez | Kya hai | Kahan se aata hai |
|-------|---------|-------------------|
| `system` prompt | 170-line instruction set | `AGENT_SYSTEM_PROMPT` (agent.py:359) |
| `messages` | Conversation history + current question | `messages[]` array |
| `tools` | 7 tool definitions (JSON Schema) | `TOOL_DEFINITIONS` (agent.py:108) |
| `max_tokens` | 4096 | Hardcoded |
| `model` | `claude-sonnet-4-6` | `MODEL` env var |

### Claude kya return karta hai:
Claude ka response `content` array mein aata hai jismein 2 type ke blocks ho sakte hai:

```python
# Type 1: TEXT block — Claude ki soch / response
{"type": "text", "text": "Let me compare these two players..."}

# Type 2: TOOL_USE block — Claude tool call karna chahta hai
{
    "type": "tool_use",
    "id": "toolu_01ABC123",            # Unique ID (response mapping ke liye)
    "name": "fetch_sports_data",        # Kaunsa tool
    "input": {                          # Tool ke parameters
        "query_type": "player_profile",
        "name": "LeBron James"
    }
}
```

**KEY INSIGHT:** Claude DECIDE karta hai kaunsa tool call kare. Humne koi `if-else` nahi likha. Claude system prompt + tool definitions padhta hai aur KHUD decide karta hai.

### System Prompt ka Role:
System prompt (agent.py:359-528) Claude ko batata hai:
- **Scope:** Sirf NBA/basketball. Off-topic = one-liner refusal.
- **Decision Flow:** Pehle ambiguity check karo, phir plan batao, phir tools call karo.
- **Tool Usage Rules:** Kaunsa tool kab use karna hai, dependencies kya hai.
- **Response Style:** Short, punchy, data-driven. ESPN analyst jaisa, Wikipedia nahi.
- **Failure Handling:** Ek line mein batao kya fail hua, lambi apology mat do.

---

## 3. ReAct Agent Loop — Core Engine

### ReAct kya hai:
**Re**ason + **Act** = **ReAct**. Ye AI research paper (Yao et al., 2022) se aaya pattern hai.

Traditional chatbot:
```
User asks → LLM answers (one shot, no tools)
```

ReAct agent:
```
User asks → LLM THINKS ("I need LeBron's data")
          → LLM ACTS (calls fetch_sports_data)
          → LLM OBSERVES (sees the actual API data)
          → LLM THINKS again ("Now I can compare")
          → LLM ACTS (calls compare_entities)
          → LLM OBSERVES (sees chart generated)
          → LLM RESPONDS ("LeBron leads in rebounds...")
```

### Agent Loop Code (agent.py:690-1081):

```python
async def run_agent(message, session_id, ...):
    # Build messages array with history + current question
    messages = [...]

    context = {}           # Full tool results (for tool chaining)
    total_tool_calls = 0   # Safety counter

    for round_num in range(MAX_TOOL_ROUNDS + 1):  # 0, 1, 2
        is_last_round = (round_num == MAX_TOOL_ROUNDS)  # round 2 = last

        if is_last_round:
            # ❌ Tools band. Claude ko sirf text likhna hai.
            # Streaming mode ON — token by token response
            async with client.messages.stream(**api_kwargs) as stream:
                async for text in stream.text_stream:
                    yield sse_event("response_chunk", {"chunk": text})
            break

        else:
            # ✅ Tools available. Non-streaming call.
            api_kwargs["tools"] = TOOL_DEFINITIONS
            response = await client.messages.create(**api_kwargs)

            # Claude ne tool_use blocks return kiye?
            tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

            if not tool_use_blocks:
                # Claude ne directly answer de diya (no tools needed)
                yield final response
                break

            # Tools execute karo...
            for block in tool_use_blocks:
                tool = get_tool(block.name)
                result = await tool.execute(block.input, context=context)
                context[step_id] = result  # Save for next tools

                # Result wapas Claude ko bhejo
                tool_results_content.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,  # Mapping back to request
                    "content": json.dumps(concise_result)
                })

            # Tool results ko messages mein add karo
            messages.append({"role": "user", "content": tool_results_content})
            # Loop continues → Claude gets tool results → decides next action
```

### Round by Round:

| Round | Tools? | Kya hota hai | Claude ko kya milta hai |
|-------|--------|-------------|------------------------|
| 0 | ✅ YES | Claude tools call kar sakta hai ya directly respond | System prompt + history + user message + tool definitions |
| 1 | ✅ YES | Claude round 0 ke results dekhta hai, aur tools call kare ya respond | Previous messages + tool results from round 0 |
| 2 | ❌ NO | Tools BAND. Claude ko text response likhna PADTA hai | Previous messages + all results, but NO tool definitions |

### Kyun 3 rounds (0, 1, 2)?
- **Round 0:** Data fetch karo (parallel mein bhi ho sakta hai)
- **Round 1:** Fetched data pe analysis/comparison karo
- **Round 2:** Ab kuch bhi ho, response LIKHNA hai (infinite loop prevention)

### Non-streaming vs Streaming:
- **Round 0-1 (tool rounds):** `client.messages.create()` — NON-streaming. Kyunki pura response chahiye tool_use blocks extract karne ke liye.
- **Round 2 (final):** `client.messages.stream()` — STREAMING. Token-by-token response for better UX.

---

## 4. Tool Definitions — Claude ko kya dikhte hai

Claude ko tools **JSON Schema** format mein milte hai. Ye Anthropic ke `tool_use` API ka standard format hai.

```python
# agent.py:108-353 — TOOL_DEFINITIONS array

# Ek tool definition ka structure:
{
    "name": "fetch_sports_data",          # Tool ka naam (Claude isi naam se call karega)
    "description": "Fetch live NBA...",   # Claude ye padhta hai decide karne ke liye
    "input_schema": {                     # JSON Schema — Claude iske hisaab se params generate karta hai
        "type": "object",
        "properties": {
            "query_type": {
                "type": "string",
                "enum": ["player_profile", "player_game_logs", "standings", "game_scores", "league_leaders"],
                "description": "Type of NBA data to fetch"
            },
            "name": {
                "type": "string",
                "description": "Player name..."
            }
        },
        "required": ["query_type"]        # Claude ko ye dena PADEGA
    }
}
```

### Claude kaise decide karta hai kaunsa tool use kare?

1. **Description padhta hai** — "Fetch live NBA data" vs "Compare 2-4 players/teams"
2. **System prompt ke rules** follow karta hai — "Call fetch_sports_data BEFORE compare_entities"
3. **input_schema** dekhta hai — kaunse params chahiye, kaunse optional hai
4. **Conversation context** se — pehle kya hua tha, ab kya chahiye

**Important:** Koi hardcoded routing nahi hai. Koi `if "compare" in message` nahi hai. Claude ka LLM brain decide karta hai.

### 5 Tool Definitions Summary:

| # | Tool Name | Claude ko kya bataya | Required Params |
|---|-----------|---------------------|-----------------|
| 1 | `query_players` | "Search 500+ NBA players from local cache using pandas query" | `query` (pandas expression) |
| 2 | `fetch_sports_data` | "Fetch live NBA data from Sportradar API" | `query_type` |
| 3 | `compare_entities` | "Generate comparison charts and tables" | `entities` (2-4 names) |
| 4 | `search_history` | "BM25/FTS5 keyword search over user's prior session queries" | `query` |
| 5 | `generate_excel` | "Generate downloadable Excel (.xls) export, triggers browser download" | `title` |

---

## 5. 5 Tools — Ek Ek ka Deep Dive

### Tool Protocol (tools/__init__.py):
Har tool ek class hai jo ek `execute()` method implement karta hai:

```python
class Tool(Protocol):
    name: str
    description: str

    async def execute(
        self,
        params: dict,        # Claude ke tool_use se aaye params
        context: dict | None  # Previous tool results (chaining ke liye)
    ) -> dict:
        # Returns: {"data": ..., "summary": "...", "client_action": ...}
```

### Tool Registry (tools/__init__.py:62-70):
```python
TOOL_REGISTRY = {
    "query_players": QueryPlayersRegistryTool(),
    "fetch_sports_data": FetchSportsDataTool(),
    "compare_entities": CompareEntitiesTool(),
    "search_history": SearchHistoryTool(),
    "generate_excel": GenerateExcelTool(),
}
```

Singleton instances. `get_tool("fetch_sports_data")` se instance milta hai.

---

### Tool 1: `query_players` — Pandas Database Search

**File:** `tools/fetch_nba_data.py` → `QueryPlayersRegistryTool` class (line 216)

**Kya karta hai:** 500+ NBA players ka cached data Pandas DataFrame mein load karta hai, phir Claude ka pandas query expression run karta hai.

**ZERO API calls.** Sab local computation.

**Kaise kaam karta hai:**

```
Step 1: _get_dataframe() — Registry dict → Pandas DataFrame
        ├── Player registry se data uthata hai (500+ players)
        ├── Derived columns banata hai:
        │   ├── age (birthdate se calculate)
        │   ├── weight_kg (lbs * 0.453592)
        │   ├── height_cm (inches * 2.54)
        │   └── height_display ("6'8"")
        └── DataFrame daily rebuild hota hai (age accuracy ke liye)

Step 2: df.query(user_query) — Pandas query execute
        ├── "age < 24" → DataFrame.query("age < 24")
        ├── "weight_kg < 80 and position == 'G'" → compound filter
        └── Error hone pe: columns list + dtypes bhi return (Claude fix kar sake)

Step 3: Sort + Limit + Column selection
        ├── sort_by param se sort
        ├── limit (default 25)
        └── specific columns select

Step 4: .to_dict(orient="records") → List of dicts return
```

**Claude kaise use karta hai:**
```
User: "Which players are under 24 years old?"
Claude: tool_use → query_players(query="age < 24", sort_by="age")
Result: {"data": {"players": [...], "total": 45, "query": "age < 24"}, "summary": "Found 45 players..."}
```

**Player Registry kahan se aata hai:**
```
First Startup:
  Sportradar API → League Hierarchy (1 call) + 30 Team Profiles (30 calls) = 31 API calls
  → data/player_registry.json saved to disk

Subsequent Startups:
  data/player_registry.json → load from disk (ZERO API calls)
```

---

### Tool 2: `fetch_sports_data` — Live API Gateway

**File:** `tools/fetch_nba_data.py` → `FetchSportsDataTool` class (line 365)

**Kya karta hai:** Sportradar NBA API v8 se REAL-TIME data laata hai.

**5 query types:**

| query_type | Kya milta hai | API Endpoint |
|-----------|---------------|-------------|
| `player_profile` | Bio + season averages + career + injury | `/players/{id}/profile.json` |
| `player_game_logs` | Game-by-game stats (full season) | `/seasons/{year}/REG/players/{id}/statistics.json` |
| `standings` | Conference standings (W-L, streak) | `/seasons/{year}/REG/standings.json` |
| `game_scores` | Day ke scores/schedule | `/games/{date}/schedule.json` |
| `league_leaders` | Top scorers, rebounders, etc. | `/seasons/{year}/REG/leaders.json` |

**Player Name Resolution (4-tier):**
```
User types: "Lebrone"  (typo)
     │
     ▼
Tier 1: EXACT MATCH
     "lebrone" in registry? → NO
     │
     ▼
Tier 2: SUBSTRING MATCH
     "lebrone" in any known name? → NO
     Any known name in "lebrone"? → NO
     │
     ▼
Tier 3: TOKEN MATCH
     All tokens of "lebrone" in any name? → NO
     │
     ▼
Tier 4: FUZZY MATCH (thefuzz library)
     fuzz.token_sort_ratio("lebrone", "lebron james") = 85 → HIGH CONFIDENCE
     Auto-resolve → "LeBron James" ✅

     Agar multiple high-confidence matches → ValueError with candidates
     Claude user se poochega: "Did you mean X or Y?"
```

**Diacritics Handling:**
```python
"Jokić" → normalize("NFKD") → "Jokic" (accent removed)
"Dončić" → "Doncic"
```

**Data Trimming:**
50KB raw Sportradar response → 2-3KB trimmed (name, team, position, season_stats, career, draft, injury).

**Registry Enrichment (line 448-467):**
Player profile response mein cached bio data (team, position, height, weight, college, draft) bhi inject hota hai. Ek call mein sab milta hai.

---

### Tool 3: `compare_entities` — Visual Comparison

**File:** `tools/compare_entities.py` → `CompareEntitiesTool` class (line 123)

**Kya karta hai:** 2-4 players/teams ko compare karta hai → radar chart data + comparison table generate karta hai → frontend pe render hota hai.

**2 Modes:**

#### Mode A: Head-to-Head Player Comparison
```
Input: entities=["LeBron James", "Stephen Curry"]
  │
  ├── Step 1: Context se player data dhoondho
  │   _extract_player_from_context() → context mein naam match karo
  │   Nahi mila? → Fresh fetch from Sportradar API
  │
  ├── Step 2: Radar Data (normalized 0-100)
  │   Har category ke liye:
  │     normalized = min(100, (raw_val / max_val) * 100)
  │     max_vals: ppg=40, rpg=15, apg=12, spg=2.5, bpg=3.5, fg_pct=70, etc.
  │
  │   Output: [
  │     {"category": "Points", "LeBron James": 63.3, "Stephen Curry": 67.0},
  │     {"category": "Rebounds", "LeBron James": 48.0, "Stephen Curry": 30.0},
  │     ...
  │   ]
  │
  ├── Step 3: Table Data (raw values)
  │   columns: ["Stat", "LeBron James", "Stephen Curry"]
  │   rows: [["Team", "Lakers", "Warriors"], ["Points", 25.3, 26.8], ...]
  │
  ├── Step 4: Leaders detection
  │   Har category mein kaun aage: {"Points": "Stephen Curry", "Rebounds": "LeBron James", ...}
  │
  └── Step 5: Client Actions emit
      client_action: [
        {"type": "render_chart", "payload": {"chart_type": "radar", "data": radar_data, "players": [...]}},
        {"type": "render_table", "payload": table_data}
      ]
```

#### Mode B: Distribution Chart (Population)
```
Jab entities < 2 BUT context mein query_players result hai:
  → Distribution/histogram mode activate

Input: query_players ne 200 players diye → compare_entities(chart_type="histogram")
  │
  ├── _extract_query_players_rows() → context se player rows uthao
  ├── _pick_distribution_field() → numeric column choose (age/weight/height)
  ├── Frequency buckets banao: {20: 15, 21: 22, 22: 30, ...}
  └── client_action: render_chart(histogram) + render_table
```

**8 Supported Chart Types:**
`radar`, `bar`, `line`, `area`, `pie`, `scatter`, `histogram`, `gaussian`

---

### Tool 4: `search_history` — Session Query Search

**File:** `tools/search_history.py` → `SearchHistoryTool` class

**Kya karta hai:** Current user ke prior session queries pe BM25 keyword search karta hai (SQLite FTS5). Ye knowledge base NAHI hai — ye user ki apni query history hai.

**Actual Knowledge Mechanism:**
```
search_history:
  - SQLite FTS5 virtual table pe BM25 ranking
  - Is user ki prior queries is session mein stored hoti hai
  - Keyword match karta hai — fuzzy nahi, BM25/FTS5 hai

Session history:
  - Last 6 conversation turns har agent request mein inject hote hai
  - Agent ko context milta hai previous questions ka
```

**Claude kaise use karta hai:**
```
User: "Kuch aur details do"
Claude: search_history(query="player comparison stats")
Result: [{"query": "Compare LeBron vs Curry", "timestamp": "..."}, ...]
Claude uses history context to understand what the user was asking about
```

**Knowledge Attribution:**
Result mein `knowledge_used` field hota hai → SSE `knowledge_used` event → Frontend mein "Knowledge Active" badge dikhta hai (Trace panel mein).

---

### Tool 5: `generate_excel` — File Downloads

**File:** `tools/generate_excel.py` → `GenerateExcelTool` class

**Kya karta hai:** Previous tool results se Excel (.xls) file generate karta hai → browser download trigger karta hai.

**Kaise kaam karta hai:**
```
1. Context ke saare previous results iterate karo
2. Exportable data collect karo:
   - Player profiles → name + team + season_stats
   - Game logs → per-game rows (max 50)
   - Standings → team records
   - League leaders → ranked entries
3. Excel .xls file generate karo
4. client_action emit:
   {"type": "download_file", "payload": {"filename": "lebron_stats.xls", "content": "...", "mime_type": "application/vnd.ms-excel"}}
5. Frontend receives → browser download trigger
```

---

## 6. Tool Calling — Kaise hota hai step by step

### Pura Flow (Code Level):

```
Step 1: Claude API Call
─────────────────────────────
agent.py:818
response = await client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=AGENT_SYSTEM_PROMPT,
    messages=messages,
    tools=TOOL_DEFINITIONS,      ← Ye 5 tools ka JSON schema hai
)

Step 2: Response Parse
─────────────────────────────
agent.py:821-822
tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
text_blocks = [b for b in response.content if b.type == "text"]

Claude response example:
  content: [
    TextBlock(text="Let me fetch both players' profiles."),
    ToolUseBlock(id="toolu_01A", name="fetch_sports_data", input={"query_type": "player_profile", "name": "LeBron James"}),
    ToolUseBlock(id="toolu_01B", name="fetch_sports_data", input={"query_type": "player_profile", "name": "Stephen Curry"}),
  ]

Step 3: Plan Steps Emit (Pending)
─────────────────────────────
agent.py:893-906
Pehle SAARE steps frontend ko "pending" status mein bhejo:
  yield sse_event("plan_step", {id: 1, tool: "fetch_sports_data", status: "pending"})
  yield sse_event("plan_step", {id: 2, tool: "fetch_sports_data", status: "pending"})
Frontend pe sab steps ek saath dikhte hai plan jaisa.

Step 4: Execute Each Tool
─────────────────────────────
agent.py:920-1078
for step_id, block, tool_name, params, description in planned_calls:

  4a. Status → "running"
      yield sse_event("plan_step", {id: step_id, status: "running"})
      yield sse_event("tool_call", {tool: "fetch_sports_data", params: {...}})

  4b. Approval Check (none of the current 5 tools require approval)
      # No tools currently trigger the approval flow

  4c. Execute Tool
      tool = get_tool(tool_name)                    ← Registry se tool instance
      result = await tool.execute(params, context)   ← Actual execution

  4d. Save Result to Context
      context[step_id] = result                      ← Next tools can read this

  4e. Emit SSE Events
      yield sse_event("tool_result", {status: "success", elapsed_ms: 450, summary: "..."})
      yield sse_event("plan_step", {id: step_id, status: "done"})

      # Client actions (charts, tables, toasts)
      if result.get("client_action"):
          yield sse_event("client_action", action)

      # Knowledge attribution (search_history results)
      if result.get("knowledge_used"):
          yield sse_event("knowledge_used", {...})

  4f. Format Concise Result for Claude
      claude_result = _format_for_claude(tool_name, result)
      tool_results_content.append({
          "type": "tool_result",
          "tool_use_id": block.id,         ← Maps back to Claude's request
          "content": json.dumps(claude_result)
      })

Step 5: Send Results Back to Claude
─────────────────────────────
agent.py:1081
messages.append({"role": "user", "content": tool_results_content})
# Ab loop wapas jaayega → Claude gets these results → decides next action
```

### Tool Result ka Format:
Har tool return karta hai:
```python
{
    "data": { ... },           # Full result data
    "summary": "...",          # One-line human readable
    "client_action": { ... },  # Frontend rendering instructions (optional)
    "knowledge_used": [ ... ], # Session history references (only search_history)
}
```

---

## 7. Context Management — Data ka Flow

### 2 Parallel Data Tracks:

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  FULL CONTEXT (context dict)     │  │  CLAUDE's CONVERSATION          │
│                                  │  │  (messages array)               │
│  context[step_id] = full result  │  │                                 │
│  2-3KB per tool result           │  │  _format_for_claude() →         │
│                                  │  │  concise version only           │
│  USED BY: compare_entities reads │  │  500-1000 tokens per result     │
│  from prior fetch results        │  │                                 │
│                                  │  │  USED BY: Claude to decide      │
│  LIVES IN: Python dict in memory │  │  next action / write response   │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### Kyun 2 tracks?

**Problem:** Sportradar API 50KB raw data deta hai. Agar ye Claude ke context window mein jaaye toh:
- Cost badh jaaye (token billing)
- Context window jaldi bhar jaaye
- Claude confused ho sakta hai itne data se

**Solution:**
- **Full data** stays in `context` dict (Python memory) — tools ke liye
- **Concise version** Claude ko jaata hai — `_format_for_claude()` se

### `_format_for_claude()` (agent.py:534) — Kya trim karta hai:

| Tool | Full Result | Claude ko kya milta hai |
|------|------------|------------------------|
| `fetch_sports_data` (profile) | Full profile + raw stats | name, team, position, season_stats, career, registry |
| `fetch_sports_data` (game_logs) | 82 games ka full data | Last 10 games + total count |
| `compare_entities` | radar_data + table_data + leaders | summary, players, leaders ONLY (chart data nahi — wo frontend ke liye hai) |
| `query_players` | Player list | Pass through (already concise) |
| Others | Full result | summary + data as-is |

### Tool Chaining Example:

```
Round 0:
  Claude calls: fetch_sports_data(player_profile, "LeBron")
                fetch_sports_data(player_profile, "Curry")
  Result saved: context[1] = {data: {name: "LeBron James", season_stats: {ppg: 25.3, ...}}}
               context[2] = {data: {name: "Stephen Curry", season_stats: {ppg: 26.8, ...}}}

Round 1:
  Claude calls: compare_entities(entities=["LeBron James", "Stephen Curry"])

  Inside compare_entities.execute():
    player1 = _extract_player_from_context("LeBron James", context)
    # Iterates context dict → finds context[1] → name matches "LeBron James"
    player2 = _extract_player_from_context("Stephen Curry", context)
    # Finds context[2] → name matches "Stephen Curry"
    # Computes radar chart data + comparison table

  This works because context[1] and context[2] have FULL data from round 0.
```

---

## 8. SSE Response — Frontend ko kaise milta hai

### SSE (Server-Sent Events) kya hai:
HTTP connection jo OPEN rehta hai. Server events push karta hai, client sunta hai. WebSocket jaisa but simpler — unidirectional (server → client).

### Event Flow:

```
Frontend: POST /api/chat { message: "Compare LeBron vs Curry", session_id: "abc" }
  ↓
Backend: EventSourceResponse(event_generator())
  ↓ (SSE stream starts)

EVENT 1: knowledge_used
  data: {"sources": [{"type": "watchlist", "count": 3}, {"type": "session_history", "count": 2}]}
  → Frontend: "Knowledge Active" badge show

EVENT 2: agent_thinking
  data: {"thinking": "I'll fetch both players' profiles first."}
  → Frontend: TracePanel mein thinking text show

EVENT 3: plan_step (pending)
  data: {"id": 1, "tool": "fetch_sports_data", "description": "Fetching LeBron profile", "status": "pending"}
  → Frontend: Step 1 grey/pending state mein dikhao

EVENT 4: plan_step (pending)
  data: {"id": 2, "tool": "fetch_sports_data", "description": "Fetching Curry profile", "status": "pending"}
  → Frontend: Step 2 bhi pending

EVENT 5: plan_step (running)
  data: {"id": 1, "status": "running"}
  → Frontend: Step 1 glow/spinner

EVENT 6: tool_call
  data: {"step_id": 1, "tool": "fetch_sports_data", "params": {"query_type": "player_profile", "name": "LeBron James"}}
  → Frontend: Expandable details dikhao (kaunsa tool, kya params)

EVENT 7: tool_result
  data: {"step_id": 1, "status": "success", "elapsed_ms": 850, "summary": "LeBron James: 25.3 PPG..."}
  → Frontend: Success indicator + time shown

EVENT 8: plan_step (done)
  data: {"id": 1, "status": "done"}
  → Frontend: Green checkmark ✅

... (same for step 2) ...

EVENT 12: plan_step (running) — Step 3: Compare
EVENT 13: tool_call — compare_entities
EVENT 14: tool_result — comparison data
EVENT 15: client_action
  data: {"type": "render_chart", "payload": {"chart_type": "radar", "data": [...], "players": [...]}}
  → Frontend: ResultsPanel mein RADAR CHART render!

EVENT 16: client_action
  data: {"type": "render_table", "payload": {"columns": [...], "rows": [...]}}
  → Frontend: ResultsPanel mein COMPARISON TABLE render!

EVENT 17: plan_step (done) — Step 3 done ✅

EVENT 18-N: response_chunk (token by token)
  data: {"chunk": "LeBron"}
  data: {"chunk": " leads"}
  data: {"chunk": " in"}
  data: {"chunk": " rebounds..."}
  → Frontend: ChatPanel mein typing effect 🖊️

EVENT N+1: final_response
  data: {"message": "LeBron leads in rebounds (7.2 vs 4.5) while Curry dominates 3PT% (42.1% vs 35.8%)..."}
  → Frontend: Complete message saved to chat history

EVENT N+2: stream_end
  data: {}
  → Frontend: Loading spinner band, input field re-enable
```

### SSE Event helper (utils/sse.py):
```python
def sse_event(event_type: str, data: dict) -> dict:
    return {"event": event_type, "data": data}
```

Bahut simple. Consistency ke liye har jagah ye function use hota hai.

### main.py mein transport (line 217-223):
```python
async def event_generator():
    async for event in process_message(request.message, session_id):
        event_type = event.get("event", "message")
        event_data = json.dumps(event.get("data", {}))
        yield {"event": event_type, "data": event_data}

return EventSourceResponse(event_generator())
```

`sse-starlette` library use hoti hai jo FastAPI ke saath SSE events send karti hai.

---

## 9. Approval Flow — User Permission System

### Current Status:
None of the 5 implemented tools (`query_players`, `fetch_sports_data`, `compare_entities`, `search_history`, `generate_excel`) require user approval. The approval infrastructure (SSE `approval_required` event, `/api/approve` endpoint, `asyncio.Event` pending dict) exists in the codebase but is not triggered by any current tool.

### Infrastructure (present but unused):
```python
# agent.py:65-67
APPROVAL_REQUIRED_ACTIONS = {
    # empty — no tools currently require approval
}
```

The `approval_required` SSE event and `/api/approve` endpoint are implemented and functional — they would activate if a future tool (e.g., a write-capable tool) sets `needs_approval = True`.

---

## 10. Full Example Walkthrough

### Query: "Jokic vs Embiid compare karo"

```
USER MESSAGE → FastAPI → process_message() → run_agent()

═══════════ ROUND 0 (tools enabled) ═══════════

Claude receives:
  system: AGENT_SYSTEM_PROMPT + date context + session history (last 6 turns)
  messages: [{"role": "user", "content": "Jokic vs Embiid compare karo"}]
  tools: TOOL_DEFINITIONS (5 tools)

Claude thinks:
  "I need both players' stats before comparing.
   Let me fetch both profiles in parallel."

Claude returns:
  content: [
    TextBlock("I'll fetch both players' profiles and compare them."),
    ToolUseBlock(name="fetch_sports_data", input={"query_type": "player_profile", "name": "Nikola Jokic"}),
    ToolUseBlock(name="fetch_sports_data", input={"query_type": "player_profile", "name": "Joel Embiid"}),
  ]

Agent:
  1. Emits: agent_thinking("I'll fetch both players' profiles and compare them.")
  2. Emits: plan_step(1, pending, "Fetching Jokic profile")
  3. Emits: plan_step(2, pending, "Fetching Embiid profile")

  4. Execute tool 1: fetch_sports_data(player_profile, "Nikola Jokic")
     → resolve_player_id("Nikola Jokic")
     → _strip_diacritics → "nikola jokic"
     → Exact match in registry → UUID found
     → Sportradar API call → get_player_profile(uuid)
     → trim_player_profile() → 2KB trimmed data
     → context[1] = {data: {name: "Nikola Jokic", season_stats: {ppg: 26.5, rpg: 12.3, apg: 9.1, ...}}}
     → Emits: tool_result(success, 920ms, "Nikola Jokic: 26.5 PPG, 12.3 RPG, 9.1 APG")

  5. Execute tool 2: fetch_sports_data(player_profile, "Joel Embiid")
     → Sportradar API call → get_player_profile(uuid)
     → trim_player_profile() → 2KB trimmed data
     → context[2] = {data: {name: "Joel Embiid", season_stats: {ppg: 28.1, rpg: 10.5, apg: 3.1, ...}}}
     → Emits: tool_result(success, 870ms, "Joel Embiid: 28.1 PPG, 10.5 RPG, 3.1 APG")

  6. Send results back to Claude:
     messages.append({"role": "user", "content": [
       {"type": "tool_result", "tool_use_id": "toolu_01A", "content": "{summary, player, season_stats, career}"},
       {"type": "tool_result", "tool_use_id": "toolu_01B", "content": "{summary, player, season_stats, career}"},
     ]})

═══════════ ROUND 1 (tools enabled) ═══════════

Claude receives updated messages (including tool results from round 0)

Claude thinks:
  "I have both players' data. Now I can generate the comparison chart and table."

Claude returns:
  content: [
    ToolUseBlock(name="compare_entities", input={"entities": ["Nikola Jokic", "Joel Embiid"], "entity_type": "player"}),
  ]

Agent:
  7. Execute tool 3: compare_entities(["Nikola Jokic", "Joel Embiid"])
     → _extract_player_from_context("Nikola Jokic", context) → context[1] found
     → _extract_player_from_context("Joel Embiid", context) → context[2] found
     → Compute radar data (normalized 0-100) for ppg, rpg, apg, spg, bpg, fg_pct
     → Compute table data (raw values side-by-side + winner per stat)
     → context[3] = {data: {radar_data: [...], table_data: [...], leaders: {...}}}
     → Emits: client_action(render_chart, radar data)
     → Emits: client_action(render_table, table data)
     → Emits: tool_result(success, 8ms, "Jokic leads in 4/6 categories vs Embiid")

  8. Send results back to Claude

═══════════ ROUND 2 (tools DISABLED — forced response) ═══════════

Claude receives ALL results, NO tools available.
Claude MUST write final text response.

Claude writes (streamed token by token):
  "Comparing Jokic and Embiid this season:

   Embiid leads in scoring (28.1 vs 26.5 PPG) and blocks (1.8 vs 0.7 BPG).
   Jokic dominates in rebounding (12.3 vs 10.5 RPG) and assists (9.1 vs 3.1 APG),
   plus shoots more efficiently (58.3% vs 52.1% FG).

   Overall, Jokic leads in 4 of 6 major statistical categories."

═══════════ DONE ═══════════
yield sse_event("stream_end", {})
```

---

## 11. Safety & Smart Features

### 1. Chart Refusal Override (agent.py:826-869)
**Problem:** Sometimes Claude says "I'm text-based, I can't render charts" — GALAT! Humara frontend charts render KAR sakta hai.

**Solution:**
```python
if _is_chart_request(message) and not tool_use_blocks:
    # Retry with explicit nudge
    retry_messages = messages + [{
        "content": "The user asked for a chart. Call compare_entities now..."
    }]
    retry_response = await client.messages.create(...)

    if _sounds_like_chart_refusal(full_text):
        # Override response
        full_text = "I can generate charts here. Tell me which players..."
```

### 2. Chart Type Injection (agent.py:924-929)
```python
if tool_name == "compare_entities":
    desired_chart_type = _requested_chart_type(message)  # "bar chart" → "bar"
    if desired_chart_type:
        params = {**params, "chart_type": desired_chart_type}
```
User ne "bar chart" bola toh `chart_type: "bar"` force inject hota hai, chahe Claude ne specify na kiya ho.

### 3. Max Limits
| Limit | Value | Kyun |
|-------|-------|------|
| MAX_TOOL_ROUNDS = 2 | 2 tool rounds + 1 forced response | Infinite loop prevention |
| MAX_TOOL_CALLS = 8 | Safety cap per request | Cost control |
| Rate limit = 1 req/sec | Sportradar API tier restriction | API compliance |
| Cache TTL = 5 min | Avoid redundant API calls | Cost + performance |
| Conversation history = 6 turns | Last 6 stored, last 6 injected per request | Context window management |

### 4. Sensitive Data Redaction (agent.py:605-611)
```python
def _redact_sensitive(params: dict) -> dict:
    for key in ("api_key", "secret", "password", "token"):
        redacted[key] = "***"
```
Tool call params frontend pe stream hote hai — sensitive values mask.

### 5. Player Registry Caching
First startup: 31 API calls → `data/player_registry.json` saved.
Every subsequent startup: JSON se load → ZERO API calls.

### 6. Scope Boundary
System prompt mein HARD rule:
- Off-topic question → "I'm SportScout AI — I only handle NBA and basketball analytics."
- No roleplay, no prompt injection, no system prompt reveal.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    SportScout AI Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Message                                                    │
│       │                                                          │
│       ▼                                                          │
│  FastAPI (main.py) → SSE stream                                 │
│       │                                                          │
│       ▼                                                          │
│  run_agent() loop (agent.py)                                    │
│       │                                                          │
│       ├── Round 0: Claude + tools → fetch data                  │
│       ├── Round 1: Claude + tools → analyze/compare             │
│       └── Round 2: Claude (no tools) → forced text response     │
│                                                                  │
│  Tool Execution:                                                 │
│       Claude decides → get_tool(name) → tool.execute(params)    │
│       Result → context[id] (full) + messages (concise)          │
│                                                                  │
│  SSE Events:                                                    │
│       plan_step → tool_call → tool_result → client_action       │
│       → response_chunk → final_response → stream_end            │
│                                                                  │
│  5 Tools:                                                       │
│       query_players    → Pandas (local, 0 API calls)            │
│       fetch_sports_data → Sportradar API (live data)            │
│       compare_entities → Charts + tables (needs prior fetch)    │
│       search_history   → BM25/FTS5 over user's session queries  │
│       generate_excel   → Excel .xls file download              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
