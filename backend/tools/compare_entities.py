"""
Compare Entities Tool — Player and Team Comparison with Chart Data.

Generates structured comparison data suitable for rendering radar/bar charts
and comparison tables on the frontend. Supports 1-6 players or 2-6 teams by
pulling data from the execution context (previous fetch steps) or by
fetching fresh data when needed.

Output includes:
    - radar_data: Stats normalized to 0-100 scale for radar/bar charts
    - table_data: Raw stat values organized for tabular display
    - client_action: Instructions for the frontend to render charts/tables
"""

import io
import csv
import logging
from typing import Any

from tools.fetch_nba_data import FetchSportsDataTool
from utils.download_store import save as save_download

logger = logging.getLogger("sportscout.tools.compare_entities")

# Stat categories available for comparison, with display labels
COMPARISON_CATEGORIES: dict[str, str] = {
    "ppg": "Points",
    "rpg": "Rebounds",
    "apg": "Assists",
    "spg": "Steals",
    "bpg": "Blocks",
    "fg_pct": "FG%",
    "ft_pct": "FT%",
    "three_pct": "3PT%",
    "mpg": "Minutes",
}

# Max values for normalization to 0-100 scale (approximate ceilings)
STAT_MAX_VALUES: dict[str, float] = {
    "ppg": 40.0,
    "rpg": 15.0,
    "apg": 12.0,
    "spg": 2.5,
    "bpg": 3.5,
    "fg_pct": 70.0,
    "ft_pct": 100.0,
    "three_pct": 50.0,
    "mpg": 40.0,
}

SUPPORTED_CHART_TYPES = {
    "radar",
    "bar",
    "line",
    "area",
    "pie",
    "scatter",
    "histogram",
    "gaussian",
}


def _table_to_download_url(table_data: dict) -> str:
    """Convert table_data {columns, rows} to CSV, store it, return download URL."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(table_data.get("columns", []))
    for row in table_data.get("rows", []):
        writer.writerow(row)
    key = save_download(buf.getvalue())
    return f"/api/download/{key}"


def _extract_player_from_context(player_name: str, context: dict[str, Any]) -> dict[str, Any] | None:
    """
    Search the execution context for a player's profile data.

    Args:
        player_name: Player name to search for (case-insensitive).
        context: Dict mapping step_id to previous tool results.

    Returns:
        Trimmed player data dict if found, None otherwise.
    """
    name_lower = player_name.lower()
    for step_id, result in context.items():
        data = result.get("data", {})
        if isinstance(data, dict) and name_lower in data.get("name", "").lower():
            return data
    return None


def _extract_query_players_rows(context: dict[str, Any]) -> list[dict[str, Any]]:
    """Get the most recent query_players result rows from context, if available."""
    step_ids = sorted(context.keys(), reverse=True)
    for step_id in step_ids:
        result = context.get(step_id, {})
        data = result.get("data", {})
        if isinstance(data, dict) and isinstance(data.get("players"), list):
            rows = data.get("players", [])
            if rows and isinstance(rows[0], dict):
                return rows
    return []


def _is_number(value: Any) -> bool:
    try:
        if value is None:
            return False
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def _pick_distribution_field(rows: list[dict[str, Any]], categories: list[str]) -> str | None:
    """Pick a numeric field for distribution charts."""
    if not rows:
        return None

    preferred = [c for c in categories if c in rows[0]]
    for field in preferred:
        if any(_is_number(r.get(field)) for r in rows):
            return field

    for fallback in ("age", "height_inches", "height_cm", "weight_lbs", "weight_kg", "experience"):
        if fallback in rows[0] and any(_is_number(r.get(fallback)) for r in rows):
            return fallback

    for key in rows[0].keys():
        if any(_is_number(r.get(key)) for r in rows):
            return key

    return None


class CompareEntitiesTool:
    """
    Comparison tool that generates chart and table data for 1-6 entities.

    Supports:
    - 1 player: Solo profile radar/bar chart (stats vs league benchmarks)
    - 2-6 players: Side-by-side comparison charts
    - 2-6 teams: Comparison table
    - Distribution: Population histogram/gaussian from query_players data

    Pulls player or team data from the execution context when available,
    and fetches fresh data from Sportradar when not. Normalizes stats to
    a 0-100 scale for chart rendering and provides raw values for
    tabular display.
    """

    name: str = "compare_entities"
    description: str = "Chart and compare 1-6 NBA players or teams."

    def __init__(self) -> None:
        self._fetch = FetchSportsDataTool()

    async def execute(self, params: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Execute a chart/comparison for 1-6 NBA entities.

        Supports:
        - 0 entities + query_players in context → distribution chart
        - 1 player → solo profile chart (radar/bar)
        - 2-6 players → side-by-side comparison chart
        - 2-6 teams → comparison table
        """
        context = context or {}
        entities = params.get("entities", [])
        entity_type = params.get("entity_type", "player")
        categories = params.get("categories") or list(COMPARISON_CATEGORIES.keys())
        chart_type = params.get("chart_type", "radar")

        # --- Distribution mode: 0 entities + query_players data in context ---
        if len(entities) == 0:
            dist_rows = _extract_query_players_rows(context)
            if dist_rows and entity_type == "player":
                return self._build_distribution(dist_rows, categories, chart_type)
            raise ValueError("No entities provided and no query_players data in context.")

        # --- Distribution mode: explicit histogram/gaussian with ≤1 entity ---
        if len(entities) <= 1 and chart_type in ("histogram", "gaussian"):
            dist_rows = _extract_query_players_rows(context)
            if dist_rows:
                return self._build_distribution(dist_rows, categories, chart_type)

        if len(entities) > 6:
            raise ValueError("Maximum 6 entities supported. Please narrow your selection.")
        if chart_type not in SUPPORTED_CHART_TYPES:
            chart_type = "radar"

        logger.info(f"Charting {len(entities)} {entity_type}(s): {entities}")

        if entity_type == "player":
            return await self._compare_players(entities, categories, context, chart_type)
        else:
            return self._compare_teams(entities, context)

    def _build_distribution(
        self,
        dist_rows: list[dict[str, Any]],
        categories: list[str],
        chart_type: str,
    ) -> dict[str, Any]:
        """Build a frequency distribution chart from query_players rows."""
        field = _pick_distribution_field(dist_rows, categories)
        if not field:
            raise ValueError(
                "Couldn't find a numeric field in query_players results for charting."
            )

        values = [float(r[field]) for r in dist_rows if _is_number(r.get(field))]
        if not values:
            raise ValueError(
                f"No numeric values found for '{field}' in query_players results."
            )

        counts: dict[int, int] = {}
        for v in values:
            bucket = int(round(v))
            counts[bucket] = counts.get(bucket, 0) + 1

        sorted_buckets = sorted(counts.items(), key=lambda x: x[0])
        chart_data = [
            {"category": str(bucket), "Count": count}
            for bucket, count in sorted_buckets
        ]
        table_data = {
            "columns": [field.title(), "Count"],
            "rows": [[bucket, count] for bucket, count in sorted_buckets],
        }

        if chart_type not in SUPPORTED_CHART_TYPES:
            chart_type = "histogram"

        summary = (
            f"Built {chart_type} distribution for '{field}' "
            f"across {len(values)} players ({len(sorted_buckets)} buckets)."
        )
        return {
            "data": {
                "radar_data": chart_data,
                "table_data": table_data,
                "players": ["Count"],
                "leaders": {},
                "distribution_field": field,
                "download_url": _table_to_download_url(table_data),
            },
            "summary": summary,
            "client_action": [
                {
                    "type": "render_chart",
                    "payload": {
                        "chart_type": chart_type,
                        "data": chart_data,
                        "players": ["Count"],
                        "title": f"{field.title()} Distribution",
                    },
                },
                {
                    "type": "render_table",
                    "payload": table_data,
                },
            ],
        }

    async def _compare_players(
        self,
        player_names: list[str],
        categories: list[str],
        context: dict[str, Any],
        chart_type: str,
    ) -> dict[str, Any]:
        """Chart 1-6 NBA players. 1 = solo profile, 2+ = comparison."""
        players_data: list[dict[str, Any]] = []

        for name in player_names:
            # Try context first
            player = _extract_player_from_context(name, context)

            if not player:
                # Fetch fresh from Sportradar
                logger.info(f"Player '{name}' not in context, fetching from API")
                try:
                    fetched = await self._fetch.execute(
                        {"query_type": "player_profile", "name": name},
                        context=context,
                    )
                    player = fetched.get("data", {})
                except Exception as e:
                    logger.error(f"Failed to fetch {name}: {e}")
                    raise ValueError(f"Failed to fetch data for '{name}': {e}")

            players_data.append(player)

        # Build radar data (normalized 0-100)
        radar_data: list[dict[str, Any]] = []
        for cat in categories:
            if cat not in COMPARISON_CATEGORIES:
                continue
            entry: dict[str, Any] = {"category": COMPARISON_CATEGORIES[cat]}
            for player in players_data:
                stats = player.get("season_stats", {})
                raw_val = stats.get(cat, 0)
                max_val = STAT_MAX_VALUES.get(cat, 100.0)
                normalized = min(100, round((raw_val / max_val) * 100, 1)) if max_val > 0 else 0
                entry[player["name"]] = normalized
                logger.info(f"  [{player['name']}] {cat}: raw={raw_val}, max={max_val}, norm={normalized}")
            radar_data.append(entry)
        logger.info(f"Radar data: {radar_data}")

        # Build table data (raw values) — include ALL season stats for comprehensive export
        table_columns = ["Stat"] + [p["name"] for p in players_data]
        table_rows: list[list[Any]] = []

        # Core comparison categories first
        for cat in categories:
            if cat not in COMPARISON_CATEGORIES:
                continue
            row: list[Any] = [COMPARISON_CATEGORIES[cat]]
            for player in players_data:
                stats = player.get("season_stats", {})
                row.append(stats.get(cat, 0))
            table_rows.append(row)

        # Additional stats not in COMPARISON_CATEGORIES (for Excel completeness)
        EXTRA_STAT_LABELS: dict[str, str] = {
            "turnovers": "Turnovers",
            "games_played": "Games Played",
            "games_started": "Games Started",
            "double_doubles": "Double Doubles",
            "triple_doubles": "Triple Doubles",
            "plus_minus": "+/-",
            "offensive_rebounds": "Off. Rebounds",
            "defensive_rebounds": "Def. Rebounds",
            "personal_fouls": "Personal Fouls",
        }
        for stat_key, stat_label in EXTRA_STAT_LABELS.items():
            row = [stat_label]
            for player in players_data:
                stats = player.get("season_stats", {})
                row.append(stats.get(stat_key, 0))
            table_rows.append(row)

        # Add metadata rows at the top
        meta_rows = [
            ["Team"] + [p.get("team", "N/A") for p in players_data],
            ["Position"] + [p.get("position", "N/A") for p in players_data],
            ["Season"] + [str(p.get("season_stats", {}).get("season_year", "N/A")) for p in players_data],
        ]

        table_data = {
            "columns": table_columns,
            "rows": meta_rows + table_rows,
        }
        logger.info(f"Table data: {len(table_rows)} stat rows + {len(meta_rows)} meta rows")

        # Determine who leads in each category
        leaders: dict[str, str] = {}
        for cat in categories:
            if cat not in COMPARISON_CATEGORIES:
                continue
            best_val = -1
            best_player = ""
            for player in players_data:
                val = player.get("season_stats", {}).get(cat, 0)
                if val > best_val:
                    best_val = val
                    best_player = player["name"]
            leaders[COMPARISON_CATEGORIES[cat]] = best_player

        # Build summary
        player_names_str = " vs ".join(p["name"] for p in players_data)
        if len(players_data) == 1:
            p = players_data[0]
            stats = p.get("season_stats", {})
            top_stats = "; ".join(
                f"{COMPARISON_CATEGORIES[c]}: {stats.get(c, 0)}"
                for c in categories if c in COMPARISON_CATEGORIES
            )
            summary = f"Stat profile for {p['name']}. {top_stats}."
            title = f"{p['name']} — Player Profile"
        else:
            leader_summary = "; ".join(f"{cat}: {name}" for cat, name in list(leaders.items())[:4])
            summary = f"Comparison of {player_names_str}. Category leaders — {leader_summary}."
            title = f"{player_names_str} — Comparison"

        result = {
            "data": {
                "radar_data": radar_data,
                "table_data": table_data,
                "players": [p["name"] for p in players_data],
                "leaders": leaders,
                "download_url": _table_to_download_url(table_data),
            },
            "summary": summary,
            "client_action": [
                {
                    "type": "render_chart",
                    "payload": {
                        "chart_type": chart_type,
                        "data": radar_data,
                        "players": [p["name"] for p in players_data],
                        "title": title,
                    },
                },
                {
                    "type": "render_table",
                    "payload": table_data,
                },
            ],
        }

        logger.info(f"Comparison complete: {player_names_str}")
        return result

    def _compare_teams(
        self,
        team_names: list[str],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Compare NBA teams using standings data from context.

        Searches the execution context for standings data and extracts
        records for the requested teams.

        Args:
            team_names: List of team names or markets to compare.
            context: Execution context with prior tool results.

        Returns:
            Comparison result dict with data, summary, and client_action.
        """
        # Find standings in context
        standings = None
        for step_id, result in context.items():
            data = result.get("data", {})
            if isinstance(data, dict) and ("eastern" in data or "western" in data):
                standings = data
                break

        if not standings:
            return {
                "data": {"error": "No standings data in context. Fetch standings first."},
                "summary": "Cannot compare teams: no standings data available.",
            }

        # Extract team data
        all_teams = standings.get("eastern", []) + standings.get("western", [])
        matched_teams: list[dict[str, Any]] = []

        for name in team_names:
            name_lower = name.lower()
            for team in all_teams:
                team_full = f"{team.get('market', '')} {team.get('name', '')}".lower()
                if name_lower in team_full or team.get("name", "").lower() == name_lower:
                    matched_teams.append(team)
                    break

        if len(matched_teams) < 2:
            return {
                "data": {"error": f"Could only find {len(matched_teams)} of {len(team_names)} teams."},
                "summary": f"Could not find all teams for comparison.",
            }

        # Build table
        table_columns = ["Stat"] + [f"{t['market']} {t['name']}" for t in matched_teams]
        table_rows = [
            ["Wins"] + [t.get("wins", 0) for t in matched_teams],
            ["Losses"] + [t.get("losses", 0) for t in matched_teams],
            ["Win %"] + [t.get("win_pct", 0) for t in matched_teams],
            ["GB"] + [t.get("games_behind", 0) for t in matched_teams],
            ["Streak"] + [t.get("streak", "") for t in matched_teams],
        ]

        table_data = {"columns": table_columns, "rows": table_rows}
        team_display = " vs ".join(f"{t['market']} {t['name']}" for t in matched_teams)
        summary = f"Team comparison: {team_display}."

        return {
            "data": {"table_data": table_data, "teams": [f"{t['market']} {t['name']}" for t in matched_teams], "download_url": _table_to_download_url(table_data)},
            "summary": summary,
            "client_action": [
                {"type": "render_table", "payload": table_data},
            ],
        }
