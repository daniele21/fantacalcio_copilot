import os
import mysql.connector
from mysql.connector import Error
import ast

from tqdm import tqdm

# Connessione globale riutilizzabile
_conn = None

def get_db_config():
    """
    Restituisce la configurazione per il DB.
    Se le variabili d'ambiente CLOUDSQL_HOST, CLOUDSQL_USER, CLOUDSQL_PASSWORD, CLOUDSQL_DATABASE
    non sono settate, usa i valori di default per un DB locale.
    """
    return {
        'host': os.environ.get('CLOUDSQL_HOST', 'localhost'),
        'user': os.environ.get('CLOUDSQL_USER', 'root'),
        'password': os.environ.get('CLOUDSQL_PASSWORD', ''),
        'database': os.environ.get('CLOUDSQL_DATABASE', 'fantacalcio')
    }

def get_connection():
    """
    Restituisce una connessione MySQL o SQLite a seconda della variabile d'ambiente DB_TYPE.
    """
    global _conn
    db_type = os.environ.get('DB_TYPE', 'mysql')
    if db_type == 'sqlite':
        import sqlite3
        db_path = os.environ.get('SQLITE_PATH', os.path.join(os.path.dirname(__file__), 'fantacalcio.db'))
        if _conn is None:
            _conn = sqlite3.connect(db_path)
        return _conn
    else:
        if _conn is None or not _conn.is_connected():
            cfg = get_db_config()
            _conn = mysql.connector.connect(**cfg)
        return _conn

def insert_giocatori_from_records(records, conn=None):
    """
    Inserisce una lista di dict (estratti dallo scraping) nella tabella giocatori o in Firestore.
    Ogni dict deve avere le chiavi coerenti con le colonne della tabella.
    """
    import os
    db_type = os.environ.get('DB_TYPE', 'sqlite')
    # Define the canonical column names for both SQL and Firestore
    columns = [
        "id",  # Add id as the first column
        "nome", "cognome", "punteggio", "fantamedia_2024_2025", "fantamedia_2023_2024", "fantamedia_2022_2023",
        "presenze_2024_2025", "fanta_media_2024_2025", "fm_su_tot_gare_2024_2025", "presenze_previste",
        "gol_previsti", "assist_previsti", "ruolo", "ruolo_m", "ruolo_quote", "skills", "buon_investimento", "resistenza_infortuni",
        "consigliato", "infortunato", "nuovo_acquisto", "squadra", "squadra_quote", "quota_attuale", "quota_iniziale", "diff", "quota_attuale_m", "quota_iniziale_m", "diff_m", "fvm", "fvm_m", "trend", "presenze", "appetibilita", "recommendation", 
        "fvm_recommendation", "suggested_bid_min", "suggested_bid_max",
        "last_modified"
    ]
    key_map = {
        'id': 'id',
        "Nome": "nome", "Cognome": "cognome", "Punteggio": "punteggio",
        "Fantamedia_2024-2025": "fantamedia_2024_2025", "Fantamedia_2023-2024": "fantamedia_2023_2024", "Fantamedia_2022-2023": "fantamedia_2022_2023",
        "Presenze 2024-2025": "presenze_2024_2025", "Fanta Media 2024-2025": "fanta_media_2024_2025", "FM su tot gare 2024-2025": "fm_su_tot_gare_2024_2025",
        "Presenze previste": "presenze_previste", "Gol previsti": "gol_previsti", "Assist previsti": "assist_previsti",
        "Ruolo": "ruolo", "Ruolo_m": "ruolo_m", "Ruolo_quote": "ruolo_quote", "Skills": "skills", "Buon_investimento": "buon_investimento",
        "Resistenza_infortuni": "resistenza_infortuni", "Consigliato": "consigliato", "Infortunato": "infortunato", "Nuovo_acquisto": "nuovo_acquisto",
        "Squadra": "squadra", "squadra_quote": "squadra_quote", "QuotaAttuale": "quota_attuale", "QuotaIniziale": "quota_iniziale", "Diff": "diff",
        "Qt.A M": "quota_attuale_m", "Qt.I M": "quota_iniziale_m", "Diff.M": "diff_m", "FVM": "fvm", "FVM M": "fvm_m", "Trend": "trend",
        "Presenze": "presenze", "Appetibilita": "appetibilita", "recommendation": "recommendation",
        "fvm_recommendation": "fvm_recommendation", "suggested_bid_min": "suggested_bid_min", "suggested_bid_max": "suggested_bid_max"
    }
    if db_type == 'firestore':
        from google.cloud import firestore
        firestore_db = os.environ.get('FIRESTORE_DB_NAME', 'fantacopilot-db')
        db = firestore.Client(project="fantacalcio-project", database=firestore_db)
        print(f"Using Firestore database: {firestore_db}")
        # DELETE ALL DOCS IN 'giocatori' COLLECTION FIRST
        giocatori_ref = db.collection('giocatori')
        docs = giocatori_ref.stream()
        delete_count = 0
        for doc in tqdm(docs):
            doc.reference.delete()
            delete_count += 1
        print(f"Deleted {delete_count} existing docs from 'giocatori' collection.")
        # Now insert new docs in batches of 500
        BATCH_SIZE = 500
        total = len(records)
        for batch_start in range(0, total, BATCH_SIZE):
            batch = db.batch()
            batch_end = min(batch_start + BATCH_SIZE, total)
            for idx in range(batch_start, batch_end):
                rec = records[idx]
                firestore_doc = {}
                for k, v in rec.items():
                    canonical_key = key_map.get(k, k)
                    if canonical_key in columns:
                        firestore_doc[canonical_key] = v
                # Ensure id is present and unique (use idx if not present)
                firestore_doc["id"] = firestore_doc.get("id", idx)
                # Ensure skills is always a list
                skills_val = firestore_doc.get("skills")
                if isinstance(skills_val, str):
                    try:
                        import ast
                        skills_list = ast.literal_eval(skills_val)
                        if not isinstance(skills_list, list):
                            raise Exception()
                    except Exception:
                        if ',' in skills_val:
                            skills_list = [s.strip() for s in skills_val.split(',') if s.strip()]
                        else:
                            skills_list = [skills_val.strip()]
                elif isinstance(skills_val, list):
                    skills_list = skills_val
                else:
                    skills_list = []
                firestore_doc["skills"] = skills_list
                # Always include all columns, fill missing with None
                for col in columns:
                    firestore_doc.setdefault(col, None)
                doc_id = str(idx)
                doc_ref = db.collection('giocatori').document(doc_id)
                batch.set(doc_ref, firestore_doc, merge=True)
            batch.commit()
            print(f"Inserted docs {batch_start} to {batch_end-1} into 'giocatori' collection.")
        print(f"Inserted {len(records)} new docs into 'giocatori' collection.")
        return
    close_conn = False
    if conn is None:
        conn = get_connection()
    else:
        close_conn = False  # Don't close if passed in
    cursor = conn.cursor()
    if db_type == 'sqlite':
        placeholder = "?"
    else:
        placeholder = "%s"
    sql = f'''
        INSERT INTO giocatori (
            {', '.join(columns)}
        ) VALUES ({', '.join([placeholder]*len(columns))})
    '''
    for rec in records:
        # Map input record to canonical column names
        sql_row = []
        canonical_rec = {col: None for col in columns}
        for k, v in rec.items():
            canonical_key = key_map.get(k, k.lower())
            if canonical_key in columns:
                canonical_rec[canonical_key] = v
        # Ensure id is present and unique (use idx if not present)
        canonical_rec["id"] = canonical_rec.get("id", idx)
        sql_row = [canonical_rec[col] for col in columns]
        cursor.execute(sql, sql_row)
    conn.commit()
    cursor.close()
    if close_conn:
        conn.close()

def insert_giocatori_from_csv_records(records, conn=None):
    """
    Inserisce una lista di dict (estratti da CSV con colonne canoniche) nella tabella giocatori.
    Usa il keymap fornito per la mappatura delle colonne.
    Gestisce sia SQLite che Firestore in base a DB_TYPE.
    """
    import os
    db_type = os.environ.get('DB_TYPE', 'sqlite')
    columns = [
        "id",  # Add id as the first column
        "player_name", "birthday", "season_id", "season", "stats_team_id", "stats_team", "current_team_id", "current_team",
        "position_id", "position", "accurate_crosses_total", "accurate_passes_percentage_total", "accurate_passes_total",
        "aerials_won_total", "appearances_total", "assists_total", "average_points_per_game_average", "bench_total",
        "big_chances_created_total", "big_chances_missed_total", "cleansheets_away", "cleansheets_home",
        "cleansheets_total", "clearances_total", "crosses_blocked_crosses_blocked", "dispossessed_total",
        "dribble_attempts_total", "dribbled_past_total", "duels_won_total", "fouls_drawn_total", "fouls_total",
        "goals_conceded_total", "goals_goals", "goals_penalties", "goals_total", "injuries_total",
        "interceptions_total", "key_passes_total", "lineups_total", "long_balls_won_total",
        "long_balls_total", "minutes_played_total", "passes_total", 
        "rating_average", "rating_highest", "rating_lowest", "shots_blocked_total", "shots_off_target_total",
        "shots_on_target_total", "shots_total_total", "substitutions_in", "substitutions_out", "successful_dribbles_total",
        "tackles_total", "team_draws_total", "team_lost_total", "team_wins_total", "through_balls_total",
        "total_crosses_total", "total_duels_total", "yellowcards_away", "yellowcards_home", "yellowcards_total",
        "blocked_shots_total", "own_goals_total", "penalties_committed", "penalties_missed",
        "penalties_saved", "penalties_scored", "penalties_total", "penalties_won", "redcards_away",
        "redcards_home", "redcards_total", "captain_total", "hit_woodwork_total", "offsides_total",
        "through_balls_won_total", "yellowred_cards_away", "yellowred_cards_home", "yellowred_cards_total",
        "error_lead_to_goal_total", "saves_insidebox_total", "saves_total", "hattricks_average", "hattricks_total",
        "years_old", "goals_per_90", "assists_per_90", "big_chances_created_per_90", "conversion_rate",
        "key_passes_per_90", "crosses_per_90", "accurate_crosses_per_90", "cross_accuracy",
        "dribble_success_rate", "aerial_duels_win_rate", "aerials_won_per_90", "duels_won_rate",
        "blocked_shots_per_90", "clearances_per_90", "def_actions", "def_actions_per_90",
        "tackle_success_rate", "clean_sheet_rate", "goals_conceded_per_90", "cards_total", "cards_per_90",
        "fouls_drawn_per_90", "starting_rate", "minutes_share", "bench_rate", "injury_risk", "injury_risk_band",
        "penalty_success_rate", "saves_per_90", "save_success_rate", "pen_save_rate",
        "def_actions_per_90_rank", "rating_std", "volatility_index", "pen_save_rate_z",
        "key_passes_per_90_z", "goals_conceded_per_90_z", "rating_average_z", "starting_rate_z",
        "def_actions_per_90_z", "minutes_share_z", "assists_per_90_z", "big_chances_created_per_90_z",
        "clean_sheet_rate_z", "saves_per_90_z", "aerial_duels_win_rate_z", "goals_per_90_z",
        "dribble_success_rate_z", "conversion_rate_z", "injury_risk_z", "tackle_success_rate_z",
        "crosses_per_90_z", "cards_per_90_z", "save_success_rate_z", "att_perf", "cen_perf",
        "dif_perf", "por_perf", "role_perf", "stars", "skills",
        'quotatarget', 'predicted_price', 'yellowcards_per_90', 'redcards_per_90', 'own_goals_per_90',
        'penalties_saved_per_90', 'gol_bonus', 'assist_bonus', 'clean_sheet_bonus', 'titolarita',
        'malus_risk_raw', 'pen_save_bonus', 'xfp_90', 'xfp_per_game',
                'price_expected', 'xfp_season',
        'risk_coeff',
        'hype_coeff',
        'range_low',
        'range_high',
    ]
    key_map = {
        'id': 'id',
        'player_name': 'player_name', 'birthday': 'birthday', 'season_id': 'season_id', 'season': 'season',
        'stats_team_id': 'stats_team_id', 'stats_team': 'stats_team', 'current_team_id': 'current_team_id', 'current_team': 'current_team',
        'position_id': 'position_id', 'position': 'position', 'Accurate_Crosses_total': 'accurate_crosses_total',
        'Accurate_Passes_Percentage_total': 'accurate_passes_percentage_total', 'Accurate_Passes_total': 'accurate_passes_total',
        'Aerials_Won_total': 'aerials_won_total', 'Appearances_total': 'appearances_total', 'Assists_total': 'assists_total',
        'Average_Points_Per_Game_average': 'average_points_per_game_average', 'Bench_total': 'bench_total',
        'Big_Chances_Created_total': 'big_chances_created_total', 'Big_Chances_Missed_total': 'big_chances_missed_total',
        'Cleansheets_away': 'cleansheets_away', 'Cleansheets_home': 'cleansheets_home', 'Cleansheets_total': 'cleansheets_total',
        'Clearances_total': 'clearances_total', 'Crosses_Blocked_crosses_blocked': 'crosses_blocked_crosses_blocked',
        'Dispossessed_total': 'dispossessed_total', 'Dribble_Attempts_total': 'dribble_attempts_total',
        'Dribbled_Past_total': 'dribbled_past_total', 'Duels_Won_total': 'duels_won_total', 'Fouls_Drawn_total': 'fouls_drawn_total',
        'Fouls_total': 'fouls_total', 'Goals_Conceded_total': 'goals_conceded_total', 'Goals_goals': 'goals_goals',
        'Goals_penalties': 'goals_penalties', 'Goals_total': 'goals_total', 'Injuries_total': 'injuries_total',
        'Interceptions_total': 'interceptions_total', 'Key_Passes_total': 'key_passes_total', 'Lineups_total': 'lineups_total',
        'Long_Balls_Won_total': 'long_balls_won_total', 'Long_Balls_total': 'long_balls_total', 'Minutes_Played_total': 'minutes_played_total',
        'Passes_total': 'passes_total', 'Rating_average': 'rating_average', 'Rating_highest': 'rating_highest',
        'Rating_lowest': 'rating_lowest', 'Shots_Blocked_total': 'shots_blocked_total', 'Shots_Off_Target_total': 'shots_off_target_total',
        'Shots_On_Target_total': 'shots_on_target_total', 'Shots_Total_total': 'shots_total_total', 'Substitutions_in': 'substitutions_in',
        'Substitutions_out': 'substitutions_out', 'Successful_Dribbles_total': 'successful_dribbles_total', 'Tackles_total': 'tackles_total',
        'Team_Draws_total': 'team_draws_total', 'Team_Lost_total': 'team_lost_total', 'Team_Wins_total': 'team_wins_total',
        'Through_Balls_total': 'through_balls_total', 'Total_Crosses_total': 'total_crosses_total', 'Total_Duels_total': 'total_duels_total',
        'Yellowcards_away': 'yellowcards_away', 'Yellowcards_home': 'yellowcards_home', 'Yellowcards_total': 'yellowcards_total',
        'Blocked_Shots_total': 'blocked_shots_total', 'Own_Goals_total': 'own_goals_total', 'Penalties_committed': 'penalties_committed',
        'Penalties_missed': 'penalties_missed', 'Penalties_saved': 'penalties_saved', 'Penalties_scored': 'penalties_scored',
        'Penalties_total': 'penalties_total', 'Penalties_won': 'penalties_won', 'Redcards_away': 'redcards_away',
        'Redcards_home': 'redcards_home', 'Redcards_total': 'redcards_total', 'Captain_total': 'captain_total',
        'Hit_Woodwork_total': 'hit_woodwork_total', 'Offsides_total': 'offsides_total', 'Through_Balls_Won_total': 'through_balls_won_total',
        'Yellowred_Cards_away': 'yellowred_cards_away', 'Yellowred_Cards_home': 'yellowred_cards_home', 'Yellowred_Cards_total': 'yellowred_cards_total',
        'Error_Lead_To_Goal_total': 'error_lead_to_goal_total', 'Saves_Insidebox_total': 'saves_insidebox_total', 'Saves_total': 'saves_total',
        'Hattricks_average': 'hattricks_average', 'Hattricks_total': 'hattricks_total', 'years_old': 'years_old', 'goals_per_90': 'goals_per_90',
        'assists_per_90': 'assists_per_90', 'big_chances_created_per_90': 'big_chances_created_per_90', 'conversion_rate': 'conversion_rate',
        'key_passes_per_90': 'key_passes_per_90', 'crosses_per_90': 'crosses_per_90', 'accurate_crosses_per_90': 'accurate_crosses_per_90',
        'cross_accuracy': 'cross_accuracy', 'dribble_success_rate': 'dribble_success_rate', 'aerial_duels_win_rate': 'aerial_duels_win_rate',
        'aerials_won_per_90': 'aerials_won_per_90', 'duels_won_rate': 'duels_won_rate', 'blocked_shots_per_90': 'blocked_shots_per_90',
        'clearances_per_90': 'clearances_per_90', 'def_actions': 'def_actions', 'def_actions_per_90': 'def_actions_per_90',
        'tackle_success_rate': 'tackle_success_rate', 'clean_sheet_rate': 'clean_sheet_rate', 'goals_conceded_per_90': 'goals_conceded_per_90',
        'cards_total': 'cards_total', 'cards_per_90': 'cards_per_90', 'fouls_drawn_per_90': 'fouls_drawn_per_90', 'starting_rate': 'starting_rate',
        'minutes_share': 'minutes_share', 'bench_rate': 'bench_rate', 'injury_risk': 'injury_risk', 'injury_risk_band': 'injury_risk_band',
        'penalty_success_rate': 'penalty_success_rate', 'saves_per_90': 'saves_per_90', 'save_success_rate': 'save_success_rate',
        'pen_save_rate': 'pen_save_rate', 'def_actions_per_90_rank': 'def_actions_per_90_rank', 'rating_std': 'rating_std',
        'volatility_index': 'volatility_index', 'pen_save_rate_z': 'pen_save_rate_z', 'key_passes_per_90_z': 'key_passes_per_90_z',
        'goals_conceded_per_90_z': 'goals_conceded_per_90_z', 'Rating_average_z': 'rating_average_z', 'starting_rate_z': 'starting_rate_z',
        'def_actions_per_90_z': 'def_actions_per_90_z', 'minutes_share_z': 'minutes_share_z', 'assists_per_90_z': 'assists_per_90_z',
        'big_chances_created_per_90_z': 'big_chances_created_per_90_z', 'clean_sheet_rate_z': 'clean_sheet_rate_z',
        'saves_per_90_z': 'saves_per_90_z', 'aerial_duels_win_rate_z': 'aerial_duels_win_rate_z', 'goals_per_90_z': 'goals_per_90_z',
        'dribble_success_rate_z': 'dribble_success_rate_z', 'conversion_rate_z': 'conversion_rate_z', 'injury_risk_z': 'injury_risk_z',
        'tackle_success_rate_z': 'tackle_success_rate_z', 'crosses_per_90_z': 'crosses_per_90_z', 'cards_per_90_z': 'cards_per_90_z',
        'save_success_rate_z': 'save_success_rate_z', 'ATT_perf': 'att_perf', 'CEN_perf': 'cen_perf', 'DIF_perf': 'dif_perf',
        'POR_perf': 'por_perf', 'role_perf': 'role_perf', 'stars': 'stars', 'skills': 'skills', 'QuotaTarget': 'quotatarget',
        'predicted_price': 'predicted_price', 
        'yellowcards_per_90': 'yellowcards_per_90',
        'redcards_per_90': 'redcards_per_90',
        'own_goals_per_90': 'own_goals_per_90',
        'penalties_saved_per_90': 'penalties_saved_per_90',
        'gol_bonus': 'gol_bonus',
        'assist_bonus': 'assist_bonus',
        'clean_sheet_bonus': 'clean_sheet_bonus',
        'titolarita': 'titolarita',
        'malus_risk_raw': 'malus_risk_raw',
        'pen_save_bonus': 'pen_save_bonus',
        'xfp_90': 'xfp_90',
        'xfp_per_game': 'xfp_per_game',
        'xfp_season': 'xfp_season',
        'price_expected': 'price_expected',
        'risk_coeff': 'risk_coeff',
        'hype_coeff': 'hype_coeff',
        'range_low': 'range_low',
        'range_high': 'range_high',
        
    }
    if db_type == 'firestore':
        from google.cloud import firestore
        firestore_db = os.environ.get('FIRESTORE_DB_NAME', 'fantacopilot-db')
        db = firestore.Client(project="fantacalcio-project", database=firestore_db)
        print(f"Using Firestore database: {firestore_db}")
        # DELETE ALL DOCS IN 'giocatori' COLLECTION FIRST
        giocatori_ref = db.collection('giocatori')
        docs = giocatori_ref.stream()
        delete_count = 0
        for doc in tqdm(docs):
            doc.reference.delete()
            delete_count += 1
        print(f"Deleted {delete_count} existing docs from 'giocatori' collection.")
        # Now insert new docs in batches of 500
        BATCH_SIZE = 500
        total = len(records)
        for batch_start in range(0, total, BATCH_SIZE):
            batch = db.batch()
            batch_end = min(batch_start + BATCH_SIZE, total)
            for idx in range(batch_start, batch_end):
                rec = records[idx]
                firestore_doc = {}
                for k, v in rec.items():
                    canonical_key = key_map.get(k, k)
                    if canonical_key in columns:
                        firestore_doc[canonical_key] = v
                # Ensure id is present and unique (use idx if not present)
                firestore_doc["id"] = firestore_doc.get("id", idx)
                # Ensure skills is always a list
                skills_val = firestore_doc.get("skills")
                if isinstance(skills_val, str):
                    try:
                        import ast
                        skills_list = ast.literal_eval(skills_val)
                        if not isinstance(skills_list, list):
                            raise Exception()
                    except Exception:
                        if ',' in skills_val:
                            skills_list = [s.strip() for s in skills_val.split(',') if s.strip()]
                        else:
                            skills_list = [skills_val.strip()]
                elif isinstance(skills_val, list):
                    skills_list = skills_val
                else:
                    skills_list = []
                firestore_doc["skills"] = skills_list
                # Always include all columns, fill missing with None
                for col in columns:
                    firestore_doc.setdefault(col, None)
                doc_id = str(idx)
                doc_ref = db.collection('giocatori').document(doc_id)
                batch.set(doc_ref, firestore_doc, merge=True)
            batch.commit()
            print(f"Inserted docs {batch_start} to {batch_end-1} into 'giocatori' collection.")
        print(f"Inserted {len(records)} new docs into 'giocatori' collection.")
        return
    # Default: SQLite
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()
    placeholder = "?"
    sql = f'''INSERT INTO giocatori (\n    {', '.join(columns)}\n) VALUES ({', '.join([placeholder]*len(columns))})'''
    for idx, rec in enumerate(records):
        canonical_rec = {col: None for col in columns}
        for k, v in rec.items():
            canonical_key = key_map.get(k, k)
            if canonical_key in columns:
                canonical_rec[canonical_key] = v
        # Ensure id is present and unique (use idx if not present)
        canonical_rec["id"] = canonical_rec.get("id", idx)
        # Ensure skills is always a list or None
        if 'skills' in canonical_rec and isinstance(canonical_rec['skills'], str):
            import ast
            try:
                val = ast.literal_eval(canonical_rec['skills'])
                if isinstance(val, list):
                    canonical_rec['skills'] = val
                else:
                    canonical_rec['skills'] = [canonical_rec['skills']]
            except Exception:
                if ',' in canonical_rec['skills']:
                    canonical_rec['skills'] = [s.strip() for s in canonical_rec['skills'].split(',') if s.strip()]
                else:
                    canonical_rec['skills'] = [canonical_rec['skills'].strip()]
        sql_row = [canonical_rec[col] for col in columns]
        cursor.execute(sql, sql_row)
    conn.commit()
    cursor.close()
    return
