"""
SportScout AI — NBA Data Tools.

Two tools for NBA data:
    1. fetch_sports_data: Live Sportradar API gateway (player stats, standings, scores)
    2. query_players: Pandas-powered search across 500+ cached player bios (zero API calls)

Player Registry:
    Built at first startup from League Hierarchy + 30 Team Profiles (31 API calls).
    Cached to data/player_registry.json — subsequent startups load from disk instantly.
    Contains: name, team, position, height, weight, birthdate, college, draft, status.

Player Resolution:
    4-tier strategy: exact → substring → token → fuzzy (thefuzz).
    Diacritics normalized (Jokić → Jokic). Ambiguous matches raise ValueError
    with ranked candidates so the LLM agent can ask for clarification.
"""

import json
import logging
import unicodedata
from pathlib import Path
from datetime import date, datetime
from thefuzz import fuzz
from typing import Any, Optional

from providers.sportradar import (
    get_player_profile,
    get_player_game_logs,
    get_daily_schedule,
    get_standings,
    get_league_leaders,
    build_player_registry,
    trim_player_profile,
    trim_standings,
    trim_daily_schedule,
)

logger = logging.getLogger("sportscout.tools.fetch_sports_data")

# ---------------------------------------------------------------------------
# Dynamic Player Registry — built at startup from team rosters
# ---------------------------------------------------------------------------
# Registry format: { "player name": { "id": "uuid", "team": "...", "team_alias": "...", "position": "...", ... } }
# Built from: League Hierarchy (1 call) + 30 Team Profiles (30 calls) = 31 total
# Cached to data/player_registry.json after first run — zero API calls on subsequent starts.

_player_registry: dict[str, dict] = {}

_REGISTRY_PATH = Path(__file__).resolve().parent.parent / "data" / "player_registry.json"


def _strip_diacritics(text: str) -> str:
    """Remove diacritics/accents: 'Jokić' → 'Jokic', 'Dončić' → 'Doncic'."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _load_registry_from_disk() -> dict[str, dict] | None:
    """Load cached player registry from JSON. Returns None if file doesn't exist."""
    if not _REGISTRY_PATH.exists():
        return None
    try:
        data = json.loads(_REGISTRY_PATH.read_text())
        # Validate it's the new format (dict values, not string UUIDs)
        if data and isinstance(next(iter(data.values())), str):
            logger.info("Old-format registry detected (UUID strings), will re-fetch with full data")
            return None
        logger.info(f"Loaded player registry from disk: {len(data)} players")
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Failed to load player registry from disk: {e}")
        return None


def _save_registry_to_disk(registry: dict[str, dict]) -> None:
    """Persist player registry to JSON for next startup."""
    try:
        _REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        _REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False))
        logger.info(f"Saved player registry to disk: {len(registry)} players")
    except OSError as e:
        logger.warning(f"Failed to save player registry to disk: {e}")


def _add_to_registry(registry: dict[str, dict], name: str, info: dict) -> None:
    """Add a player to registry with diacritics-normalized alias."""
    registry[name] = info
    ascii_name = _strip_diacritics(name)
    if ascii_name != name:
        registry[ascii_name] = info


async def init_player_registry() -> int:
    """Populate the player registry from disk cache, or fetch from API on first run."""
    global _player_registry
    _player_registry = {}

    # Try loading from disk first (skip API calls if cached)
    cached = _load_registry_from_disk()
    if cached:
        for name, info in cached.items():
            _add_to_registry(_player_registry, name, info)
        logger.info(f"Player registry ready from cache: {len(_player_registry)} players")
        return len(_player_registry)

    # First run — fetch all team rosters (31 API calls) and save to disk
    logger.info("No cached registry found, fetching all team rosters from Sportradar...")
    dynamic = await build_player_registry()
    for name, info in dynamic.items():
        _add_to_registry(_player_registry, name, info)

    # Save to disk for next startup
    _save_registry_to_disk(_player_registry)
    return len(_player_registry)


FUZZY_HIGH_CONFIDENCE = 80   # Auto-resolve: "Lebrone James" → "LeBron James"
FUZZY_SUGGESTION_FLOOR = 60  # Show as candidate: close enough to suggest


def _get_player_id(info: dict | str) -> str:
    """Extract player UUID from registry entry (supports both old and new format)."""
    if isinstance(info, str):
        return info
    return info.get("id", "")


def resolve_player_id(name: str) -> Optional[str]:
    """
    Resolve a player name to a Sportradar UUID.

    Matching priority: exact → substring → token → fuzzy.
    If multiple players match, raises ValueError listing candidates so the
    LLM agent can ask the user for clarification.

    Returns:
        Sportradar UUID string if found, None if no match.

    Raises:
        ValueError: If query is ambiguous (matches multiple players).
    """
    name_lower = _strip_diacritics(name.strip().lower())

    # ── 1. Exact match ──
    if name_lower in _player_registry:
        return _get_player_id(_player_registry[name_lower])

    # ── 2. Substring match (deduplicate by player_id) ──
    seen_ids: set[str] = set()
    matches: list[tuple[str, str]] = []  # (display_name, player_id)
    for known_name, info in _player_registry.items():
        pid = _get_player_id(info)
        known_ascii = _strip_diacritics(known_name)
        if name_lower in known_ascii or known_ascii in name_lower:
            if pid not in seen_ids:
                seen_ids.add(pid)
                matches.append((known_name.title(), pid))

    # ── 3. Token match ──
    if not matches:
        query_tokens = name_lower.split()
        for known_name, info in _player_registry.items():
            pid = _get_player_id(info)
            known_ascii = _strip_diacritics(known_name)
            if all(token in known_ascii for token in query_tokens):
                if pid not in seen_ids:
                    seen_ids.add(pid)
                    matches.append((known_name.title(), pid))

    if len(matches) == 1:
        return matches[0][1]
    if len(matches) > 1:
        names_list = ", ".join(m[0] for m in matches[:8])
        raise ValueError(
            f"Ambiguous: '{name}' matched {len(matches)} players: {names_list}."
        )

    # ── 4. Fuzzy match (typos, misspellings) ──
    fuzzy_matches: list[tuple[str, str, int]] = []  # (name, id, score)
    for known_name, info in _player_registry.items():
        pid = _get_player_id(info)
        known_ascii = _strip_diacritics(known_name)
        score = fuzz.token_sort_ratio(name_lower, known_ascii)
        if score >= FUZZY_SUGGESTION_FLOOR and pid not in seen_ids:
            seen_ids.add(pid)
            fuzzy_matches.append((known_name.title(), pid, score))

    # High-confidence single match → auto-resolve
    high_conf = [m for m in fuzzy_matches if m[2] >= FUZZY_HIGH_CONFIDENCE]
    if len(high_conf) == 1:
        logger.info(f"Fuzzy resolved '{name}' → '{high_conf[0][0]}' (score={high_conf[0][2]})")
        return high_conf[0][1]

    # Multiple fuzzy candidates → ambiguity
    if fuzzy_matches:
        fuzzy_matches.sort(key=lambda m: m[2], reverse=True)
        names_list = ", ".join(f"{m[0]} ({m[2]}%)" for m in fuzzy_matches[:6])
        raise ValueError(
            f"No exact match for '{name}'. Did you mean: {names_list}?"
        )

    logger.warning(f"Player not found in _player_registry: '{name}'")
    return None


def get_player_info(name: str) -> Optional[dict]:
    """Get cached player info (team, position, etc.) without API call."""
    name_lower = _strip_diacritics(name.strip().lower())
    info = _player_registry.get(name_lower)
    if info and isinstance(info, dict):
        return info
    return None


class QueryPlayersRegistryTool:
    """
    Run a pandas query on the full NBA player registry (500+ players).
    The model writes the pandas query, tool executes it — zero API calls.
    Supports ANY filter/combination: age, weight, height, team, position, etc.
    """

    name: str = "query_players"
    description: str = "Run a pandas query on the local player registry (no API call)."

    _df = None  # Lazy-loaded DataFrame
    _df_date = None  # Date when DataFrame was built (rebuild daily for fresh age)

    def _get_dataframe(self):
        """Build a pandas DataFrame from registry, with derived columns (age, weight_kg, height_cm)."""
        import pandas as pd

        today = date.today()
        # Rebuild daily so age stays accurate
        if self._df is not None and self._df_date == today and len(self._df) > 0:
            return self._df

        rows = []
        seen_ids: set[str] = set()

        for name, info in _player_registry.items():
            if not isinstance(info, dict):
                continue
            pid = info.get("id", "")
            if pid in seen_ids:
                continue
            seen_ids.add(pid)

            # Parse birthdate → age
            age = None
            birthdate_str = info.get("birthdate", "")
            if birthdate_str:
                try:
                    bd = datetime.strptime(birthdate_str, "%Y-%m-%d").date()
                    age = (today - bd).days // 365
                except (ValueError, TypeError):
                    pass

            # Weight lbs → kg
            weight_lbs = None
            weight_kg = None
            try:
                weight_lbs = int(info.get("weight", 0)) or None
                if weight_lbs:
                    weight_kg = round(weight_lbs * 0.453592)
            except (ValueError, TypeError):
                pass

            # Height inches → cm + display
            height_in = None
            height_cm = None
            height_display = ""
            try:
                height_in = int(info.get("height", 0)) or None
                if height_in:
                    height_cm = round(height_in * 2.54)
                    height_display = f"{height_in // 12}'{height_in % 12}\""
            except (ValueError, TypeError):
                pass

            experience = None
            try:
                exp_val = info.get("experience", "")
                if exp_val:
                    experience = int(exp_val)
            except (ValueError, TypeError):
                pass

            rows.append({
                "player_id": pid,
                "name": name.title(),
                "name_ascii": _strip_diacritics(name).title(),
                "team": info.get("team", ""),
                "team_alias": info.get("team_alias", ""),
                "position": info.get("position", ""),
                "primary_position": info.get("primary_position", ""),
                "jersey_number": info.get("jersey_number", ""),
                "age": age,
                "height_display": height_display,
                "height_inches": height_in,
                "height_cm": height_cm,
                "weight_lbs": weight_lbs,
                "weight_kg": weight_kg,
                "birthdate": birthdate_str,
                "birth_place": info.get("birth_place", ""),
                "experience": experience,
                "college": info.get("college", ""),
                "high_school": info.get("high_school", ""),
                "draft_year": info.get("draft_year", ""),
                "draft_round": info.get("draft_round", ""),
                "draft_pick": info.get("draft_pick", ""),
                "status": info.get("status", ""),
            })

        self._df = pd.DataFrame(rows)
        self._df_date = today
        logger.info(f"Player DataFrame built: {len(self._df)} players, {len(self._df.columns)} columns")
        return self._df

    async def execute(self, params: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        import pandas as pd

        query = params.get("query", "")
        if not query:
            raise ValueError("Missing required parameter: query (pandas query string)")

        df = self._get_dataframe()

        try:
            result_df = df.query(query)
        except Exception as e:
            # Give the model useful info to fix the query
            raise ValueError(
                f"Query failed: {e}\n"
                f"Available columns: {list(df.columns)}\n"
                f"Sample dtypes: player_id(str), name(str), name_ascii(str), age(float), "
                f"weight_kg(float), height_cm(float), experience(float), team(str), "
                f"position(str), college(str), birth_place(str), status(str), draft_year(str)"
            )

        # Sort if requested
        sort_by = params.get("sort_by")
        sort_desc = params.get("sort_desc", False)
        if sort_by and sort_by in result_df.columns:
            result_df = result_df.sort_values(sort_by, ascending=not sort_desc, na_position="last")

        # Limit output
        limit = int(params.get("limit", 25))
        total = len(result_df)
        result_df = result_df.head(limit)

        # Pick relevant columns for output (drop nulls-heavy cols)
        output_cols = params.get("columns")
        if output_cols:
            output_cols = [c for c in output_cols if c in result_df.columns]
            result_df = result_df[output_cols]

        players = result_df.to_dict(orient="records")

        summary = f"Found {total} players matching: {query}"
        if total > limit:
            summary += f" (showing top {limit})"

        return {"data": {"players": players, "total": total, "query": query}, "summary": summary}


class FetchSportsDataTool:
    """
    Sportradar API gateway tool for fetching NBA data.

    Dispatches to the appropriate Sportradar provider function based on
    the ``query_type`` parameter. All raw API responses are trimmed before
    being returned to keep payloads manageable for downstream tools and
    the LLM narrator.

    Attributes:
        name: Tool identifier used in plans and the registry.
        description: Human-readable description for the planner.
    """

    name: str = "fetch_sports_data"
    description: str = "Fetch basketball data from Sportradar NBA API."

    async def execute(self, params: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Execute an NBA data fetch based on the provided query type.

        Args:
            params: Tool parameters from the plan. Expected keys:
                - query_type (str): One of "player_profile", "player_game_logs",
                  "standings", "game_scores", "league_leaders".
                - name (str, optional): Player name for player queries.
                - date (str, optional): Date string "YYYY-MM-DD" or "today"
                  for game_scores.
                - season (str, optional): Season year for standings/leaders.
                - conference (str, optional): "eastern" or "western" filter.
                - category (str, optional): Stat category for league_leaders.
            context: Dict of step_id to previous tool results. Not used
                directly by this tool but available for consistency.

        Returns:
            Dict with keys:
                - data: Trimmed response data.
                - summary: Human-readable summary of what was fetched.

        Raises:
            ValueError: If query_type is missing or unsupported, or if a
                required player name cannot be resolved.
        """
        query_type = params.get("query_type")
        if not query_type:
            raise ValueError("Missing required parameter: query_type")

        logger.info(f"Fetching sports data: query_type={query_type}, params={params}")

        if query_type == "player_profile":
            return await self._fetch_player_profile(params)
        elif query_type == "player_game_logs":
            return await self._fetch_player_game_logs(params)
        elif query_type == "standings":
            return await self._fetch_standings(params)
        elif query_type == "game_scores":
            return await self._fetch_game_scores(params)
        elif query_type == "league_leaders":
            return await self._fetch_league_leaders(params)
        else:
            raise ValueError(
                f"Unsupported query_type: '{query_type}'. "
                f"Must be one of: player_profile, player_game_logs, standings, "
                f"game_scores, league_leaders."
            )

    async def _fetch_player_profile(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Fetch and trim a player profile from Sportradar.
        Enriches response with cached registry data (team, position, height, etc.)
        so the agent has full context without extra API calls.
        """
        player_name = params.get("name", "")
        player_id = params.get("player_id") or resolve_player_id(player_name)
        if not player_id:
            raise ValueError(
                f"Could not find player '{player_name}'. "
                f"Try using a full name like 'Nikola Jokic'."
            )

        raw = await get_player_profile(player_id)
        trimmed = trim_player_profile(raw)

        # Enrich with cached registry data (bio, team, physical, draft)
        cached_info = get_player_info(player_name)
        if cached_info:
            trimmed["registry"] = {
                "team": cached_info.get("team", ""),
                "team_alias": cached_info.get("team_alias", ""),
                "position": cached_info.get("position", ""),
                "primary_position": cached_info.get("primary_position", ""),
                "jersey_number": cached_info.get("jersey_number", ""),
                "height": cached_info.get("height", ""),
                "weight": cached_info.get("weight", ""),
                "birthdate": cached_info.get("birthdate", ""),
                "birth_place": cached_info.get("birth_place", ""),
                "experience": cached_info.get("experience", ""),
                "college": cached_info.get("college", ""),
                "draft_year": cached_info.get("draft_year", ""),
                "draft_round": cached_info.get("draft_round", ""),
                "draft_pick": cached_info.get("draft_pick", ""),
                "status": cached_info.get("status", ""),
            }

        stats = trimmed.get("season_stats", {})
        summary = (
            f"{trimmed['name']} ({trimmed['position']}, {trimmed['team']}): "
            f"{stats.get('ppg', 0)} PPG, {stats.get('rpg', 0)} RPG, "
            f"{stats.get('apg', 0)} APG in {stats.get('games_played', 0)} games."
        )

        logger.info(f"Fetched profile for {trimmed['name']}")
        return {"data": trimmed, "summary": summary}

    async def _fetch_player_game_logs(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Fetch game-by-game stats for a player's season.

        Args:
            params: Must contain "name". Optional "season" year.

        Returns:
            Dict with game log data and summary.
        """
        player_name = params.get("name", "")
        player_id = params.get("player_id") or resolve_player_id(player_name)
        if not player_id:
            raise ValueError(f"Could not find player '{player_name}'.")

        season_year = int(params["season"]) if params.get("season") else None
        raw = await get_player_game_logs(player_id, season_year=season_year)

        # Trim game logs to essential fields per game.
        # We keep ALL games here — the worker's context compression layer
        # handles trimming old steps. This way downstream tools get full
        # season data when they're the most recent step.
        raw_games = raw.get("games", raw.get("statistics", {}).get("games", []))

        games = []
        for game in raw_games:
            stats = game.get("statistics", {})
            games.append({
                "date": game.get("scheduled", game.get("date", "")),
                "opponent": game.get("opponent", {}).get("name", ""),
                "points": stats.get("points", game.get("points", 0)),
                "rebounds": stats.get("rebounds", game.get("rebounds", 0)),
                "assists": stats.get("assists", game.get("assists", 0)),
                "steals": stats.get("steals", game.get("steals", 0)),
                "blocks": stats.get("blocks", game.get("blocks", 0)),
                "turnovers": stats.get("turnovers", game.get("turnovers", 0)),
                "minutes": stats.get("minutes", game.get("minutes", "")),
                "fg_pct": stats.get("field_goals_pct", game.get("field_goals_pct", 0)),
                "three_pct": stats.get("three_points_pct", game.get("three_points_pct", 0)),
                "ft_pct": stats.get("free_throws_pct", game.get("free_throws_pct", 0)),
                "plus_minus": stats.get("plus_minus", game.get("plus_minus", 0)),
            })

        source = raw.get("source", "unknown")
        if not games:
            summary = (
                f"No per-game logs available for {player_name} in season "
                f"{raw.get('season', season_year or 'current')} "
                f"(source={source})."
            )
        else:
            summary = f"Retrieved {len(games)} game logs for {player_name} (full season data)."
        logger.info(summary)
        return {
            "data": {
                "player": player_name,
                "season": raw.get("season", season_year),
                "source": source,
                "games": games,
            },
            "summary": summary,
        }

    async def _fetch_standings(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Fetch and trim NBA standings.

        Args:
            params: Optional "season" year and "conference" filter.

        Returns:
            Dict with standings data and summary.
        """
        season_year = int(params["season"]) if params.get("season") else None
        raw = await get_standings(season_year=season_year)
        trimmed = trim_standings(raw)

        conference = params.get("conference")
        if conference and conference in trimmed:
            trimmed = {conference: trimmed[conference]}

        total_teams = sum(len(teams) for teams in trimmed.values())
        conf_label = conference.title() if conference else "Both conferences"
        summary = f"NBA standings ({conf_label}): {total_teams} teams retrieved."

        logger.info(summary)
        return {"data": trimmed, "summary": summary}

    async def _fetch_game_scores(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Fetch and trim the daily game schedule / scores.

        Args:
            params: Optional "date" string (YYYY-MM-DD or "today").

        Returns:
            Dict with game list and summary.
        """
        date_str = params.get("date", "today")
        if date_str == "today":
            target_date = date.today()
        else:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError(
                    f"Invalid date format: '{date_str}'. Use YYYY-MM-DD or 'today'."
                )

        raw = await get_daily_schedule(target_date)
        trimmed = trim_daily_schedule(raw)

        if trimmed:
            summary = (
                f"{len(trimmed)} games on {target_date.strftime('%b %d, %Y')}. "
                f"Games: {', '.join(g['away']['alias'] + ' @ ' + g['home']['alias'] for g in trimmed[:5])}"
            )
            if len(trimmed) > 5:
                summary += f" and {len(trimmed) - 5} more."
        else:
            summary = f"No games scheduled for {target_date.strftime('%b %d, %Y')}."

        logger.info(summary)
        return {"data": trimmed, "summary": summary}

    async def _fetch_league_leaders(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Fetch NBA league leaders for a statistical category.

        Args:
            params: Optional "season" year and "category" (e.g., "scoring").

        Returns:
            Dict with leader data and summary.
        """
        season_year = int(params["season"]) if params.get("season") else None
        category = params.get("category", "scoring")

        raw = await get_league_leaders(season_year=season_year, category=category)

        # Trim leaders to top entries with essential fields
        leaders = []
        for cat in raw.get("categories", []):
            cat_name = cat.get("name", cat.get("display_name", ""))
            for rank_entry in cat.get("ranks", [])[:10]:
                player = rank_entry.get("player", {})
                leaders.append({
                    "category": cat_name,
                    "rank": rank_entry.get("rank", 0),
                    "player": player.get("full_name", ""),
                    "team": player.get("team", {}).get("name", ""),
                    "value": rank_entry.get("average", rank_entry.get("value", 0)),
                })

        summary = f"League leaders ({category}): {len(leaders)} entries retrieved."
        logger.info(summary)
        return {
            "data": {"category": category, "leaders": leaders},
            "summary": summary,
        }

