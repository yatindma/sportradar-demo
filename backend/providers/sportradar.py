"""
Sportradar NBA API v8 Client

Official API client for Sportradar's NBA data feeds. Handles authentication,
rate limiting, response trimming, and caching.

API Base: https://api.sportradar.com/nba/{access_level}/v8/en/
Docs: https://developer.sportradar.com/basketball/reference/nba-overview

Rate Limits:
  - Trial tier: 1 request/second, 1000 requests/month
  - Production: higher limits based on contract
"""

import os
import asyncio
import logging
from datetime import datetime, date
from typing import Optional

import httpx

from utils.cache import cache_get, cache_set
from utils.rate_limiter import rate_limit_acquire

logger = logging.getLogger("sportscout.sportradar")

API_KEY = os.getenv("SPORTRADAR_API_KEY", "")
BASE_URL = "https://api.sportradar.com/nba/trial/v8/en"
TIMEOUT = 15.0

# Retry event log — drained by the worker after each tool execution
_retry_log: list[dict] = []


def drain_retry_log() -> list[dict]:
    """Drain and return all retry events logged during recent API calls."""
    events = list(_retry_log)
    _retry_log.clear()
    return events


def _resolve_season_year(season_year: Optional[int] = None) -> int:
    """
    Resolve the NBA season start year.

    If an explicit ``season_year`` is provided, use it as-is.
    Otherwise infer the current season start year from today's date.
    """
    if season_year is not None:
        return int(season_year)

    year = datetime.now().year
    if datetime.now().month < 9:
        year -= 1
    return year


async def _get(endpoint: str, params: dict | None = None, _retries: int = 3) -> dict:
    """
    Make an authenticated GET request to Sportradar NBA API.

    Handles rate limiting, caching, retries on 429, and error responses.

    Args:
        endpoint: API path after base URL (e.g., "players/{id}/profile.json")
        params: Additional query parameters
        _retries: Max retry attempts on 429 (default 3)

    Returns:
        Parsed JSON response

    Raises:
        httpx.HTTPStatusError: On non-429 4xx/5xx responses
        httpx.TimeoutException: On request timeout
    """
    url = f"{BASE_URL}/{endpoint}"
    query_params = {"api_key": API_KEY}
    if params:
        query_params.update(params)

    # Check cache first
    cache_key = f"sr:{endpoint}:{str(params)}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    last_exc = None
    for attempt in range(_retries):
        # Rate limit
        await rate_limit_acquire()

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            logger.info(f"Sportradar GET: {endpoint}")
            response = await client.get(url, params=query_params)

            if response.status_code == 429:
                backoff = 1.5 * (attempt + 1)
                logger.warning(f"429 rate-limited on {endpoint}, retry {attempt + 1}/{_retries} after {backoff}s")
                _retry_log.append({
                    "endpoint": endpoint,
                    "attempt": attempt + 1,
                    "max_retries": _retries,
                    "backoff_seconds": backoff,
                })
                last_exc = httpx.HTTPStatusError(
                    f"429 Too Many Requests for {endpoint}",
                    request=response.request,
                    response=response,
                )
                await asyncio.sleep(backoff)
                continue

            response.raise_for_status()
            data = response.json()

        cache_set(cache_key, data)
        return data

    # All retries exhausted
    raise last_exc


# ---------------------------------------------------------------------------
# Player Endpoints
# ---------------------------------------------------------------------------
async def get_player_profile(player_id: str) -> dict:
    """
    Fetch comprehensive player profile including bio and season stats.

    Sportradar Endpoint: GET /players/{player_id}/profile.json

    Args:
        player_id: Sportradar player UUID

    Returns:
        Full player profile JSON (50KB+ raw, trimmed by caller)
    """
    return await _get(f"players/{player_id}/profile.json")


async def get_daily_schedule(target_date: Optional[date] = None) -> dict:
    """
    Fetch the NBA schedule for a specific date.

    Sportradar Endpoint: GET /games/{year}/{month}/{day}/schedule.json

    Args:
        target_date: Date to fetch (defaults to today)

    Returns:
        Schedule data with game times, teams, venues
    """
    d = target_date or date.today()
    return await _get(f"games/{d.year}/{d.month:02d}/{d.day:02d}/schedule.json")


async def get_standings(season_year: Optional[int] = None) -> dict:
    """
    Fetch NBA standings for a season.

    Sportradar Endpoint: GET /seasons/{year}/REG/standings.json

    Args:
        season_year: Season year (defaults to current season)

    Returns:
        Conference and division standings with win-loss records
    """
    year = _resolve_season_year(season_year)
    return await _get(f"seasons/{year}/REG/standings.json")


async def get_league_leaders(
    season_year: Optional[int] = None,
    category: str = "scoring",
) -> dict:
    """
    Fetch league leaders for a statistical category.

    Sportradar Endpoint: GET /seasons/{year}/REG/leaders.json

    Args:
        season_year: Season year
        category: One of "scoring", "rebounds", "assists", etc.

    Returns:
        League leader data with player rankings
    """
    year = _resolve_season_year(season_year)
    return await _get(f"seasons/{year}/REG/leaders.json")


async def get_player_game_logs(
    player_id: str,
    season_year: Optional[int] = None,
) -> dict:
    """
    Fetch a player's game-by-game stats for a season.

    Note:
        The NBA trial feed does not expose the old
        ``players/{id}/statistics.json`` endpoint and returns 404.
        We therefore derive game logs from ``players/{id}/profile.json``
        for the requested regular season when available.

    Args:
        player_id: Sportradar player UUID
        season_year: Season year

    Returns:
        Game log data with per-game stats
    """
    year = _resolve_season_year(season_year)
    raw_profile = await get_player_profile(player_id)

    seasons = raw_profile.get("seasons", [])
    reg_for_year = [
        season for season in seasons
        if season.get("type") == "REG" and int(season.get("year", -1)) == year
    ]

    games: list[dict] = []
    for season in reg_for_year:
        for team in season.get("teams", []):
            team_games = team.get("games", [])
            logger.info(
                f"[game_logs] player={player_id}, season={year}, "
                f"team={team.get('name', '?')}, games_found={len(team_games)}, "
                f"team_keys={list(team.keys())}"
            )
            games.extend(team_games)

    if not games:
        logger.warning(
            f"[game_logs] NO GAMES found for player={player_id}, season={year}, "
            f"reg_seasons_for_year={len(reg_for_year)}, "
            f"all_reg_years={[s.get('year') for s in seasons if s.get('type') == 'REG']}"
        )

    return {
        "player_id": player_id,
        "season": year,
        "games": games,
        "source": "profile_fallback",
    }


async def build_player_registry() -> dict[str, dict]:
    """
    Build a complete player registry from league hierarchy + team rosters.

    Flow: 1 hierarchy call (30 team IDs) → 30 team profile calls (all rosters).
    Total: 31 API calls, covers ALL 450+ NBA players.

    Returns:
        Dict mapping lowercase full names to player info dicts:
        {
            "jayson tatum": {
                "id": "uuid",
                "team": "Boston Celtics",
                "team_alias": "BOS",
                "position": "SF"
            }
        }
    """
    registry: dict[str, dict] = {}

    # Step 1: Get all team IDs from league hierarchy (1 API call)
    try:
        hierarchy = await _get("league/hierarchy.json")
    except Exception as e:
        logger.error(f"Failed to fetch league hierarchy: {e}")
        # Fallback to leaders-based registry (old approach)
        return await _build_registry_from_leaders()

    # Extract team IDs from conferences → divisions → teams
    teams: list[dict] = []
    for conference in hierarchy.get("conferences", []):
        for division in conference.get("divisions", []):
            for team in division.get("teams", []):
                teams.append({
                    "id": team.get("id", ""),
                    "name": f"{team.get('market', '')} {team.get('name', '')}".strip(),
                    "alias": team.get("alias", ""),
                })

    logger.info(f"Found {len(teams)} teams from hierarchy, fetching rosters...")

    # Step 2: Fetch each team's profile to get roster (30 API calls)
    for team_info in teams:
        team_id = team_info["id"]
        if not team_id:
            continue
        try:
            profile = await _get(f"teams/{team_id}/profile.json")
            players = profile.get("players", [])
            for player in players:
                pid = player.get("id", "")
                name = player.get("full_name", "")
                if not pid or not name:
                    continue
                draft = player.get("draft", {}) or {}
                registry[name.lower()] = {
                    "id": pid,
                    "team": team_info["name"],
                    "team_alias": team_info["alias"],
                    "position": player.get("position", ""),
                    "primary_position": player.get("primary_position", ""),
                    "jersey_number": player.get("jersey_number", ""),
                    "height": player.get("height", ""),       # inches
                    "weight": player.get("weight", ""),       # pounds
                    "birthdate": player.get("birthdate", ""),
                    "birth_place": player.get("birth_place", ""),
                    "experience": player.get("experience", ""),
                    "rookie_year": player.get("rookie_year", ""),
                    "college": player.get("college", ""),
                    "high_school": player.get("high_school", ""),
                    "draft_year": draft.get("year", ""),
                    "draft_round": draft.get("round", ""),
                    "draft_pick": draft.get("pick", ""),
                    "status": player.get("status", ""),       # ACT, IR, SUS, etc.
                }
            logger.info(f"  {team_info['alias']}: {len(players)} players")
        except Exception as e:
            logger.warning(f"Failed to fetch roster for {team_info['alias']}: {e}")
            continue

    logger.info(f"Player registry built: {len(registry)} players from {len(teams)} team rosters")
    return registry


async def _build_registry_from_leaders() -> dict[str, dict]:
    """Fallback: build registry from leaders endpoint if hierarchy fails."""
    year = _resolve_season_year()
    registry: dict[str, dict] = {}
    try:
        data = await _get(f"seasons/{year}/REG/leaders.json")
        for category in data.get("categories", []):
            for rank_entry in category.get("ranks", []):
                player = rank_entry.get("player", {})
                pid = player.get("id")
                name = player.get("full_name", "")
                if pid and name:
                    team = player.get("team", {})
                    registry[name.lower()] = {
                        "id": pid,
                        "team": f"{team.get('market', '')} {team.get('name', '')}".strip(),
                        "team_alias": team.get("alias", ""),
                        "position": player.get("position", ""),
                    }
        logger.info(f"Fallback registry built: {len(registry)} players from leaders")
    except Exception as e:
        logger.error(f"Failed to build fallback registry: {e}")
    return registry


# ---------------------------------------------------------------------------
# Trimming Helpers — Smart extraction, not data destruction
# ---------------------------------------------------------------------------
# Strategy: Keep everything useful (~2-3KB), drop only the deeply nested
# Sportradar metadata that no tool or narrator needs (IDs, league refs,
# venue details, broadcast info, etc.). Full raw is still in cache.
# ---------------------------------------------------------------------------


def trim_player_profile(raw: dict) -> dict:
    """
    Smart extraction from Sportradar player profile.

    Keeps: bio, current season averages, career totals, draft info, injury status.
    Drops: raw game arrays, Sportradar internal IDs, league metadata.
    Full raw response is always recoverable from cache.

    ~50KB raw → ~2-3KB useful context (not 500 bytes).
    """
    try:
        # ── Current season averages ──
        seasons = raw.get("seasons", [])
        reg_seasons = [s for s in seasons if s.get("type") == "REG"]
        current_season = max(reg_seasons, key=lambda s: s.get("year", 0), default={})
        teams = current_season.get("teams", [{}])
        current_team_stats = teams[-1] if teams else {}
        averages = current_team_stats.get("average", {})
        totals = current_team_stats.get("total", {})

        player_name = raw.get("full_name", "Unknown")

        # Detailed debug logging
        reg_years = [s.get("year") for s in reg_seasons]
        logger.info(
            f"[trim_player_profile] {player_name}: "
            f"total_seasons={len(seasons)}, reg_seasons={len(reg_seasons)}, "
            f"reg_years={reg_years}, "
            f"current_year={current_season.get('year', 'NONE')}, "
            f"teams_in_current={len(teams)}, "
            f"averages_keys={list(averages.keys())}, "
            f"totals_keys={list(totals.keys())[:5]}, "
            f"ppg={averages.get('points', 'MISSING')}, "
            f"rpg={averages.get('rebounds', 'MISSING')}, "
            f"apg={averages.get('assists', 'MISSING')}, "
            f"games_played={totals.get('games_played', 'MISSING')}"
        )
        if averages.get('points', 0) == 0 and totals.get('games_played', 0) == 0:
            logger.warning(
                f"[trim_player_profile] {player_name}: ZERO STATS! "
                f"Raw current_season keys={list(current_season.keys())}, "
                f"current_team_stats keys={list(current_team_stats.keys())}, "
                f"averages={dict(list(averages.items())[:8])}, "
                f"totals={dict(list(totals.items())[:8])}"
            )

        # ── Career totals (all regular seasons summed) ──
        career_games = 0
        career_points = 0
        career_seasons_count = len(reg_seasons)
        for s in reg_seasons:
            for t in s.get("teams", []):
                total = t.get("total", {})
                career_games += total.get("games_played", 0)
                career_points += total.get("points", 0)

        # ── Draft info ──
        draft = raw.get("draft", {})

        # ── Injury status ──
        injuries = raw.get("injuries", [])
        current_injury = injuries[0] if injuries else None

        result = {
            "name": raw.get("full_name", raw.get("name", "Unknown")),
            "team": raw.get("team", {}).get("name", "Unknown"),
            "team_market": raw.get("team", {}).get("market", ""),
            "position": raw.get("primary_position", raw.get("position", "Unknown")),
            "jersey": raw.get("jersey_number", ""),
            "height": raw.get("height", ""),
            "weight": raw.get("weight", ""),
            "birth_date": raw.get("birth_date", ""),
            "birth_place": raw.get("birth_place", ""),
            "experience": raw.get("experience", ""),
            "college": raw.get("college", ""),
            "rookie_year": raw.get("rookie_year", ""),
            "season_stats": {
                "season_year": current_season.get("year", ""),
                "ppg": averages.get("points", 0),
                "rpg": averages.get("rebounds", 0),
                "apg": averages.get("assists", 0),
                "spg": averages.get("steals", 0),
                "bpg": averages.get("blocks", 0),
                "fg_pct": averages.get("field_goals_pct", 0),
                "ft_pct": averages.get("free_throws_pct", 0),
                "three_pct": averages.get("three_points_pct", 0),
                "mpg": averages.get("minutes", 0),
                "turnovers": averages.get("turnovers", 0),
                "games_played": totals.get("games_played", 0),
                "games_started": totals.get("games_started", 0),
                "double_doubles": totals.get("double_doubles", 0),
                "triple_doubles": totals.get("triple_doubles", 0),
                "plus_minus": averages.get("plus_minus", 0),
                "offensive_rebounds": averages.get("off_rebounds", 0),
                "defensive_rebounds": averages.get("def_rebounds", 0),
                "personal_fouls": averages.get("personal_fouls", 0),
            },
            "career": {
                "seasons": career_seasons_count,
                "total_games": career_games,
                "total_points": career_points,
            },
        }

        # Draft info (if available)
        if draft:
            result["draft"] = {
                "year": draft.get("year", ""),
                "round": draft.get("round", ""),
                "pick": draft.get("pick", ""),
                "team": draft.get("team", {}).get("name", ""),
            }

        # Injury status (if any)
        if current_injury:
            result["injury"] = {
                "status": current_injury.get("status", ""),
                "description": current_injury.get("desc", current_injury.get("comment", "")),
                "start_date": current_injury.get("start_date", ""),
                "update_date": current_injury.get("update_date", ""),
            }

        return result

    except (IndexError, KeyError, TypeError) as e:
        logger.warning(f"Trimming failed, returning raw subset: {e}")
        return {
            "name": raw.get("full_name", "Unknown"),
            "team": "Unknown",
            "position": "Unknown",
            "season_stats": {},
        }


def trim_standings(raw: dict) -> dict:
    """
    Trim standings response to essential team records.

    Args:
        raw: Raw Sportradar standings response

    Returns:
        Simplified standings by conference
    """
    result = {"eastern": [], "western": []}

    for conference in raw.get("conferences", []):
        conf_key = "eastern" if "east" in conference.get("name", "").lower() else "western"
        for division in conference.get("divisions", []):
            for team in division.get("teams", []):
                result[conf_key].append({
                    "name": team.get("name", ""),
                    "market": team.get("market", ""),
                    "wins": team.get("wins", 0),
                    "losses": team.get("losses", 0),
                    "win_pct": team.get("win_pct", 0),
                    "games_behind": team.get("games_behind", {}).get("conference", 0),
                    "streak": team.get("streak", {}).get("desc", ""),
                })

    # Sort by win_pct descending
    for conf in result:
        result[conf].sort(key=lambda t: t.get("win_pct", 0), reverse=True)

    return result


def trim_daily_schedule(raw: dict) -> list[dict]:
    """
    Trim daily schedule to game summaries.

    Args:
        raw: Raw Sportradar daily schedule response

    Returns:
        List of simplified game dicts
    """
    games = []
    for game in raw.get("games", []):
        games.append({
            "id": game.get("id", ""),
            "status": game.get("status", ""),
            "scheduled": game.get("scheduled", ""),
            "home": {
                "name": game.get("home", {}).get("name", ""),
                "alias": game.get("home", {}).get("alias", ""),
                "score": game.get("home_points", 0),
            },
            "away": {
                "name": game.get("away", {}).get("name", ""),
                "alias": game.get("away", {}).get("alias", ""),
                "score": game.get("away_points", 0),
            },
            "venue": game.get("venue", {}).get("name", ""),
        })
    return games
