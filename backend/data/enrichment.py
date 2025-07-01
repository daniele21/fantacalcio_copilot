import os
import sqlite3
import pandas as pd

def enrich_giocatori_with_cognome():
    # Trova l'ultimo file quote nella cartella data
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'data')
    quote_files = [f for f in os.listdir(data_dir) if f.startswith('quote') and f.endswith('.csv')]
    if not quote_files:
        print("Nessun file quote trovato.")
        return
    latest_file = sorted(quote_files)[-1]
    quote_path = os.path.join(data_dir, latest_file)
    df_quote = pd.read_csv(quote_path, sep=';')

    # Connessione al db
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'fantacalcio.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Per ogni giocatore nel db, aggiorna la colonna cognome, quotaattuale e ruolo se matcha su nome
    cursor.execute("SELECT id, nome FROM giocatori")
    rows = cursor.fetchall()
    for player_id, nome_db in rows:
        match = df_quote[df_quote['Nome'] == nome_db]
        if not match.empty:
            cognome = match.iloc[0]['Nome']
            quotaattuale = match.iloc[0]['QuotaAtuale'] if 'QuotaAtuale' in match.columns else None
            ruolo = match.iloc[0]['R'] if 'R' in match.columns else None
            cursor.execute("UPDATE giocatori SET cognome = ?, quotaattuale = ?, ruolo_quote = ? WHERE id = ?", (cognome, quotaattuale, ruolo, player_id))
    conn.commit()
    cursor.close()
    conn.close()
    print("Colonne cognome, quotaattuale e ruolo_quote aggiornate nella tabella giocatori.")

if __name__ == "__main__":
    enrich_giocatori_with_cognome()
