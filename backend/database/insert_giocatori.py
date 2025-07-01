import os
import mysql.connector
from mysql.connector import Error
import ast

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
    Inserisce una lista di dict (estratti dallo scraping) nella tabella giocatori.
    Ogni dict deve avere le chiavi coerenti con le colonne della tabella.
    """
    close_conn = False
    if conn is None:
        conn = get_connection()
    else:
        close_conn = False  # Don't close if passed in
    cursor = conn.cursor()
    import os
    db_type = os.environ.get('DB_TYPE', 'mysql')
    if db_type == 'sqlite':
        placeholder = "?"
    else:
        placeholder = "%s"
    sql = f'''
        INSERT INTO giocatori (
            nome, cognome, punteggio, fantamedia_2024_2025, fantamedia_2023_2024, fantamedia_2022_2023,
            presenze_2024_2025, fanta_media_2024_2025, fm_su_tot_gare_2024_2025, presenze_previste,
            gol_previsti, assist_previsti, ruolo, ruolo_m, ruolo_quote, skills, buon_investimento, resistenza_infortuni,
            consigliato, infortunato, nuovo_acquisto, squadra, squadra_quote, quota_attuale, quota_iniziale, diff, quota_attuale_m, quota_iniziale_m, diff_m, fvm, fvm_m, trend, presenze, appetibilita, recommendation, last_modified
        ) VALUES ({', '.join([placeholder]*36)})
    '''
    for rec in records:
        # Parse Skills field correctly
        skills_raw = rec.get("Skills", "[]")
        if isinstance(skills_raw, str):
            try:
                skills_list = ast.literal_eval(skills_raw)
            except Exception:
                skills_list = []
        else:
            skills_list = skills_raw
        skills_str = ",".join(skills_list)
        data = (
            rec.get("Nome"),
            rec.get("Cognome"),
            rec.get("Punteggio"),
            rec.get("Fantamedia_2024-2025"),
            rec.get("Fantamedia_2023-2024"),
            rec.get("Fantamedia_2022-2023"),
            rec.get("Presenze 2024-2025"),
            rec.get("Fanta Media 2024-2025"),
            rec.get("FM su tot gare 2024-2025"),
            rec.get("Presenze previste"),
            rec.get("Gol previsti"),
            rec.get("Assist previsti"),
            rec.get("Ruolo"),
            rec.get("Ruolo_m"),
            rec.get("Ruolo_quote"),
            skills_str,
            rec.get("Buon_investimento"),
            rec.get("Resistenza_infortuni"),
            rec.get("Consigliato"),
            rec.get("Infortunato"),
            rec.get("Nuovo_acquisto"),
            rec.get("Squadra"),
            rec.get("squadra_quote"),
            rec.get("QuotaAttuale"),
            rec.get("QuotaIniziale"),
            rec.get("Diff"),
            rec.get("Qt.A M"),
            rec.get("Qt.I M"),
            rec.get("Diff.M"),
            rec.get("FVM"),
            rec.get("FVM M"),
            rec.get("Trend"),
            rec.get("Presenze"),
            rec.get("Appetibilita"),
            rec.get("recommendation"),
            None # last_modified, lasciato a default
        )
        cursor.execute(sql, data)
    conn.commit()
    cursor.close()
    if close_conn:
        conn.close()
