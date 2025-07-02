# extract player data to update the database
import os
from rapidfuzz import fuzz
from unidecode import unidecode
import pandas as pd
from backend.data.extract import run_all
from backend.database.insert_giocatori import insert_giocatori_from_records

# read last quote file and update giocatori table then
def get_last_quote_file() -> str:
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    quote_files = [f for f in os.listdir(data_dir) if f.startswith('quote') and f.endswith('.csv')]
    if not quote_files:
        print("Nessun file quote trovato.")
        return
    latest_file = sorted(quote_files)[-1]
    quote_path = os.path.join(data_dir, latest_file)
    df_quote = pd.read_csv(quote_path, sep=';')
    df_quote.rename(columns={'Squadra': 'squadra_quote',
                             'Nome': 'Cognome',
                             'R': 'ruolo_quote',
                             'RM': 'ruolo_m'}, inplace=True)
    return df_quote.to_dict(orient='records')

def get_player_data(filepath: str) -> list:
    import pandas as pd

    # Read the CSV file into a DataFrame
    df = pd.read_csv(filepath, sep=',')
    
    # Normalize 'Appetibilita' to a 1-5 scale for 'recommendation'
    if 'Appetibilita' in df.columns:
        appet_min = df['Appetibilita'].min()
        appet_max = df['Appetibilita'].max()
        if appet_max > appet_min:
            df['recommendation'] = ((df['Appetibilita'] - appet_min) / (appet_max - appet_min) * 4 + 1).round().astype(int)
        else:
            df['recommendation'] = 0  # fallback if all values are the same
    else:
        df['recommendation'] = 0  # fallback if column missing

    df['Skills'] = df['Skills'].astype(str)
    return df.to_dict(orient='records')

def merge_and_update_players(threshold: int = 85) -> None:
    from backend.database.insert_giocatori import insert_giocatori_from_records
    import os
    db_type = os.environ.get('DB_TYPE', 'sqlite')
    fantagazzetta_player_data = get_last_quote_file()
    fantacalciopedia_player_data = get_player_data('players_attributes.csv')
    def normalize(text: str) -> str:
        from unidecode import unidecode
        return unidecode(text or "").strip().lower()
    merged_data = []
    for fg in fantagazzetta_player_data:
        fg_cognome = normalize(fg.get('Cognome', ''))
        if not fg_cognome:
            continue
        best_match = None
        best_score = 0
        for fc in fantacalciopedia_player_data:
            fc_nome = normalize(fc.get('Nome', ''))
            from rapidfuzz import fuzz
            score = fuzz.partial_ratio(fg_cognome, fc_nome)
            if score > best_score:
                best_score = score
                best_match = fc
        if best_match and best_score >= threshold:
            merged_player = {**best_match, **fg}
            merged_data.append(merged_player)
        else:
            pass
    if db_type == 'firestore':
        from backend.database.insert_giocatori import insert_giocatori_from_records
        insert_giocatori_from_records(merged_data)
    else:
        import sqlite3
        db_path = os.environ.get('SQLITE_PATH') or os.path.join(os.path.dirname(__file__), 'database', 'fantacalcio.db')
        conn = sqlite3.connect(db_path)
        try:
            insert_giocatori_from_records(merged_data, conn=conn)
            conn.commit()
        finally:
            conn.close()

async def update_players() -> None:
    player_data = await run_all()
    # read csv player data
    # import pandas as pd
    # player_data = pd.read_csv("players_attributes.csv").to_dict(orient="records")
    insert_giocatori_from_records(player_data)


if __name__ == "__main__":
    import asyncio
    from backend.database.init_db import init_db

    # Initialize the database connection
    init_db()

    # Run the update_players function
    # asyncio.run(update_players())
    # print("Player data updated successfully.")
    
    merge_and_update_players()