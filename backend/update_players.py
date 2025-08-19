# extract player data to update the database
import os
from rapidfuzz import fuzz
from unidecode import unidecode
import pandas as pd
from backend.data.extract import run_all
from backend.database.insert_giocatori import insert_giocatori_from_csv_records, insert_giocatori_from_records

# read last quote file and update giocatori table then
# def get_last_quote_file() -> str:
#     data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
#     quote_files = [f for f in os.listdir(data_dir) if f.startswith('quote') and f.endswith('.csv')]
#     if not quote_files:
#         print("Nessun file quote trovato.")
#         return
#     latest_file = sorted(quote_files)[-1]
#     quote_path = os.path.join(data_dir, latest_file)
#     df_quote = pd.read_csv(quote_path, sep=';')
#     df_quote.rename(columns={'Squadra': 'squadra_quote',
#                              'Nome': 'Cognome',
#                              'R': 'ruolo_quote',
#                              'RM': 'ruolo_m'}, inplace=True)
#     # Normalize 'FVM' to a 1-5 scale
#     if 'FVM' in df_quote.columns:
#         fvm_min = df_quote['FVM'].min()
#         fvm_max = df_quote['FVM'].max()
#         if fvm_max > fvm_min:
#             df_quote['fvm_recommendation'] = ((df_quote['FVM'] - fvm_min) / (fvm_max - fvm_min) * 4 + 1).round().astype(int)
#         else:
#             df_quote['fvm_recommendation'] = 0  # fallback if all values are the same
#     else:
#         df_quote['fvm_recommendation'] = 0  # fallback if column missing
        
#     df_quote['suggested_bid_min'] = df_quote['FVM'].apply(lambda x: max(int(x * 0.8), 1))
#     df_quote['suggested_bid_max'] = df_quote['FVM'].apply(lambda x: int(x * 1.2))

#     return df_quote.to_dict(orient='records')

# def get_player_data(filepath: str) -> list:
#     import pandas as pd
#     import ast

#     # Read the CSV file into a DataFrame
#     df = pd.read_csv(filepath, sep=',')
    
#     # Normalize 'Appetibilita' to a 1-5 scale for 'recommendation'
#     if 'Appetibilita' in df.columns:
#         appet_min = df['Appetibilita'].min()
#         appet_max = df['Appetibilita'].max()
#         if appet_max > appet_min:
#             df['recommendation'] = ((df['Appetibilita'] - appet_min) / (appet_max - appet_min) * 4 + 1).round().astype(int)
#         else:
#             df['recommendation'] = 0  # fallback if all values are the same
#     else:
#         df['recommendation'] = 0  # fallback if column missing

#     def parse_skills(x):
#         if isinstance(x, str) and x.startswith('['):
#             try:
#                 return [s.strip().strip("'") for s in ast.literal_eval(x)]
#             except Exception:
#                 return [x]
#         elif isinstance(x, str):
#             return [x]
#         elif isinstance(x, list):
#             return x
#         return []
#     df['Skills'] = df['Skills'].apply(parse_skills)
#     return df.to_dict(orient='records')

def player_processing_data_from_csv(filepath: str = '/Users/moltisantid/Personal/fantacalcio/player_statistics_2025-07-21_15-02-25_with_target_price_and_predictions.csv') -> None:
    df = pd.read_csv(filepath, sep=',')
    # Clean NaN/inf values for JSON serialization
    df = df.replace([float('nan'), float('inf'), float('-inf')], None)
    # Also, replace pandas NaN with None
    df = df.where(pd.notnull(df), None)
    insert_giocatori_from_csv_records(df.to_dict(orient='records'))
    return
    


# def merge_and_update_players(threshold: int = 85) -> None:
#     from backend.database.insert_giocatori import insert_giocatori_from_records

#     fantagazzetta_player_data = get_last_quote_file()
#     fantacalciopedia_player_data = get_player_data('players_attributes.csv')
    
#     def normalize(text: str) -> str:
#         return unidecode(text or "").strip().lower()

#     merged_data = []
#     for fg in fantagazzetta_player_data:
#         fg_cognome = normalize(fg.get('Cognome', ''))
#         if not fg_cognome:
#             continue

#         best_match = None
#         best_score = 0
#         for fc in fantacalciopedia_player_data:
#             fc_nome = normalize(fc.get('Nome', ''))
#             score = fuzz.partial_ratio(fg_cognome, fc_nome)
#             if score > best_score:
#                 best_score = score
#                 best_match = fc

#         # Accept the best fuzzy match if above threshold
#         if best_match and best_score >= threshold:
#             merged_player = {**best_match, **fg}
#             merged_data.append(merged_player)
#         else:
#             # Optional: log or collect unmatched entries for review
#             # print(f"No good match for {fg.get('Cognome')} (best: {best_score})")
#             pass

#     # Convert Skills list to string for DB compatibility
#     for player in merged_data:
#         if isinstance(player.get('Skills'), list):
#             player['Skills'] = ', '.join(player['Skills'])

#     # Always open a new DB connection in this thread for SQLite
#     import sqlite3
#     db_path = os.environ.get('SQLITE_PATH') or os.path.join(os.path.dirname(__file__), 'database', 'fantacalcio.db')
#     conn = sqlite3.connect(db_path)
#     try:
#         insert_giocatori_from_records(merged_data, conn=conn)
#         conn.commit()
#     finally:
#         conn.close()

# async def update_players() -> None:
#     player_data = await run_all()
#     # read csv player data
#     # import pandas as pd
#     # player_data = pd.read_csv("players_attributes.csv").to_dict(orient="records")
#     insert_giocatori_from_records(player_data)


if __name__ == "__main__":
    import asyncio
    from backend.database.init_db import init_db

    # Initialize the database connection
    init_db()

    # Run the update_players function
    # asyncio.run(update_players())
    # print("Player data updated successfully.")

    # merge_and_update_players()
    # Automatically select the latest player_statistics_*_with_features.csv file
    import glob
    import os
    base_dir = '/Users/moltisantid/Personal/fantacalcio'
    stat_files = glob.glob(os.path.join(base_dir, 'player_statistics_*_with_features.csv'))
    stat_files = [f for f in stat_files if '_with_target_price' not in f and '_with_target_price_and_predictions' not in f]
    if not stat_files:
        raise FileNotFoundError('No player_statistics_*_with_features.csv files found!')
    latest_file = max(stat_files, key=os.path.getmtime)
    print(f"Using latest features file: {latest_file}")
    player_processing_data_from_csv(latest_file)