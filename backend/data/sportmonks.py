import requests
import pandas as pd
from tqdm import tqdm
import datetime

SPORTMONKS_KEY = "G0XEVwvQ9LFlc3CVqfBRvTANgQtjFe2gb2ZrenhUBgxcWOP7FDN32weoWCpR"
SPORTMONKS_API_URL = "https://api.sportmonks.com/v3/football"

SERIE_A_ID = 384
LEAGUE_MAPPING = {'Serie A': 384}
SEASON_MAPPING = {'2526': 25533, 
                  '1011': 1579, 
                  '1112': 1580, 
                  '1415': 1583, 
                  '1213': 1581, 
                  '1516': 1584, 
                  '2223': 19806, 
                  '1617': 802, 
                  '1718': 8557, 
                  '2324': 21818, 
                  '1819': 13158, 
                  '0506': 1574, 
                  '0607': 1575, 
                  '1314': 1582, 
                  '0708': 1576, 
                  '0809': 1577, 
                  '2425': 23746, 
                  '0910': 1578, 
                  '2122': 18576, 
                  '2021': 17488, 
                  '1920': 16415}
SEASON_MAPPING_IDS = {25533: '2526', 1579: '1011', 1580: '1112', 1583: '1415', 1581: '1213', 1584: '1516', 19806: '2223', 802: '1617', 8557: '1718', 21818: '2324', 13158: '1819', 1574: '0506', 1575: '0607', 1582: '1314', 1576: '0708', 1577: '0809', 23746: '2425', 1578: '0910', 18576: '2122', 17488: '2021', 16415: '1920'}
ITALIAN_TEAMS = {37: 'Roma', 43: 'Lazio', 102: 'Genoa', 109: 'Fiorentina', 113: 'Milan', 268: 'Como', 346: 'Udinese', 398: 'Parma', 585: 'Cagliari', 597: 'Napoli', 613: 'Torino', 625: 'Juventus', 708: 'Atalanta', 1072: 'Pisa', 1123: 'Hellas Verona', 2714: 'Sassuolo', 2930: 'Inter', 7790: 'Lecce', 8513: 'Bologna', 10722: 'Cremonese'}

SUPERLIGA_TEAM_2526_MAPPING = {'Viborg FF': 2447, 
                               'Vejle Boldklub': 7466, 
                               'Nordsjælland': 2394, 
                               'OB': 1789, 
                               'Randers FC': 2356, 
                               'Fredericia': 2933, 
                               'FC Midtjylland': 939, 
                               'Silkeborg IF': 86, 
                               'FC København': 85, 
                               'Sønderjyske Fodbold': 390, 
                               'Brøndby IF': 293, 
                               'AGF': 2905}
SUPERLIGA_SEASONS_TEAM_MAPPING = {759: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'Lyngby Boldklub': 2650, 'AGF': 2905}, 1273: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'AGF': 2905}, 1274: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'Vejle Boldklub': 7466}, 1275: {'FC København': 85, 'Horsens': 211, 'Brøndby IF': 293, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'Lyngby Boldklub': 2650, 'AGF': 2905}, 1276: {'FC København': 85, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'AGF': 2905, 'Vejle Boldklub': 7466}, 1277: {'FC København': 85, 'Silkeborg IF': 86, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'AGF': 2905, 'HB Køge': 6953}, 1278: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Lyngby Boldklub': 2650}, 1279: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'OB': 1789, 'Nordsjælland': 2394, 'Lyngby Boldklub': 2650, 'AGF': 2905, 'HB Køge': 6953}, 1280: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'AGF': 2905}, 1281: {'FC København': 85, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'AGF': 2905, 'Vestsjaelland': 8628}, 1282: {'FC København': 85, 'Silkeborg IF': 86, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'Hobro': 1703, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Vestsjaelland': 8628}, 1286: {'FC København': 85, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'Hobro': 1703, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'AGF': 2905}, 6361: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'Hobro': 1703, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Lyngby Boldklub': 2650, 'Vendsyssel': 2706, 'AGF': 2905, 'FC Helsingør': 8635}, 12919: {'FC København': 85, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'Hobro': 1703, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Vendsyssel': 2706, 'AGF': 2905, 'Vejle Boldklub': 7466}, 16020: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Esbjerg': 1371, 'Hobro': 1703, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Lyngby Boldklub': 2650, 'AGF': 2905}, 17328: {'FC København': 85, 'Horsens': 211, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Lyngby Boldklub': 2650, 'AGF': 2905, 'Vejle Boldklub': 7466}, 18334: {'FC København': 85, 'Silkeborg IF': 86, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'AGF': 2905, 'Vejle Boldklub': 7466}, 19686: {'FC København': 85, 'Silkeborg IF': 86, 'Horsens': 211, 'Brøndby IF': 293, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'Lyngby Boldklub': 2650, 'AGF': 2905}, 21644: {'FC København': 85, 'Silkeborg IF': 86, 'Brøndby IF': 293, 'FC Midtjylland': 939, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'Lyngby Boldklub': 2650, 'AGF': 2905, 'Vejle Boldklub': 7466, 'Hvidovre': 8657}, 23584: {'FC København': 85, 'Silkeborg IF': 86, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'Aalborg BK': 1020, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'Lyngby Boldklub': 2650, 'AGF': 2905, 'Vejle Boldklub': 7466}, 25536: {'FC København': 85, 'Silkeborg IF': 86, 'Brøndby IF': 293, 'Sønderjyske Fodbold': 390, 'FC Midtjylland': 939, 'OB': 1789, 'Randers FC': 2356, 'Nordsjælland': 2394, 'Viborg FF': 2447, 'AGF': 2905, 'Fredericia': 2933, 'Vejle Boldklub': 7466}}
STATISTICS_DETAIL_TYPE_MAPPING = {52: 'Goals', 84: 'Yellowcards', 88: 'Goals Conceded', 119: 'Minutes Played', 194: 'Cleansheets', 214: 'Team Wins', 215: 'Team Draws', 216: 'Team Lost', 321: 'Appearances', 322: 'Lineups'}

def get_all_leagues(per_page=50):
    """
    GET /leagues
    Returns a list of all leagues (id & name) available in your subscription.
    """
    leagues = []
    page = 1

    while True:
        url = f"{SPORTMONKS_API_URL}/leagues"
        params = {
            "api_token": SPORTMONKS_KEY,
            "per_page": per_page,
            "include": "seasons",
            "page": page
        }
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()
        leagues.extend(payload["data"])

        # stop if no more pages
        pagination = payload.get("meta", {}).get("pagination", {})
        if not pagination.get("has_more"):
            break
        page += 1

    return leagues

def get_all_seasons(league_id):
    """
    GET /seasons
    Returns a list of all seasons available in your subscription.
    """
    url = f"{SPORTMONKS_API_URL}/seasons"
    params = {
        "api_token": SPORTMONKS_KEY,
              "filters": f"seasonLeagues:{league_id}",
              "include": "teams"
              }
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    # The 'data' field contains a list of season objects
    return resp.json()["data"]

# GOOD
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

def get_team_players(team_id, season_stats_id, per_page=50, max_pages=10):
    """
    GET /players
    Returns all players by walking through each page.
    Free plan limits 'per_page' to max 50.
    """
    players = []
    page = 1

    while page <= max_pages:
        url = f"{SPORTMONKS_API_URL}/teams/{team_id}"
        params = {
            "api_token": SPORTMONKS_KEY,
            "per_page": per_page,
            # "filters": f"seasonLeagues:{league_id};playerstatisticSeasons:{season_stats_id};teamSeasons:{season_id}",
            # "filters": f"teamLeagues:{league_id};teamSeasons:{season_id};playerstatisticSeasons:{season_stats_id}",
            "filters": f"playerStatisticSeasons:{season_stats_id}",
            "include": "players.statistics.details",
            "page": page
        }
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()
        players.extend(payload["data"])

        # Check if there's another page
        pagination = payload.get("pagination", {})
        if not pagination.get("has_more"):
            break
        page += 1

    return players

def get_league_players(season_id, season_stats_id=None, per_page=50, max_pages=10):
    """
    GET /players
    Returns all players by walking through each page.
    Free plan limits 'per_page' to max 50.
    """
    players = []
    page = 1
    season_id_str = ",".join(map(str, season_stats_id)) if isinstance(season_stats_id, list) else str(season_stats_id)
    
    while page <= max_pages:
        url = f"{SPORTMONKS_API_URL}/players"
        params = {
            "api_token": SPORTMONKS_KEY,
            "per_page": per_page,
            "filters": f"playerStatisticSeasons:{season_id_str};season:{season_id}",
            "include": "statistics.details.type;squads",
            "page": page
        }
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()
        players.extend(payload["data"])

        # Check if there's another page
        pagination = payload.get("pagination", {})
        if not pagination.get("has_more"):
            break
        page += 1

    return players

def get_player_stats(player_id, team_id, season_stats_id=None, max_pages=10, per_page=50):
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
    
    stats_bool = len(player_data['statistics']) > 0
    
    overview_rows = []
    for stat in player_data['statistics']:
        overview_rows.append({
            "player_name" : player_name,
            "birthday"    : birthday,
            "current_team_id" : current_team_id,
            "current_team"    : current_team,
            
            'season_id'   : stat['season_id'],
            'season'      : SEASON_MAPPING_IDS[stat['season_id']],
            'stats_team_id'     : stat['team_id'],
            'stats_team'        : ITALIAN_TEAMS[stat['team_id']] if stat['team_id'] in ITALIAN_TEAMS else None,
            #  convenience: total appearances / minutes if present
            'appearances' : next((d['value']['total']
                                for d in stat['details'] if d['type_id'] == 321),
                                None),
            'minutes'     : next((d['value']['total']
                                for d in stat['details'] if d['type_id'] == 119),
                                None),
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
                "current_team_id", "current_team"]

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


def get_team_serie_a():
    """
    given this response data format:
    [{
            "id": 386,
            "sport_id": 1,
            "country_id": 251,
            "venue_id": 23057,
            "gender": "male",
            "name": "Olbia",
            "short_code": "OLB",
            "image_path": "https:\/\/cdn.sportmonks.com\/images\/soccer\/teams\/2\/386.png",
            "founded": 1905,
            "type": "domestic",
            "placeholder": false,
            "last_played_at": "2025-05-04 13:00:00",
            "created_by": 1,
            "updated_by": null,
            "created_at": "2017-04-21T17:19:47.000000Z",
            "updated_at": "2025-05-05T00:02:17.000000Z",
            "directory": 2,
            "country": {
                "id": 251,
                "continent_id": 1,
                "name": "Italy",
                "official_name": "Italian Republic",
                "fifa_name": "ITA",
                "iso2": "IT",
                "iso3": "ITA",
                "latitude": "42.7669792175293",
                "longitude": "12.493823051452637",
                "geonameid": 3175395,
                "borders": [
                    "AUT",
                    "FRA",
                    "SMR",
                    "SVN",
                    "CHE",
                    "VAT"
                ],
                "image_path": "https:\/\/cdn.sportmonks.com\/images\/countries\/png\/short\/it.png",
                "created_by": 1,
                "updated_by": 1,
                "created_at": null,
                "updated_at": null,
                "continent": {
                    "id": 1,
                    "name": "Europe",
                    "code": "EU",
                    "created_by": 1,
                    "updated_by": 1,
                    "created_at": "2017-05-04T19:31:29.000000Z",
                    "updated_at": "2017-05-04T19:31:29.000000Z"
                }
            },
            "active_seasons": [{
                    "id": 25642,
                    "sport_id": 1,
                    "league_id": 390,
                    "tie_breaker_rule_id": null,
                    "name": "2025\/2026",
                    "finished": false,
                    "pending": false,
                    "is_current": true,
                    "standing_method": "balance",
                    "starting_at": "2025-08-09",
                    "ending_at": "2025-08-18",
                    "standings_recalculated_at": null,
                    "created_by": 9,
                    "updated_by": null,
                    "created_at": "2025-06-26T12:08:15.000000Z",
                    "updated_at": "2025-07-15T02:02:22.000000Z",
                    "games_in_current_week": false,
                    "is_published": true,
                    "manual": false,
                    "pivot": {
                        "participant_type": "team",
                        "participant_id": 397,
                        "season_id": 25642
                    },
                    "league": {
                        "id": 390,
                        "legacy_id": null,
                        "sport_id": 1,
                        "country_id": 251,
                        "name": "Coppa Italia",
                        "active": true,
                        "short_code": "ITA Coppa",
                        "image_path": "https:\/\/cdn.sportmonks.com\/images\/soccer\/leagues\/6\/390.png",
                        "type": "league",
                        "sub_type": "domestic_cup",
                        "last_played_at": "2025-05-14T19:00:00.000000Z",
                        "created_by": 1,
                        "updated_by": null,
                        "created_at": "2017-03-24T16:35:23.000000Z",
                        "updated_at": "2025-05-14T21:00:29.000000Z",
                        "category": 2,
                        "has_jerseys": false,
                        "trg_last_played": "2025-05-14T21:00:25.000000Z",
                        "via_processor": "football",
                        "schedule_proxy": "zyte"
                    }
                }]
        },
        ...
        ]
        from this endpoint: https://my.sportmonks.com/api/id-finder/leagues/filter?sport=football&country_id=2&page=1
        
        Do:
        1. iterate through 44 pages
        2. if the active season is not empty, extract the team name associate to the id 
        3. return a dictionary with the id as key and the team name as value
    """
    
    teams = {}
    page = 1
    # --- Add browser-like headers for authentication and anti-bot bypass ---
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://my.sportmonks.com/resources/id-finder/teams",
        "X-Requested-With": "XMLHttpRequest",
        "X-XSRF-TOKEN": "eyJpdiI6InJmN3VYcTAvTnhhdEczSFpCUnFDenc9PSIsInZhbHVlIjoiMFdxNCt5am1JQ2pxdjRxNjBmMlJLNjhlRldybjJUQVJqOVFRc0NpTmJOdWVjaS94N2d5dGhaZDdzb0Zod0hLSnBLUGp3K21CTTMzUWY5ZWNDTnRHWW0wODZXbGJFUDF4MG9pdTBOQjREbDJXWWhXTTJJZENnbk94SVdMMzk1bkYiLCJtYWMiOiI5Y2YxZTI3MDRkZTM3YzMzYjgyY2FiYmQxMzIxN2E5ZjYyMDAzNTU2MmJiZTJiNGQyMzc1M2VkMTQ0OTg0ZDVkIiwidGFnIjoiIn0=",  # <-- Replace with your actual XSRF token
        "Cookie": "FPID=FPID2.2.m94Bw9wKWM8yOLrzCYZTWy3GHm0KOFU8XXddrUjSLZI%3D.1752507792; __stripe_mid=3c72bcdd-2fe6-4c90-8ea9-b1f895757cbf0742a6; chatbase_anon_id=32dd03c6-b278-4802-8479-cccf9ea9422f; __stripe_sid=4aaa7ec2-a0a1-4dcd-869c-6ecaa134ac16c752b6; CookieConsent={stamp:%27ai45f9bNJCNw+ITMelCNnN5lSwcg7hBFLR5D35J3OiUPIO65oDPgsA==%27%2Cnecessary:true%2Cpreferences:false%2Cstatistics:false%2Cmarketing:false%2Cmethod:%27explicit%27%2Cver:1%2Cutc:1752592276205%2Cregion:%27it%27}; _hjSession_3054013=eyJpZCI6ImE0ZDc2NDI4LWVlOWYtNDJkMi04ZGY2LTczNmVhMzY0NzlhZiIsImMiOjE3NTI1OTIzMjI2NTYsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjoxLCJzcCI6MX0=; _ga=GA1.1.1537156823.1752592985; _hjSessionUser_3054013=eyJpZCI6IjdmNDM5YmQ1LTRjNGEtNWQyOS04NzI0LWE3YzRkMjg0NTkwMCIsImNyZWF0ZWQiOjE3NTI1OTI4MDM0MTIsImV4aXN0aW5nIjp0cnVlfQ==; _gcl_au=1.1.1361464651.1752592985; FPLC=Z7OFgaF4I96j2%2FxBHxMhwicFA51LIZQehXBqocRsxOb9r2MOcqrSJrqYGCBOj3EZ0CvdALhV54ja5vyfM7OX2%2Fir5Buso2Sh5O9VnsIDnr%2FMVM4yD5hpb0zLcljv%2BA%3D%3D; _hjSession_5144977=eyJpZCI6IjcyOWVjMzg0LTQzYjQtNGUzYi1hYTFjLTYxMGFhNTA1NTRkYiIsImMiOjE3NTI1OTM1NTIwMDAsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_2222222=GS2.1.s1752592984$o1$g1$t1752594651$j60$l0$h413181469; XSRF-TOKEN=eyJpdiI6InJmN3VYcTAvTnhhdEczSFpCUnFDenc9PSIsInZhbHVlIjoiMFdxNCt5am1JQ2pxdjRxNjBmMlJLNjhlRldybjJUQVJqOVFRc0NpTmJOdWVjaS94N2d5dGhaZDdzb0Zod0hLSnBLUGp3K21CTTMzUWY5ZWNDTnRHWW0wODZXbGJFUDF4MG9pdTBOQjREbDJXWWhXTTJJZENnbk94SVdMMzk1bkYiLCJtYWMiOiI5Y2YxZTI3MDRkZTM3YzMzYjgyY2FiYmQxMzIxN2E5ZjYyMDAzNTU2MmJiZTJiNGQyMzc1M2VkMTQ0OTg0ZDVkIiwidGFnIjoiIn0%3D; mysportmonks_session=eyJpdiI6IlRnOEpaL2lsbENLTWpsbUFFSEVWL1E9PSIsInZhbHVlIjoiOXN0SCthY2RSbmJ0UnIyc2pFT1ZmOW1vYmJsUHI1YXVWdUNWNUZ2a3VLSU9WYjNMYWdncnlpQUFCWEoxc3UwZ2NRVHA5MkViRmtGV3dRcGZMT3psbmJ3K1JJWFRrUFNuL05jbldRTUZQZGhVdTJXSEQzR0JkWUxYYnR2cGVnUksiLCJtYWMiOiIxMTVmZjRkN2M4ZjFhZTRjYTdlOTA2OThkYzc5MDU1ZTY1MTMxMjljODVlZjc2NTBiMzk4MWViNzk0M2RjZDYxIiwidGFnIjoiIn0%3D; C2CaB3ZZIGu6fm1e65lPglwp3VIQqiE9vLTAgFqK=eyJpdiI6Im42MVpGMnp5SE1wZ0FSWDB5QWd6clE9PSIsInZhbHVlIjoib2JjYkR0b0RWNzNFa2ptN1UyRnpZNFd3MzA0VEhJNExDZisxbXNZT09FcUErR3JqV0FDNm4zOWJHS25HbEtjOWpQNU56OC9uVUpjcitXM2VObnB0QlVHY0Nhbk8yRXJpVWJRU0tTQ1MzZ3BiRnhNdG1RbXB1YmxURVZuTVBGS3NLSXJSNFc4TmlWVUlzdDV6RXczM2pkeHhlVFlKNUlsdXl4Um5Jdzdoc1BCOHNsYXhScWZoQS9JdHpvbjFFbFhMbHFjY0FJY3VwTVIxbUlVQ05HZ2R0QmdmMklzajJaZjZEd0Fhb045TkN2RWpWK0Npek1tczREREpMUXJDUDZZYzlmUDdodWJ4TVd6NHJVekRkWXBmVzhIRXJhd1AwdnBKclVZWE5Pc0c3TC9uNmtvMkljTzlNNVNrbStEUGRaOGt4Q1dpTGJNTVdoci82YlFibVYyVk9IZ0lOOE16RkYwSTlvNnJrYjczdFduODdDTUJQZkxyTkR0ZEFubC9MQWtBTU5YSXdCMUw5ZXpDN2N1RDZKY2pUSi9CQ2pRcHRvTnJzeDYzeGtoZ2p2TjIwZmJFbk15dkI4Y2pqLzFvQVA3SEZiWkxNNk5VM0VpMG55NFBmdU14NjlZaUsrS0pCTk5vYVdBazBmeVE1SVFVT0YxcUxrMEkyK3prbWlKSUp2N2ZBcndvSzU0NE04Q2dEa0xRaGUzbVRLU2d5ckpXbHBqR215Vkd0Q0g3RWR6cDluRHdxektFeXVmK2JBY1hEbVlQNHQrQ0JwRVJPT2dUZDFKcjQvS1JHeFFyd1FmQTdJcXk2a3VYb2g1ZSsrZFlpbFBWd3NZazdId1lYZGhvRFJjNGRDL1ArZHZtUENNTXhkdHorREJIZ0F4VjZLcGV6ejBBaEdrSEoxYm01Wi9VVmdraTRCeDJSM2ZRTHU3VW5OdjBBU3RKVWpGZlU3L1hkLzdiVElTV1JaYjlFNkNBb2h3T28wMGl0bnc4Z0lPODBaVTJKVGJHOFI0REZjcFNiM1BSVGMrV2pDVVFWaDBCbzNVSUJBUFJwbmpwMG4vcHdIZlZCOVBQaVZDWTJ0UWQrZm5XbEEydjFWMWNtZTIyS25naVZ0Um9tSWJhbU1sMWEzdHl5NldkblRXMlIxT29raEkzRjIzOHhsbFVMUnlBNUtrbHRRWTVJTlZ1c2ptUWtlU1M3VWMxeWxCRGdEbDlzbGQzREV4R0c5bWovazgxRGVsM2I2aVo4dlhObE1PaStEaGNyai9HY05qaGdQT2xrOU1jWGtLb2VCM002R2VJUmdkQ09sWXMwMFJidTdDVnU0Tk92UkF6b2d6ZDIxVTdTZDBxd2JOaGhveXdHUmRPSFlxOWpBQlpFM3NIMGgyckhEN0R2eTBTcWJLM0dXUlFqUXFKL3JxbkhNc3FRNmFYWUdwTzk4aFhjWS9odW9LU3Q5RDh0R0lKVENHRU9aby9XQTE5aGNEUUxBMS9CaUx1bWVBajQvR1Avdm96amdNUnRCdlhtbGdHaTQrbWtaSnd3NmJxYXdpYUk4bGVDTjJ0Mlc5RmlBbDFzQ1RWdk5VMlIyYnFxWitHOEk4UTFtNG1xTGdjZndHOVNYRllEczFWaGIrNyIsIm1hYyI6IjE4MDQyMDdmZGQyMzU4ZmI2YWViNTZlZGUxZmQwNGIwZTVjNWFiNzhkMmNjZGM5ZmEzNjE2MDJjOTIwMzQyMWYiLCJ0YWciOiIifQ%3D%3D; _ga_0PDNNF5T0M=GS2.1.s1752592984$o1$g1$t1752594872$j60$l0$h2128637226; FPGSID=1.1752594796.1752594872.G-0PDNNF5T0M.fSIfdv73T3K9l7C_n_DhlA"  # <-- Replace with your actual cookies
    }
    while page <= 44:
        url = f"https://my.sportmonks.com/api/id-finder/teams/filter?sport=football&country_id=251&page={page}"
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        
        for team in data['data']:
            if team['active_seasons']:
                team_name = team['name']
                team_id = team['id']
                teams[team_id] = team_name
        
        page += 1
    
    return teams
        
if __name__ == "__main__":
    # leagues = get_all_leagues()
    # # # create a mapping of league id to name
    # league_mapping = {league['name']: league['id'] for league in leagues}
    # season_mapping = {season['name']: season['id'] for season in leagues[0]['seasons']}
    # team_mapping = {team['name']: team['id'] for team in leagues[0]['teams']}
    # italian_teams = get_team_serie_a()
    
    
    current_season = SEASON_MAPPING['2526']
    statistics_seasons = [SEASON_MAPPING['2425'], SEASON_MAPPING['2324'], SEASON_MAPPING['2223']]
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
                player_stats = get_player_stats(player_id, team_id, season_stats_id=statistics_seasons, max_pages=10)
                if isinstance(player_stats, dict) and 'totals' in player_stats:
                    stats = player_stats['totals']
                    # Align columns by index, ignore columns that don't match
                    statistics = pd.concat([statistics, stats], axis=0, ignore_index=True, sort=False)
    statistics.to_csv(f'player_statistics_{readable_timestamp}.csv', index=False)
    