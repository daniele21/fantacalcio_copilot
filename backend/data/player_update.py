

import datetime
import pandas as pd
import requests
from tqdm import tqdm
from backend.data import ITALIAN_TEAMS, POSITIONS, SEASON_MAPPING, SPORTMONKS_API_URL, SPORTMONKS_KEY
from backend.data.sportmonks import SEASON_MAPPING_IDS


def get_season_team_players(team_id, season_id, season_stats_id, per_page=50, max_pages=10):
    """
    GET /players
    Returns all players by walking through each page.
    Free plan limits 'per_page' to max 50.
    """
    players = []
    page = 1

    condition = page <= max_pages if max_pages is not None else True
    season_id_str = ",".join(map(str, season_stats_id)) if isinstance(season_stats_id, list) else str(season_stats_id)
    
    while condition:
        # url = f"{SPORTMONKS_API_URL}/squads/seasons/{season_id}/teams/{team_id}"
        url = f"{SPORTMONKS_API_URL}/squads/seasons/{season_id}/teams/{team_id}"
        params = {
            "api_token": SPORTMONKS_KEY,
            "per_page": per_page,
            # "filters": f"playerStatisticSeasons:{season_id_str}",
            "include": "player;",
            "page": page 
        }
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()
        if 'data' in payload:
            players.extend([x['player_id'] for x in payload['data']])
            
        # Check if there's another page
        pagination = payload.get("pagination", {})
        if not pagination.get("has_more"):
            break
        page += 1

    return players


def get_current_player_stats(player_id, team_id, season_stats_id=None, max_pages=10, per_page=50):
    page = 1
    condition = page <= max_pages if max_pages is not None else True
    season_id_str = ",".join(map(str, season_stats_id)) if isinstance(season_stats_id, list) else str(season_stats_id)
    
    while condition:
        # url = f"{SPORTMONKS_API_URL}/squads/seasons/{season_id}/teams/{team_id}"
        url = f"{SPORTMONKS_API_URL}/players/{player_id}"
        params = {
            "api_token": SPORTMONKS_KEY,
            "per_page": per_page,
            "filters": f"playerStatisticSeasons:{season_id_str}",
            "include": "statistics.details.type",
            "page": page 
        }
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()
        if 'data' in payload:
            stats = refactor_statistics(payload['data'], team_id)
        else:
            return None

        # Check if there's another page
        pagination = payload.get("pagination", {})
        if not pagination.get("has_more"):
            break
        page += 1

    return stats

def refactor_statistics(player_data, team_id):
    import pandas as pd
    from collections import defaultdict
    from itertools import chain

    # --------------------------------------------------
    # 1)  Put the API response in `player`
    # --------------------------------------------------
    # player = requests.get(...).json()['data']        # usual way
    # --- for this example assume you've placed the big dict in `player` ---

    # --------------------------------------------------
    # 2)  High‑level season overview  (one row per season)
    # --------------------------------------------------
    
    player_name = player_data["display_name"]
    birthday    = player_data["date_of_birth"]
    current_team_id = team_id
    current_team = ITALIAN_TEAMS[team_id]
    position_id = player_data['position_id']
    position = POSITIONS[position_id] if position_id in POSITIONS else None
    
    stats_bool = len(player_data['statistics']) > 0
    
    overview_rows = []
    for stat in player_data['statistics']:
        details = stat['details']
        def get_stat(type_id, key='total'):
            return next((d['value'].get(key)
                        for d in details if d['type_id'] == type_id and key in d['value']), None)
        overview_rows.append({
            "player_name" : player_name,
            "birthday"    : birthday,
            "current_team_id" : current_team_id,
            "current_team"    : current_team,
            "position_id" : position_id,
            "position"    : position,
            'season_id'   : stat['season_id'],
            'season'      : SEASON_MAPPING_IDS[stat['season_id']],
            'stats_team_id'     : stat['team_id'],
            'stats_team'        : ITALIAN_TEAMS[stat['team_id']] if stat['team_id'] in ITALIAN_TEAMS else None,
            # Requested fields by type_id
            # 'shots_off_target': get_stat(41),
            # 'shots_total': get_stat(42),
            # 'fouls': get_stat(56),
            # 'substitutions': get_stat(59),
            # 'shots_blocked': get_stat(58),
            # 'tackles': get_stat(78),
            # 'assists': get_stat(79),
            # 'passes': get_stat(80),
            # 'yellowcards': get_stat(84),
            # 'shots_on_target': get_stat(86),
            # 'goals_conceded': get_stat(88),
            # 'dispossessed': get_stat(94),
            # 'fouls_drawn': get_stat(96),
            # 'total_crosses': get_stat(98),
            # 'accurate_crosses': get_stat(99),
            # 'clearances': get_stat(101),
            # 'total_duels': get_stat(105),
            # 'duels_won': get_stat(106),
            # 'aerials_won': get_stat(107),
            # 'dribble_attempts': get_stat(108),
            # 'successful_dribbles': get_stat(109),
            # 'dribbled_past': get_stat(110),
            # 'accurate_passes': get_stat(116),
            # 'key_passes': get_stat(117),
            # 'rating': get_stat(118),
            # 'minutes': get_stat(119),
            # 'long_balls': get_stat(122),
            # 'long_balls_won': get_stat(123),
            # 'cleansheets': get_stat(194),
            # 'team_wins': get_stat(214),
            # 'team_lost': get_stat(216),
            # 'appearances': get_stat(321),
            # 'lineups': get_stat(322),
            # 'bench': get_stat(323),
            # 'big_chances_created': get_stat(580),
            # 'accurate_passes_pct': get_stat(1584),
            # 'interceptions': get_stat(100),
            # 'goals': get_stat(52),
            # 'average_points_per_game': get_stat(9676),
            # 'blocked_shots': get_stat(97),
            # 'crosses_blocked': get_stat(27255)
        })
    stats_df = pd.DataFrame(overview_rows)

    # --------------------------------------------------
    # 3)  Full detail table  (one row per statistic detail)
    #     We *explode* each nested value‑dict into flat columns
    # --------------------------------------------------
    detail_rows = []
    for stat in player_data['statistics']:
        for d in stat['details']:
            base = {
                "player_name" : player_name,
                "birthday"    : birthday,
                'current_team_id' : current_team_id,
                'current_team'    : current_team,
                'position_id' : position_id,
                'position'    : position,
                'season_id' : stat['season_id'],
                'season'      : SEASON_MAPPING_IDS[stat['season_id']],
                'stats_team_id'   : stat['team_id'],
                'stats_team'        : ITALIAN_TEAMS[stat['team_id']] if stat['team_id'] in ITALIAN_TEAMS else None,
                'type_id'   : d['type']['id'],
                'type_name' : d['type']['name'],
                'group'     : d['type'].get('stat_group'),
            }
            # expand the value‑dict (keys vary by type)
            for k, v in d['value'].items():
                row          = base.copy()
                row['metric'] = k
                row['value']  = v
                detail_rows.append(row)

    details_df = pd.DataFrame(detail_rows)

    # --------------------------------------------------
    # 4)  (Optional) Pivot `details_df` to wide format
    #     — keeps one metric per statistic type (e.g. the 'total' figure)
    # --------------------------------------------------
    index_cols = ["player_name", "birthday",
                "season_id", "season",
                "stats_team_id", "stats_team",
                "current_team_id", "current_team",
                "position_id", "position"]

    pivoted = (
        details_df
        .pivot_table(index=index_cols,
                    columns=["type_name", "metric"],
                    values="value",
                    aggfunc="first")
        .reset_index()
        if not details_df.empty else
        pd.DataFrame(columns=index_cols)
    )

    # ------ flatten columns if we pivoted ------------------------------
    if not pivoted.empty:
        flat = []
        for col in pivoted.columns:
            flat.append("_".join(map(str, col)).rstrip("_") if isinstance(col, tuple) else col)
        pivoted.columns = flat
    # -------------------------------------------------------------------

    if pivoted.empty:                       # ← only now we build the stub
        stub_row = {
            "player_name"     : player_name,
            "birthday"        : birthday,
            "current_team_id" : current_team_id,
            "current_team"    : current_team,
            "position_id"     : position_id,
            "position"        : position,
            **{c: None for c in index_cols if c.startswith("season") or c.startswith("stats_")}
        }
        totals_wide = pd.DataFrame([stub_row])
    else:
        totals_wide = pivoted.copy()  
        
    totals_wide = _harmonise(totals_wide, index_cols)

    return {'overview': stats_df, 'details': details_df, 'totals': totals_wide}

def _harmonise(df: pd.DataFrame, index_cols: list[str]) -> pd.DataFrame:
    """
    1. guarantees every metric column exists (adds all‑NaN if missing)
    2. orders cols -> id‑columns first, metrics A‑Z
    3. converts metrics to Float64 / nullable Int64
    """
    import numpy as np
    metric_cols = sorted(c for c in df.columns if c not in index_cols)

    # add missing metric columns
    for col in metric_cols:
        if col not in df.columns:
            df[col] = np.nan

    # reorder
    df = df[index_cols + metric_cols]

    # cast metrics
    for col in metric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")   # float64 or Int64

        # ---- safe "is whole number" test -----------------
        s = df[col].dropna()
        if (s % 1 == 0).all():              # works for int & float
            df[col] = df[col].astype("Int64")
    return df



if __name__ == "__main__":
    current_season = SEASON_MAPPING['2526']
    statistics_seasons = current_season
    team_players = {}
    statistics = pd.DataFrame()
    # Generate a readable timestamp for the filename
    readable_timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    for team_id, team_name in tqdm(ITALIAN_TEAMS.items()):
        print(f"\nTeam: {team_name}, ID: {team_id}")
        temp_team_players = get_season_team_players(team_id, current_season, statistics_seasons, max_pages=10)
        if len(temp_team_players) > 0:
            team_players[team_id] = temp_team_players
            for player_id in temp_team_players:
                player_stats = get_current_player_stats(player_id, team_id, season_stats_id=statistics_seasons, max_pages=10)
                if isinstance(player_stats, dict) and 'totals' in player_stats:
                    stats = player_stats['totals']
                    # Align columns by index, ignore columns that don't match
                    statistics = pd.concat([statistics, stats], axis=0, ignore_index=True, sort=False)

    statistics.to_csv(f'updated_current_player_statistics_{readable_timestamp}.csv', index=False)
