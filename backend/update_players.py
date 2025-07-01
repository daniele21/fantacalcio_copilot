# extract player data to update the database
import os

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

def merge_and_update_players() -> None:
    from backend.database.insert_giocatori import insert_giocatori_from_records

    fantagazzetta_player_data = get_last_quote_file()
    fantacalciopedia_player_data = get_player_data('players_attributes.csv')
    
    # merge the two datasets where the condition is: nome (fantacalciopedia_player_data) contains Nome (fantagazzetta_player_data)
    merged_data = []
    for fg_player in fantagazzetta_player_data:
        for fc_player in fantacalciopedia_player_data:
            if fg_player['Cognome'].lower() in fc_player['Nome'].lower():
                # Merge the data, prioritizing fantagazzetta data
                merged_player = {**fc_player, **fg_player}
                merged_data.append(merged_player)
                break

    # Always open a new DB connection in this thread for SQLite
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