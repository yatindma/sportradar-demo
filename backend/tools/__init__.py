"""
SportScout AI — Tool Registry.

Central registry for all agent tools. Each tool is a class with an async
``execute(params, context)`` method that returns a result dict.

Registry contents:
    - query_players: Pandas-powered search across 500+ cached player bios (zero API calls)
    - fetch_sports_data: Sportradar NBA API gateway (live stats, standings, scores)
    - compare_entities: Multi-entity comparison with chart data generation
    - search_history: Keyword search over prior session queries (SQLite)
    - generate_excel: Excel-compatible export from latest table output

Usage:
    from tools import get_tool, TOOL_REGISTRY

    tool = get_tool("query_players")
    result = await tool.execute({"query": "age < 24"})
"""

import logging
from typing import Any, Protocol

logger = logging.getLogger("sportscout.tools")


class Tool(Protocol):
    """Protocol defining the interface all tools must implement."""

    name: str
    description: str

    async def execute(self, params: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Execute the tool with the given parameters.

        Args:
            params: Tool-specific parameters from the plan step.
            context: Dict mapping step_id to results from previous steps.

        Returns:
            Result dict with at minimum "data" and "summary" keys.
        """
        ...


# ---------------------------------------------------------------------------
# Lazy imports to avoid circular dependencies
# ---------------------------------------------------------------------------
from tools.fetch_nba_data import FetchSportsDataTool, QueryPlayersRegistryTool
from tools.compare_entities import CompareEntitiesTool
from tools.search_history import SearchHistoryTool
from tools.generate_excel import GenerateExcelTool

# ---------------------------------------------------------------------------
# Tool Registry — single instances, keyed by tool name
# ---------------------------------------------------------------------------
TOOL_REGISTRY: dict[str, Tool] = {
    "query_players": QueryPlayersRegistryTool(),
    "fetch_sports_data": FetchSportsDataTool(),
    "compare_entities": CompareEntitiesTool(),
    "search_history": SearchHistoryTool(),
    "generate_excel": GenerateExcelTool(),
}

logger.info(f"Tool registry initialized: {list(TOOL_REGISTRY.keys())}")


def get_tool(name: str) -> Tool:
    """
    Retrieve a tool instance by name.

    Args:
        name: Tool name as used in plan steps (e.g., "fetch_sports_data").

    Returns:
        The tool instance.

    Raises:
        KeyError: If no tool with the given name is registered.
    """
    if name not in TOOL_REGISTRY:
        available = ", ".join(sorted(TOOL_REGISTRY.keys()))
        raise KeyError(
            f"Unknown tool: '{name}'. Available tools: {available}"
        )
    return TOOL_REGISTRY[name]
