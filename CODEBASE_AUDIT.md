# Codebase Audit Report

**Date:** 2026-03-01
**Scope:** Full project — Backend (Python), Frontend (React/JSX), my-video (Remotion/TSX), Config & Dependencies

---

## Table of Contents

1. [Backend Python Audit](#1-backend-python-audit)
2. [Frontend React/JSX Audit](#2-frontend-reactjsx-audit)
3. [my-video Remotion/TSX Audit](#3-my-video-remotiontsx-audit)
4. [Dependency Audit](#4-dependency-audit)
5. [Config & Security Audit](#5-config--security-audit)
6. [Summary Dashboard](#6-summary-dashboard)

---

## 1. Backend Python Audit

### 1.1 Dead Entire Modules (HIGH Priority)

| File | Lines | Issue |
|------|-------|-------|
| `backend/planner.py` | 1-353 | **Entire file is dead code.** Never imported anywhere. Old Planner-Worker architecture replaced by `agent.py`. Contains `generate_plan()` (line 115) and `generate_recovery_plan()` (line 265) — both never called. Also creates an unused `AsyncAnthropic` client on module load (line 37). |
| `backend/worker.py` | 1-397 | **Entire file is dead code.** Never imported anywhere. Contains `execute_plan()` (line 185), `generate_final_response_stream()` (line 336), `needs_approval()`, `wait_for_approval()` — none called. Creates unused `AsyncAnthropic` client (line 48). `APPROVAL_REQUIRED_ACTIONS` (line 52) is always empty dict, making `needs_approval()` always return `False`. |

### 1.2 Potential Bug

| File | Line | Issue |
|------|------|-------|
| `backend/agent.py` | 1113 | `elif tool_name == "search_history"` is chained as `elif` to the `if tool_name == "compare_entities"` block (line 1107). Should be a separate `if` statement. Works by coincidence currently but is a **latent bug** — if both conditions could match, the second would be silently skipped. |

### 1.3 Dead Functions

| File | Line | Function | Issue |
|------|------|----------|-------|
| `backend/providers/sportradar.py` | 127 | `search_player()` | Never called from anywhere. Also returns `None` unconditionally (line 152). |
| `backend/providers/sportradar.py` | 186 | `get_game_boxscore()` | Never called from any file. |
| `backend/db/schema.py` | 26 | `add_watchlist_item()` | Never called. Entire watchlist feature is dead. |
| `backend/db/schema.py` | 49 | `remove_watchlist_item()` | Never called. |
| `backend/db/schema.py` | 56 | `update_watchlist_item()` | Never called. |
| `backend/db/schema.py` | 84 | `get_watchlist_item()` | Only called by `update_watchlist_item()` which is itself dead. |
| `backend/db/schema.py` | 95 | `get_watchlist_items()` | Never called. |
| `backend/utils/cache.py` | 54 | `cache_clear()` | Never called. Only `cache_get` and `cache_set` are used. |

### 1.4 Dead Database Table

| File | Line | Issue |
|------|------|-------|
| `backend/db/client.py` | 39-47 | `watchlist` table is created on startup but **never queried or written to** by any live code path. All watchlist functions in `schema.py` are dead code. |

### 1.5 Code Duplication

| Files | Lines | Issue |
|-------|-------|-------|
| `backend/agent.py` + `backend/worker.py` | 741 / 390 | `_redact_sensitive()` is duplicated identically. Since `worker.py` is dead, removing it resolves this. |

### 1.6 Clean Files (No Issues)

- `backend/main.py` — All imports used, all routes active.
- `backend/db/__init__.py` — Empty init, fine.
- `backend/db/client.py` — All functions used (except watchlist table creation).
- `backend/providers/__init__.py` — Empty init, fine.
- `backend/tools/__init__.py` — All used. `TOOL_REGISTRY` only externally used by dead `worker.py`.
- `backend/tools/compare_entities.py` — Clean.
- `backend/tools/fetch_nba_data.py` — Clean. All functions reachable through tool execution.
- `backend/tools/generate_excel.py` — Clean.
- `backend/tools/search_history.py` — Clean.
- `backend/utils/__init__.py` — Empty init, fine.
- `backend/utils/download_store.py` — Both `save` and `get` are used.
- `backend/utils/rate_limiter.py` — `rate_limit_acquire` used by `sportradar.py`.
- `backend/utils/sse.py` — `sse_event` used by `main.py` and `agent.py`.
- `backend/data/player_registry.json` — Loaded by `fetch_nba_data.py:59-73`, written by `_save_registry_to_disk()`. Working correctly.

---

## 2. Frontend React/JSX Audit

### 2.1 Dead Entire Component (HIGH Priority)

| File | Lines | Issue |
|------|-------|-------|
| `frontend/src/components/ResultsPanel.jsx` | 1-177 | **Entire component is dead code.** Not imported or rendered anywhere in the app tree. Was part of an older 3-panel layout, replaced by inline chart/table rendering in `ChatPanel.jsx`. |

### 2.2 Broken/Dead Animation Code (HIGH Priority)

| File | Lines | Issue |
|------|------|-------|
| `frontend/src/components/LandingPage.jsx` | 22-23, 55-68 | `engineRef` is used in GSAP ScrollTrigger but **never bound to any DOM element** (the engine section JSX was removed). `toolCallRef` is defined but never used at all. GSAP code on lines 55-68 animates CSS classes (`.engine-card`, `.engine-step-1`, etc.) that **do not exist** in the current DOM. This is dead animation code that may produce silent errors. |

### 2.3 Unused Imports

| File | Line | Unused Imports |
|------|------|----------------|
| `frontend/src/components/ChatPanel.jsx` | 6 | `MessageSquare`, `User`, `Sparkles`, `ClipboardList`, `Loader2` from `lucide-react` |
| `frontend/src/components/LandingPage.jsx` | 5 | `BrainCircuit`, `Activity`, `Database`, `Cpu` from `lucide-react` |
| `frontend/src/components/TracePanel.jsx` | 15 | `Loader2` from `lucide-react` |

### 2.4 Unused Variables / State

| File | Line | Issue |
|------|------|-------|
| `frontend/src/App.jsx` | 161-162 | `chartData` and `tableData` destructured from `useAgentStream` but **never used** in the component. Were likely passed to `ResultsPanel` which is no longer rendered. |
| `frontend/src/components/LandingPage.jsx` | 23 | `toolCallRef = useRef(null)` — defined but never used. |
| `frontend/src/hooks/useAgentStream.js` | 598 | `downloadFile` returned from hook but never consumed by `App.jsx`. |
| `frontend/src/hooks/useAgentStream.js` | 603 | `clearResults` returned from hook but never called by any consumer. |

### 2.5 Unused Exported Component

| File | Line | Issue |
|------|------|-------|
| `frontend/src/components/ApprovalModal.jsx` | 9-17 | `BasketballSVG` exported but never used — not internally, not imported by any other file. |

### 2.6 Unused Icon Definitions

| File | Lines | Issue |
|------|-------|-------|
| `frontend/src/components/AgentStoryboard.jsx` | 82, 84 | `icons.stats` and `icons.star` defined in the `icons` object but no TOOLS entry references them. Only `search`, `api`, `compare`, `book`, `download` are used. |

### 2.7 Debug Console Logs Left in Code

| File | Lines | Issue |
|------|-------|-------|
| `frontend/src/components/RadarChart.jsx` | 94-96 | `console.log` statements for `chartType`, `rowData`, `datasets` |
| `frontend/src/hooks/useAgentStream.js` | 68-71 | `console.log` statements for `rows`, `labels`, `playerNames`, `datasets` |

### 2.8 Code Duplication

| Issue | Files |
|-------|-------|
| `BasketballSVG` component is **duplicated in 6 files** | `App.jsx`, `ApprovalModal.jsx`, `ChatPanel.jsx`, `TracePanel.jsx`, `ResultsPanel.jsx`, `LandingPage.jsx` — should be extracted to a shared module. |

### 2.9 Possibly Inert Config

| File | Issue |
|------|-------|
| `frontend/tailwind.config.js` | With Tailwind CSS v4 + `@tailwindcss/vite` plugin, this v3-style config file may be **ignored entirely**. Tailwind v4 uses CSS-based configuration (`@import "tailwindcss"` in globals.css). |

### 2.10 Component Mount Tree

```
App.jsx (root)
  ├── CustomCursor.jsx              ✅ MOUNTED
  ├── LandingPage.jsx               ✅ MOUNTED (when not logged in)
  │     └── AgentStoryboard.jsx     ✅ MOUNTED
  ├── ChatPanel.jsx                 ✅ MOUNTED (when logged in + conversation)
  │     ├── RadarChart.jsx          ✅ MOUNTED (when msg.chartData)
  │     └── StatsTable.jsx          ✅ MOUNTED (when msg.tableData)
  ├── TracePanel.jsx                ✅ MOUNTED (when logged in + conversation)
  ├── ApprovalModal.jsx             ✅ MOUNTED (always rendered, conditionally visible)
  └── ResultsPanel.jsx              ❌ NEVER MOUNTED (dead code)
```

### 2.11 Clean Files (No Issues)

- `frontend/src/main.jsx` — Clean.
- `frontend/src/components/CustomCursor.jsx` — Clean.
- `frontend/src/components/StatsTable.jsx` — Clean.
- `frontend/src/styles/globals.css` — Clean.
- `frontend/vite.config.js` — Clean.
- `frontend/index.html` — Clean.

---

## 3. my-video Remotion/TSX Audit

### 3.1 Dead Files (Never Imported)

| File | Lines | Issue |
|------|-------|-------|
| `my-video/src/scenes/ReActLoopScene.tsx` | 720 lines | **Entire scene is dead code.** Exported but never imported in `ReActVideo.tsx` or `Root.tsx`. |
| `my-video/src/components/ClosedCaptions.tsx` | 163 lines | **Entire component is dead code.** Exported but never imported anywhere. |
| `my-video/src/components/ToolChip.tsx` | 255 lines | **Entire component is dead code.** Exported but never imported anywhere. |

**Total dead code in my-video: ~1,138 lines across 3 files.**

### 3.2 Unused Imports

| File | Line | Import | Issue |
|------|------|--------|-------|
| `my-video/src/components/ParticleField.tsx` | 2 | `Easing` | Imported from `remotion` but never referenced in the file. |

### 3.3 Component Usage Map

| Component | Used In |
|-----------|---------|
| `ParticleField` | `TextSlide`, `IntroScene`, `OutroScene`, `QueryFlowScene`, `ReActLoopScene`*, `StepByStepScene`, `ToolsRevealScene` |
| `GlitchText` | `ReActLoopScene`*, `ToolsRevealScene` |
| `NeonCard` | `QueryFlowScene`, `ReActLoopScene`*, `ToolsRevealScene` |
| `DataFlowLine` | `ReActLoopScene`* only |
| `TypewriterCode` | `QueryFlowScene` |
| `TextSlide` | `ReActVideo` (3 times) |
| `ClosedCaptions` | **NOWHERE** ❌ |
| `ToolChip` | **NOWHERE** ❌ |

*\* `ReActLoopScene` is itself dead, so these usages are also dead.*

> **Note:** `DataFlowLine` is ONLY used inside the dead `ReActLoopScene`. If that scene is removed, `DataFlowLine` also becomes dead code.

### 3.4 Scene Composition Map

| Scene | Used in `ReActVideo.tsx` |
|-------|--------------------------|
| `IntroScene` | ✅ Line 31 |
| `ToolsRevealScene` | ✅ Line 53 |
| `QueryFlowScene` | ✅ Line 63 |
| `StepByStepScene` | ✅ Line 58 |
| `OutroScene` | ✅ Line 78 |
| `ReActLoopScene` | ❌ **NOWHERE** |

### 3.5 Minor Issues

| File | Line | Issue |
|------|------|-------|
| `my-video/src/Root.tsx` | 5 | Uses `React.FC` without explicit `import React`. Works via TS global types but inconsistent. |
| `my-video/src/ReActVideo.tsx` | 10 | Same as above — `React.FC` without import. |

### 3.6 Clean Files (No Issues)

- `my-video/src/index.ts` — Clean.
- `my-video/src/constants.ts` — All exports (`COLORS`, `FONTS`, `TOOLS`) used across codebase.
- `my-video/src/components/GlitchText.tsx` — Clean.
- `my-video/src/components/NeonCard.tsx` — Clean.
- `my-video/src/components/TextSlide.tsx` — Clean.
- `my-video/src/components/TypewriterCode.tsx` — Clean.
- `my-video/src/scenes/IntroScene.tsx` — Clean.
- `my-video/src/scenes/OutroScene.tsx` — Clean.
- `my-video/src/scenes/QueryFlowScene.tsx` — Clean.
- `my-video/src/scenes/StepByStepScene.tsx` — Clean.
- `my-video/src/scenes/ToolsRevealScene.tsx` — Clean.

---

## 4. Dependency Audit

### 4.1 Backend — `requirements.txt`

| Package | Status | Issue |
|---------|--------|-------|
| `langfuse==2.58.0` | ❌ **UNUSED** | Never imported anywhere in any Python file. Pure bloat. |
| `thefuzz` | ⚠️ **MISSING** | Used in `tools/fetch_nba_data.py:24` (`from thefuzz import fuzz`) but NOT listed in `requirements.txt`. Only in `pyproject.toml:18`. Anyone using `pip install -r requirements.txt` will get `ImportError`. |
| All other packages | ✅ Used | `fastapi`, `uvicorn`, `anthropic`, `httpx`, `aiosqlite`, `openpyxl`, `pandas` — all imported and used. |

### 4.2 Backend — `pyproject.toml`

| Issue | Line | Detail |
|-------|------|--------|
| `langfuse==2.58.0` | 17 | ❌ Never imported. Should be removed. |
| Empty author metadata | 5-6 | `authors = [{name = "", email = ""}]` — boilerplate never updated. |
| Boilerplate description | 7 | `"Default template for PDM package"` — never updated. |

### 4.3 Frontend — `package.json`

| Package | Status |
|---------|--------|
| All dependencies | ✅ **All used** — `react`, `react-dom`, `framer-motion`, `gsap`, `lucide-react`, `react-markdown`, `recharts`, `remark-gfm`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `tailwindcss`, `vite` |

### 4.4 my-video — `package.json`

| Package | Status | Issue |
|---------|--------|-------|
| `@remotion/captions` | ❌ **UNUSED** | Never imported in any source file. |
| `@remotion/tailwind-v4` | ❌ **UNUSED** | Tailwind integration plugin installed but no Tailwind utility classes are used anywhere. All styling is inline `style={}`. |
| `tailwindcss` | ❌ **UNUSED** | Same — only a bare `@import "tailwindcss"` in `index.css` but zero Tailwind classes in the actual components. |
| All other packages | ✅ Used | `@remotion/cli`, `react`, `react-dom`, `remotion` — all used. |

---

## 5. Config & Security Audit

### 5.1 Security Issue

| File | Line | Issue |
|------|------|-------|
| `.env` | 4 | Contains **real Anthropic API key** (`sk-ant-api03-...`). If repo is ever pushed publicly, this key is **leaked**. |
| `.env` | 8 | Contains **real Sportradar API key**. Same risk. |

> **Action Required:** Verify `.env` is in `.gitignore`. If it has ever been committed, **rotate both keys immediately**.

### 5.2 `.env` vs `.env.example` Parity

✅ Both files have identical variable names — no missing vars in either direction:
`ANTHROPIC_API_KEY`, `SPORTRADAR_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`, `NARRATOR_MODEL`, `LOG_LEVEL`, `CACHE_TTL_SECONDS`, `RATE_LIMIT_QPS`

> **Note:** `LANGFUSE_*` env vars are defined but `langfuse` is never imported — these vars are also effectively dead config.

### 5.3 Docker Compose

| File | Line | Issue |
|------|------|-------|
| `docker-compose.yml` | 1 | `version: "3.9"` is deprecated in Docker Compose v2+. The field is ignored. Not a bug, just outdated. |

---

## 6. Summary Dashboard

### By Severity

| Severity | Count | Items |
|----------|-------|-------|
| 🔴 **CRITICAL** | 2 | API keys in `.env` may be exposed; Latent bug in `agent.py:1113` (`elif` vs `if`) |
| 🟠 **HIGH** | 5 | Dead modules: `planner.py`, `worker.py`. Dead components: `ResultsPanel.jsx`, `ReActLoopScene.tsx`, `ClosedCaptions.tsx`, `ToolChip.tsx`. Broken GSAP animations in `LandingPage.jsx`. |
| 🟡 **MEDIUM** | 8 | Dead functions in `sportradar.py`, `schema.py`, `cache.py`. Unused imports in `ChatPanel`, `LandingPage`, `TracePanel`. Missing `thefuzz` in `requirements.txt`. |
| 🔵 **LOW** | 8 | Console.logs in production code, unused icon defs, unused hook return values, duplicated `BasketballSVG`, deprecated docker-compose version. |

### Dead Code Tally

| Area | Files | Lines |
|------|-------|-------|
| Backend (Python) | 2 entire files + 8 dead functions | ~750+ lines |
| Frontend (JSX) | 1 entire file + dead animations | ~250+ lines |
| my-video (TSX) | 3 files | ~1,138 lines |
| **Total** | **6 dead files + scattered dead code** | **~2,100+ lines** |

### Unused Dependencies

| Area | Package |
|------|---------|
| Backend | `langfuse` (requirements.txt + pyproject.toml) |
| my-video | `@remotion/captions`, `@remotion/tailwind-v4`, `tailwindcss` |

### Missing Dependencies

| Area | Package | Impact |
|------|---------|--------|
| Backend | `thefuzz` missing from `requirements.txt` | `ImportError` when installing via pip |

---

*This audit was performed by reading every file in the project and cross-referencing all imports, exports, function calls, and component mounts. No code was modified.*
