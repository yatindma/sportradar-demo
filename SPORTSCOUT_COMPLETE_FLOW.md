# 🏀 SportScout AI — COMPLETE FLOW (How Everything Works)

---

## 🖼️ THE BIG PICTURE (30-second version)

```
User types goal
      ↓
React Frontend → POST /api/chat (with message)
      ↓
FastAPI Backend receives message
      ↓
PLANNER (Claude Sonnet — ALWAYS)
  → Reads user goal + available tools
  → Outputs plan JSON (1 step for simple, 6+ for complex)
  → Decides: which tools, what params, what order
      ↓
WORKER (executes tools, streams SSE events)
      ↓
    ┌────────┼────────┬──────────┬──────────┐
    ↓        ↓        ↓          ↓          ↓
 SSE:     SSE:     SSE:       SSE:       SSE:
 plan_    tool_    tool_     client_    final_
 step     call     result    action     response
    ↓        ↓        ↓          ↓          ↓
    └────────┴────────┴──────────┴──────────┘
                      ↓
              React Frontend listens
              Updates 3 panels in real-time
```

**Why always LLM?**
- No fragile heuristic code to maintain
- LLM is smart enough to output a 1-step plan for "scores today" and a 6-step plan for "compare + export"
- One code path = fewer bugs, easier to debug
- Planner cost is ~$0.002 per call — negligible
- LLM can handle edge cases heuristics would miss ("who's better, the guy who plays for Denver or Philly's center?" — good luck parsing that with keywords)

---

## 📍 STEP-BY-STEP FLOW (Every Detail)

---

### STEP 0: App Starts

```
docker-compose up
  ├── FastAPI backend → http://localhost:8000
  ├── React frontend → http://localhost:3000
  └── SQLite DB auto-created (watchlist + search_history tables)

On startup:
  - SQLite DB initialized (search_history FTS5 table auto-created)
  - Langfuse SDK initialized (OpenTelemetry tracing begins)
  - Sportradar API key validated (one test call)
```

---

### STEP 1: User Types a Goal

**User types**: `"Compare Jokic vs Embiid this season and export as CSV"`

**Frontend does**:
```javascript
// React sends POST request
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Compare Jokic vs Embiid this season and export as CSV",
    session_id: "abc-123",           // for Langfuse session grouping
    watchlist: [...currentWatchlist]  // so agent knows user's saved items
  })
});

// Then listen to SSE stream
const reader = response.body.getReader();
// ... read chunks, parse events, update UI
```

**UI State**: 
- Chat panel: User message appears (right-aligned, blue bubble)
- Trace panel: Shows "⏳ Processing..." spinner
- Results panel: No change yet

---

### STEP 2: FastAPI Receives Request → Goes Straight to Planner

```python
# backend/main.py
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        process_message(request.message, request.session_id),
        media_type="text/event-stream"  # ← SSE!
    )

async def process_message(message: str, session_id: str):
    # 1. Generate plan (ALWAYS — Claude decides complexity)
    plan = await generate_plan(message, conversation_history=get_history(session_id))
    
    # 2. Stream plan steps as pending
    for step in plan.steps:
        yield sse_event("plan_step", {"id": step.id, "tool": step.tool, "description": step.description, "status": "pending"})
    
    # 3. Execute plan (worker loop)
    async for event in execute_plan(plan, session_id):
        yield event
    
    # 4. Final summary (if plan says it's needed)
    if plan.needs_final_summary:
        final = await generate_final_response(plan, results)
        yield sse_event("final_response", {"message": final})
```

**Langfuse**: New trace created → `trace_id = "xyz-789"`

---

### STEP 3: PLANNER (Claude Sonnet — Runs for EVERY Query)

No router, no heuristics. Claude gets the user message + tool descriptions → outputs a plan JSON. Simple query = 1 step plan. Complex = 6+ steps. LLM decides everything.

```python
# backend/planner.py
PLANNER_SYSTEM_PROMPT = """You are the planner for SportScout AI, an NBA analytics agent.

Given a user's goal, output a JSON plan that the worker will execute step by step.

## Available Tools:
1. query_players — Pandas search across 500+ cached player bios (local, zero API calls). params: query (pandas expression), sort_by, limit
2. fetch_sports_data — Sportradar NBA API. query_type: player_profile | player_game_logs | standings | game_scores | league_leaders. params: name, date, season, conference
3. compare_entities — Compare 2-4 players/teams. Generates radar chart data + table. params: entities[], entity_type (player|team), categories[]
4. search_history — BM25/FTS5 keyword search over user's prior session queries (SQLite FTS5). params: query
5. generate_excel — Create Excel .xls download, triggers browser download. params: title, data_source

## Rules:
- Output ONLY valid JSON, no explanation
- For simple queries (scores, standings, single player lookup): output 1-2 steps
- For complex queries (comparisons, exports): output as many steps as needed
- Steps execute IN ORDER. Later steps can reference earlier step results.
- If user wants a chart/comparison → include compare_entities (it auto-triggers chart rendering)
- If user wants export → include generate_excel as final data step
- Add search_history when prior session context would help answer the user's query
- Always end with a step description that helps generate the final response

## Output format:
{
  "steps": [
    {"id": 1, "tool": "tool_name", "params": {...}, "description": "what this does"},
    ...
  ],
  "needs_final_summary": true/false  // false if last tool already produces a complete answer
}
"""

async def generate_plan(message: str, conversation_history: list = None) -> Plan:
    """
    Always called. Claude decides the plan.
    Simple query → 1 step. Complex → many steps.
    """
    messages = []
    
    # Include recent conversation for context (last 3 turns max)
    if conversation_history:
        for turn in conversation_history[-3:]:
            messages.append({"role": turn["role"], "content": turn["content"]})
    
    messages.append({"role": "user", "content": message})
    
    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=600,
        system=PLANNER_SYSTEM_PROMPT,
        messages=messages
    )
    
    plan_json = json.loads(response.content[0].text)
    return Plan(**plan_json, original_message=message)
```

**Example: SIMPLE query** → `"What are today's NBA scores?"`

Claude outputs:
```json
{
  "steps": [
    {"id": 1, "tool": "fetch_nba_data", "params": {"query_type": "game_scores", "date": "today"}, "description": "Fetch today's NBA scores"}
  ],
  "needs_final_summary": true
}
```
→ 1 step. Clean. No heuristic could do this better.

**Example: COMPLEX query** → `"Compare Jokic vs Embiid this season and export"`

Claude outputs:
```json
{
  "steps": [
    {"id": 1, "tool": "fetch_sports_data", "params": {"query_type": "player_profile", "name": "Nikola Jokic"}, "description": "Fetch Jokic profile + stats"},
    {"id": 2, "tool": "fetch_sports_data", "params": {"query_type": "player_profile", "name": "Joel Embiid"}, "description": "Fetch Embiid profile + stats"},
    {"id": 3, "tool": "compare_entities", "params": {"entities": ["Nikola Jokic", "Joel Embiid"], "entity_type": "player"}, "description": "Compare both players across all categories"},
    {"id": 4, "tool": "generate_excel", "params": {"title": "Jokic vs Embiid comparison", "data_source": "last_comparison"}, "description": "Export comparison as Excel"}
  ],
  "needs_final_summary": true
}
```
→ 4 steps. LLM figured out the right order, what to fetch, when to compare, when to export.

**Example: TRICKY query** → `"Is the Denver guy better than Philly's center?"`

A keyword router would FAIL here. Claude easily outputs:
```json
{
  "steps": [
    {"id": 1, "tool": "fetch_nba_data", "params": {"query_type": "player_profile", "name": "Nikola Jokic"}, "description": "Fetch Jokic (Denver's center)"},
    {"id": 2, "tool": "fetch_nba_data", "params": {"query_type": "player_profile", "name": "Joel Embiid"}, "description": "Fetch Embiid (Philly's center)"},
    {"id": 3, "tool": "compare_entities", "params": {"entities": ["Nikola Jokic", "Joel Embiid"], "entity_type": "player"}, "description": "Compare both centers"}
  ],
  "needs_final_summary": true
}
```
→ LLM understood "Denver guy" = Jokic, "Philly's center" = Embiid. No heuristic can do this.

**Example: HISTORY query** → `"Repeat the analysis you did earlier"`

```json
{
  "steps": [
    {"id": 1, "tool": "search_history", "params": {"query": "analysis"}, "description": "Find prior session queries about analysis"},
    {"id": 2, "tool": "fetch_sports_data", "params": {"query_type": "player_profile", "name": "..."}, "description": "Re-fetch player using context from history"}
  ],
  "needs_final_summary": true
}
```
→ Claude uses search_history to figure out what the user previously asked, then re-runs the relevant fetch.

**SSE Events sent** (plan steps as pending):
```
event: plan_step
data: {"id": 1, "tool": "fetch_nba_data", "description": "Fetch Jokic profile + stats", "status": "pending"}

event: plan_step
data: {"id": 2, "tool": "fetch_nba_data", "description": "Fetch Embiid profile + stats", "status": "pending"}

... (all steps)
```

**UI Update**: Trace panel shows all steps as 🟡 pending

**Langfuse**: Records planner LLM call (tokens, latency, cost)

---

### STEP 5: WORKER Executes Each Step (The Core Loop)

```python
# backend/worker.py
async def execute_plan(plan: Plan, session: Session):
    """
    Execute each plan step, stream events, handle errors.
    """
    results = {}  # store results for later steps to reference
    
    for step in plan.steps:
        # --- Stream: step is now running ---
        yield sse_event("plan_step", {
            "id": step.id, "status": "running"
        })
        
        # --- Check if approval needed ---
        tool = tool_registry[step.tool]
        if tool.needs_approval(step.params):
            yield sse_event("approval_required", {
                "step_id": step.id,
                "tool": step.tool,
                "params": step.params,
                "description": step.description
            })
            # PAUSE here — wait for frontend to send approval
            approved = await wait_for_approval(step.id, timeout=60)
            if not approved:
                yield sse_event("plan_step", {
                    "id": step.id, "status": "denied"
                })
                continue  # skip this step
        
        # --- Stream: tool call starting ---
        start_time = time.time()
        yield sse_event("tool_call", {
            "step_id": step.id,
            "tool": step.tool,
            "params": redact_keys(step.params)  # hide API keys
        })
        
        try:
            # --- EXECUTE THE TOOL ---
            result = await tool.execute(step.params, context=results)
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # --- Store result for subsequent steps ---
            results[step.id] = result
            
            # --- Stream: tool result ---
            yield sse_event("tool_result", {
                "step_id": step.id,
                "status": "success",
                "elapsed_ms": elapsed_ms,
                "summary": result.summary  # short human-readable summary
            })
            
            # --- Stream: plan step done ---
            yield sse_event("plan_step", {
                "id": step.id, "status": "done"
            })
            
            # --- If tool produced knowledge, show attribution ---
            if result.knowledge_used:
                yield sse_event("knowledge_used", {
                    "step_id": step.id,
                    "sources": result.knowledge_used  # ["mvp-criteria", "per-definition"]
                })
            
            # --- If tool produced a client action ---
            if result.client_action:
                yield sse_event("client_action", {
                    "type": result.client_action.type,     # "render_chart" or "download_file"
                    "payload": result.client_action.payload  # chart data or file content
                })
            
            # --- Langfuse: record tool execution ---
            langfuse_span.end(output=result.summary, metadata={"elapsed_ms": elapsed_ms})
            
        except RateLimitError:
            # Sportradar 429 — wait and retry once
            yield sse_event("tool_result", {
                "step_id": step.id, "status": "rate_limited", "retrying": True
            })
            await asyncio.sleep(1.5)
            result = await tool.execute(step.params, context=results)
            # ... (same success flow)
            
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            yield sse_event("tool_result", {
                "step_id": step.id,
                "status": "failed",
                "error": str(e),
                "elapsed_ms": elapsed_ms
            })
            yield sse_event("plan_step", {
                "id": step.id, "status": "failed"
            })
    
    # --- ALL STEPS DONE — Generate final response ---
    final_message = await generate_final_response(plan, results)
    yield sse_event("final_response", {
        "message": final_message
    })
```

**Let's trace through each step for our example:**

---

#### Step 1 Execution: `fetch_sports_data(player_profile, "Nikola Jokic")`

```python
# Inside fetch_nba_data tool:
async def execute(self, params, context):
    query_type = params["query_type"]  # "player_profile"
    name = params["name"]              # "Nikola Jokic"
    
    # 1. Check cache
    cache_key = f"{query_type}:{name}"
    cached = self.cache.get(cache_key)
    if cached:
        return ToolResult(data=cached, summary=f"Jokic profile (cached)", from_cache=True)
    
    # 2. Rate limit (1 QPS for Sportradar)
    await self.rate_limiter.acquire()
    
    # 3. Call Sportradar API
    # First: search player by name to get ID
    search_resp = await self.http.get(
        f"{SPORTRADAR_BASE}/players/search.json",
        params={"name": "Nikola Jokic", "api_key": API_KEY}
    )
    player_id = search_resp["results"][0]["id"]
    
    # Second: fetch profile
    profile_resp = await self.http.get(
        f"{SPORTRADAR_BASE}/players/{player_id}/profile.json",
        params={"api_key": API_KEY}
    )
    # Raw response: ~50KB JSON with EVERYTHING
    
    # 4. TRIM — only keep what we need
    trimmed = {
        "name": profile_resp["full_name"],
        "team": profile_resp["team"]["name"],
        "position": profile_resp["primary_position"],
        "season_stats": {
            "ppg": profile_resp["seasons"][-1]["teams"][0]["average"]["points"],
            "rpg": profile_resp["seasons"][-1]["teams"][0]["average"]["rebounds"],
            "apg": profile_resp["seasons"][-1]["teams"][0]["average"]["assists"],
            "spg": profile_resp["seasons"][-1]["teams"][0]["average"]["steals"],
            "bpg": profile_resp["seasons"][-1]["teams"][0]["average"]["blocks"],
            "fg_pct": profile_resp["seasons"][-1]["teams"][0]["average"]["field_goals_pct"],
            "ft_pct": profile_resp["seasons"][-1]["teams"][0]["average"]["free_throws_pct"],
            "three_pct": profile_resp["seasons"][-1]["teams"][0]["average"]["three_points_pct"],
            "mpg": profile_resp["seasons"][-1]["teams"][0]["average"]["minutes"],
            "turnovers": profile_resp["seasons"][-1]["teams"][0]["average"]["turnovers"],
        }
    }
    # Trimmed: ~500 bytes ← from 50KB!
    
    # 5. Cache it (5 min TTL)
    self.cache.set(cache_key, trimmed, ttl=300)
    
    return ToolResult(
        data=trimmed,
        summary=f"Jokic: {trimmed['season_stats']['ppg']} PPG, {trimmed['season_stats']['rpg']} RPG, {trimmed['season_stats']['apg']} APG"
    )
```

**SSE Events during this step:**
```
event: plan_step
data: {"id": 1, "status": "running"}

event: tool_call  
data: {"step_id": 1, "tool": "fetch_nba_data", "params": {"query_type": "player_profile", "name": "Nikola Jokic"}}

event: tool_result
data: {"step_id": 1, "status": "success", "elapsed_ms": 342, "summary": "Jokic: 26.4 PPG, 12.3 RPG, 9.0 APG"}

event: plan_step
data: {"id": 1, "status": "done"}
```

**UI Update**: 
- Trace panel: Step 1 turns from 🟡 → 🔵 → ✅ (with "342ms" shown)

---

#### Step 2: Same as Step 1 but for Embiid (might hit cache if already fetched)

---

#### Step 3: `compare_entities(["Jokic", "Embiid"])`

```python
# Inside compare_entities tool:
async def execute(self, params, context):
    # Get both players' stats from context (steps 1 & 2)
    player1 = context[1]["data"]
    player2 = context[2]["data"]
    
    # Normalize to 0-100 scale for radar chart
    categories = ["ppg", "rpg", "apg", "spg", "bpg", "fg_pct"]
    max_vals = {"ppg": 35, "rpg": 15, "apg": 12, "spg": 3, "bpg": 4, "fg_pct": 0.65}
    
    radar_data = []
    table_data = []
    winners = {}
    
    for cat in categories:
        v1 = player1["season_stats"][cat]
        v2 = player2["season_stats"][cat]
        
        # Normalize to 0-100
        norm1 = min(100, int((v1 / max_vals[cat]) * 100))
        norm2 = min(100, int((v2 / max_vals[cat]) * 100))
        
        radar_data.append({"category": cat, player1["name"]: norm1, player2["name"]: norm2})
        table_data.append({"stat": cat, player1["name"]: v1, player2["name"]: v2, "winner": player1["name"] if v1 > v2 else player2["name"]})
        winners[cat] = player1["name"] if v1 > v2 else player2["name"]
    
    return ToolResult(
        data={"radar_data": radar_data, "table_data": table_data, "winners": winners},
        summary=f"Jokic leads in 4/6 categories vs Embiid",
        client_action=ClientAction(
            type="render_chart",
            payload={"chart_type": "radar", "data": radar_data, "players": [player1["name"], player2["name"]]}
        )
    )
```

**This step returns a `client_action`!**

**SSE Event:**
```
event: client_action
data: {"type": "render_chart", "payload": {"chart_type": "radar", "data": [...], "players": ["Nikola Jokic", "Joel Embiid"]}}
```

**UI Update**: 
- Results panel: **Radar chart appears** (Recharts renders the data)
- This is **Client Action #1** ✅

---

#### Step 4: `generate_excel(title="Jokic vs Embiid comparison", data_source="last_comparison")`

```python
# Inside generate_excel tool:
async def execute(self, params, context):
    # Get comparison data from step 3
    comparison = context[3]["data"]

    filename = f"comparison_jokic_embiid_{datetime.now().strftime('%Y%m%d')}.xls"

    # Build Excel file from comparison table data
    xls_content = build_excel(comparison["table_data"])

    return ToolResult(
        data={"filename": filename, "content": xls_content},
        summary=f"Generated {filename}",
        client_action=ClientAction(
            type="download_file",
            payload={"filename": filename, "content": xls_content, "mime_type": "application/vnd.ms-excel"}
        )
    )
```

**SSE Event:**
```
event: client_action
data: {"type": "download_file", "payload": {"filename": "comparison_jokic_embiid_20260228.xls", "content": "...", "mime_type": "application/vnd.ms-excel"}}
```

**UI Update**:
- Browser downloads the Excel file
- Toast: "📥 comparison_jokic_embiid_20260228.xls downloaded"
- This is **Client Action #2** ✅

---

### STEP 6: Final Response Generation

```python
# After all tools done, generate a human-readable summary
async def generate_final_response(plan, results):
    """
    Use Claude to write a natural language summary of all results.
    Session history (last 6 turns) was already injected into the initial request.
    """
    # Build a compact context from all tool results
    context = "\n".join([
        f"Step {sid}: {r['summary']}"
        for sid, r in results.items()
    ])

    # If search_history was used, surface that context
    history_context = ""
    for sid, r in results.items():
        if r.get("knowledge_used"):
            for entry in r["knowledge_used"]:
                history_context += f"\nPrior query: {entry['query']}"

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=800,
        system="You are a sports analyst. Summarize the results concisely. Be specific with numbers.",
        messages=[{
            "role": "user",
            "content": f"User asked: {plan.original_message}\n\nResults:\n{context}\n\n{history_context}\n\nWrite a concise analysis."
        }]
    )

    return response.content[0].text
```

**SSE Event:**
```
event: final_response
data: {"message": "Based on the 2025-26 season stats, Jokic leads Embiid in 4 of 6 major categories. Jokic averages 26.4 PPG, 12.3 RPG, and 9.0 APG. Embiid edges him in scoring (28.1 PPG) and blocks (1.8 BPG). Your comparison Excel file has been downloaded."}
```

**UI Update**:
- Chat panel: Agent response appears with streaming text
- 💡 "Knowledge Active" badge shown in Trace panel when search_history returned matches

---

### STEP 7: Frontend SSE Listener (How React Handles All This)

```javascript
// frontend/src/hooks/useAgentStream.js

function useAgentStream() {
  const [messages, setMessages] = useState([]);
  const [planSteps, setPlanSteps] = useState([]);
  const [traceEntries, setTraceEntries] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [knowledgeSources, setKnowledgeSources] = useState([]);
  const [approvalRequest, setApprovalRequest] = useState(null);

  async function sendMessage(text) {
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    
    // Start SSE stream
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events from buffer
      const events = parseSSEEvents(buffer);
      buffer = events.remaining;

      for (const event of events.parsed) {
        switch (event.type) {

          case 'plan_step':
            setPlanSteps(prev => {
              const existing = prev.find(s => s.id === event.data.id);
              if (existing) {
                return prev.map(s => s.id === event.data.id ? { ...s, ...event.data } : s);
              }
              return [...prev, event.data];
            });
            break;

          case 'tool_call':
            setTraceEntries(prev => [...prev, {
              type: 'call',
              tool: event.data.tool,
              params: event.data.params,
              timestamp: Date.now()
            }]);
            break;

          case 'tool_result':
            setTraceEntries(prev => [...prev, {
              type: 'result',
              step_id: event.data.step_id,
              status: event.data.status,
              elapsed_ms: event.data.elapsed_ms,
              summary: event.data.summary
            }]);
            break;

          case 'knowledge_used':
            setKnowledgeSources(prev => [...prev, ...event.data.sources]);
            break;

          case 'client_action':
            handleClientAction(event.data);  // ← THIS IS WHERE UI CHANGES HAPPEN
            break;

          case 'approval_required':
            setApprovalRequest(event.data);  // Show modal
            break;

          case 'final_response':
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: event.data.message,
              knowledge: knowledgeSources 
            }]);
            break;
        }
      }
    }
  }

  function handleClientAction(action) {
    switch (action.type) {
      case 'render_chart':
        // → Results panel re-renders with chart data
        setChartData(action.payload);
        break;

      case 'download_file':
        // → Browser downloads file
        const blob = new Blob([action.payload.content], { type: action.payload.mime_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = action.payload.filename;
        a.click();
        URL.revokeObjectURL(url);
        break;

      case 'apply_table_filter':
        // → Table highlights matching rows
        setTableFilter(action.payload);
        break;

      case 'show_toast':
        // → Toast notification appears
        toast.success(action.payload.message);
        break;
    }
  }

  return { messages, planSteps, traceEntries, chartData, knowledgeSources, approvalRequest, sendMessage };
}
```

---

### STEP 8: Knowledge Active Badge (When search_history Returns Matches)

**Example**: User says `"Tell me more about what I was looking at earlier"`

```
1. Worker calls search_history(query="...")
2. SQLite FTS5 BM25 search runs over this session's prior queries
3. Matches returned → knowledge_used field populated in result
4. SSE event sent:
   event: knowledge_used
   data: {"sources": [{"type": "session_history", "count": 2, "queries": ["Compare LeBron vs Curry", "..."]}]}

5. React updates Trace panel:
   - "Knowledge Active" badge appears
   - Agent uses prior query context to inform its response

6. No user approval needed — search_history is read-only
```

---

### STEP 9: What the User Sees (Final State)

After the full `"Compare Jokic vs Embiid + export"` flow:

```
┌─────────────────────────────────────────────────────────────────┐
│  🏀 SportScout AI                           [Debug🔧] [🌙]     │
├──────────────┬──────────────────┬───────────────────────────────┤
│              │                  │                               │
│  💬 CHAT     │  📋 TRACE        │  📊 RESULTS                   │
│              │                  │                               │
│ [You]        │ 🧠 Planner:      │  ┌─────────────────────────┐  │
│ Compare      │   4 steps planned│  │    RADAR CHART           │  │
│ Jokic vs     │                  │  │   🔵 Jokic  🔴 Embiid    │  │
│ Embiid...    │ 📋 Plan (4 steps)│  │                         │  │
│              │ ✅ 1. Fetch Jokic│  │    PPG  ████████ 26.4   │  │
│ [SportScout] │    342ms         │  │    RPG  █████████ 12.3  │  │
│ Based on the │ ✅ 2. Fetch      │  │    APG  █████████ 9.0   │  │
│ 2025-26      │    Embiid 298ms  │  │    ...                  │  │
│ stats,       │ ✅ 3. Compare    │  └─────────────────────────┘  │
│ Jokic leads  │    8ms 📊        │                               │
│ in 4 of 6    │ ✅ 4. Export XLS │  ┌─────────────────────────┐  │
│ categories.. │    5ms 📥        │  │ Stat    Jokic   Embiid  │  │
│              │                  │  │ PPG     26.4    28.1    │  │
│              │ Total: 655ms     │  │ RPG     12.3    10.5    │  │
│              │                  │  │ APG     9.0     3.1     │  │
│              │                  │  │ ...                     │  │
│              │                  │  └─────────────────────────┘  │
│              │                  │                               │
│              │                  │  📥 XLS downloaded ✅          │
├──────────────┴──────────────────┴───────────────────────────────┤
│  [🎯 Type your goal here... ]                        [Send ➤]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 SIMPLE QUERY FLOW (LLM Plans 1 Step — Still Fast)

User: `"What are today's NBA scores?"`

```
1. Planner (Claude) → generates 1-step plan:
   {"steps": [{"id": 1, "tool": "fetch_sports_data", "params": {"query_type": "game_scores", "date": "today"}}]}

2. Worker executes single tool
   - fetch_sports_data(game_scores, date="2026-02-28")
   - Returns trimmed scores

3. SSE:
   event: plan_step   {"id": 1, "tool": "fetch_sports_data", "status": "running"}
   event: tool_result  {"step_id": 1, "status": "success", "summary": "7 games today"}
   event: client_action {"type": "apply_table_filter", "payload": {table with scores}}
   event: final_response {"message": "There are 7 NBA games today. The closest game is..."}

4. Total time: ~900ms (500ms planner + 400ms tool)
   Still fast. No user notices the difference.
```

---

## 📁 PROJECT STRUCTURE

```
sportscout-ai/
├── docker-compose.yml         # ONE COMMAND: docker-compose up
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt       # fastapi, uvicorn, httpx, anthropic, langfuse, etc.
│   ├── main.py                # FastAPI app, SSE endpoint, approval endpoint
│   ├── planner.py             # Claude Sonnet plan generation (always runs)
│   ├── worker.py              # Tool execution loop + SSE streaming
│   ├── tools/
│   │   ├── __init__.py        # Tool registry
│   │   ├── fetch_nba_data.py  # API gateway + cache + trim (query_players + fetch_sports_data)
│   │   ├── compare_entities.py # Comparison + chart data
│   │   ├── search_history.py  # BM25/FTS5 session query search
│   │   └── generate_excel.py  # Excel .xls artifact creation
│   ├── providers/
│   │   ├── sportradar.py      # Sportradar API client
│   │   ├── balldontlie.py     # Fallback API client
│   │   └── adapter.py         # Provider interface
│   ├── db/
│   │   ├── schema.py          # SQLite tables
│   │   └── client.py          # DB connection
│   └── utils/
│       ├── cache.py           # In-memory TTL cache
│       ├── rate_limiter.py    # 1 QPS limiter
│       ├── sse.py             # SSE event helpers
│       └── trim.py            # API response trimming
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx            # 3-panel layout
│   │   ├── hooks/
│   │   │   └── useAgentStream.js  # SSE listener + state management
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── TracePanel.jsx
│   │   │   ├── ResultsPanel.jsx
│   │   │   ├── ApprovalModal.jsx
│   │   │   ├── RadarChart.jsx     # Recharts
│   │   │   ├── StatsTable.jsx
│   │   │   └── KnowledgeBadge.jsx
│   │   └── styles/
│   │       └── globals.css    # Tailwind
│   └── index.html
│
├── .env.example
└── README.md
```

---

## ⏱️ WHAT HAPPENS IN WHAT ORDER (Timeline)

```
t=0ms      User hits Send
t=5ms      POST /api/chat received
t=10ms     Planner call to Claude starts
t=550ms    Planner returns plan JSON (6 steps for complex, 1 step for simple)
t=555ms    SSE: all plan_steps (pending)
t=560ms    Worker starts Step 1
t=560ms    SSE: step 1 running
t=565ms    Rate limiter: OK (no wait)
t=570ms    Sportradar API call #1 starts
t=900ms    API response received (330ms)
t=905ms    Trim: 50KB → 500B
t=910ms    Cache: stored
t=910ms    SSE: step 1 done (342ms)
t=915ms    Worker starts Step 2
... (similar for steps 2-5)
t=1550ms   Step 4 done → SSE: client_action (render_chart)
t=1550ms   UI: Radar chart appears!
t=1560ms   Step 4 done → SSE: client_action (download_file)
t=1560ms   UI: XLS downloads!
t=1565ms   Final response Claude call starts
t=2100ms   Final response received
t=2100ms   SSE: final_response
t=2100ms   UI: Agent message appears in chat

TOTAL: ~2.1 seconds for 4-step complex query
TOTAL: ~0.9 seconds for 1-step simple query
```

---

## 🔑 LLM CALLS SUMMARY (Always Plan, Still Cheap)

| Query Type | LLM Calls | Cost (approx) |
|-----------|-----------|---------------|
| Simple ("scores today") | 2 (planner + final response) | ~$0.003 |
| Complex ("compare + export") | 2 (planner + final response) | ~$0.005 |
| History-assisted query | 2 (planner + final response) | ~$0.004 |

Every query = planner + optional final narrator. Tool execution = free (Python code).
The planner call is ~$0.002 — literally pennies. Worth it for the reliability vs fragile heuristics. 💰
