"""
Search History Tool

Keyword-based retrieval over prior user queries stored in SQLite.
"""

import re
from typing import Any

from db.client import get_db
from db.schema import search_history_keywords


class SearchHistoryTool:
    name: str = "search_history"
    description: str = "Search prior user queries using BM25-ranked keyword matching (SQLite FTS5)."

    _STOP = {
        "the", "and", "for", "with", "from", "that", "this", "what", "when",
        "where", "how", "about", "into", "over", "under", "after", "before",
        "player", "team", "teams", "stats", "stat", "please", "show", "give",
    }

    def _extract_preference_keywords(self, matches: list[dict], top_n: int = 5) -> list[str]:
        """Derive high-signal recurring keywords from matched history queries."""
        counts: dict[str, int] = {}
        for row in matches:
            q = (row.get("query") or "").lower()
            for token in re.findall(r"[a-z0-9_]{3,}", q):
                if token in self._STOP:
                    continue
                counts[token] = counts.get(token, 0) + 1
        ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        return [k for k, _ in ranked[: max(1, min(top_n, 10))]]

    async def execute(self, params: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        query = (params.get("query") or "").strip()
        user_id = (params.get("user_id") or "").strip()
        limit = int(params.get("limit", 5))

        if not query:
            raise ValueError("search_history requires a non-empty 'query'.")
        if not user_id:
            raise ValueError("search_history requires 'user_id'.")

        db = await get_db()
        matches = await search_history_keywords(db, user_id=user_id, query=query, limit=limit)

        summary = (
            f"Found {len(matches)} BM25-ranked history match(es) for '{query}'."
            if matches
            else f"No history matches found for '{query}'."
        )
        preference_keywords = self._extract_preference_keywords(matches)

        sources = []
        if matches:
            sources.append({
                "type": "search_history",
                "label": "Session Query History",
                "count": len(matches),
                "items": [m.get("query", "") for m in matches[:5]],
            })

        return {
            "data": {
                "query": query,
                "matches": matches,
                "preference_keywords": preference_keywords,
            },
            "summary": summary,
            "knowledge_used": sources,
        }
