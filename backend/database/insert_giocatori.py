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
    Inserisce una lista di dict (estratti dallo scraping) nella tabella giocatori o in Firestore.
    Ogni dict deve avere le chiavi coerenti con le colonne della tabella.
    """
    import os
    db_type = os.environ.get('DB_TYPE', 'sqlite')
    # Define the canonical column names for both SQL and Firestore
    columns = [
        "nome", "cognome", "punteggio", "fantamedia_2024_2025", "fantamedia_2023_2024", "fantamedia_2022_2023",
        "presenze_2024_2025", "fanta_media_2024_2025", "fm_su_tot_gare_2024_2025", "presenze_previste",
        "gol_previsti", "assist_previsti", "ruolo", "ruolo_m", "ruolo_quote", "skills", "buon_investimento", "resistenza_infortuni",
        "consigliato", "infortunato", "nuovo_acquisto", "squadra", "squadra_quote", "quota_attuale", "quota_iniziale", "diff", "quota_attuale_m", "quota_iniziale_m", "diff_m", "fvm", "fvm_m", "trend", "presenze", "appetibilita", "recommendation", "last_modified"
    ]
    if db_type == 'firestore':
        from google.cloud import firestore
        db = firestore.Client(project="fantacalcio-project", database='fantacalcio-db')
        batch = db.batch()
        for idx, rec in enumerate(records):
            # Map input record to canonical column names
            firestore_doc = {}
            key_map = {
                "Nome": "nome", "Cognome": "cognome", "Punteggio": "punteggio",
                "Fantamedia_2024-2025": "fantamedia_2024_2025", "Fantamedia_2023-2024": "fantamedia_2023_2024", "Fantamedia_2022-2023": "fantamedia_2022_2023",
                "Presenze 2024-2025": "presenze_2024_2025", "Fanta Media 2024-2025": "fanta_media_2024_2025", "FM su tot gare 2024-2025": "fm_su_tot_gare_2024_2025",
                "Presenze previste": "presenze_previste", "Gol previsti": "gol_previsti", "Assist previsti": "assist_previsti",
                "Ruolo": "ruolo", "Ruolo_m": "ruolo_m", "Ruolo_quote": "ruolo_quote", "Skills": "skills", "Buon_investimento": "buon_investimento",
                "Resistenza_infortuni": "resistenza_infortuni", "Consigliato": "consigliato", "Infortunato": "infortunato", "Nuovo_acquisto": "nuovo_acquisto",
                "Squadra": "squadra", "squadra_quote": "squadra_quote", "QuotaAttuale": "quota_attuale", "QuotaIniziale": "quota_iniziale", "Diff": "diff",
                "Qt.A M": "quota_attuale_m", "Qt.I M": "quota_iniziale_m", "Diff.M": "diff_m", "FVM": "fvm", "FVM M": "fvm_m", "Trend": "trend",
                "Presenze": "presenze", "Appetibilita": "appetibilita", "recommendation": "recommendation"
            }
            for k, v in rec.items():
                canonical_key = key_map.get(k, k.lower())
                if canonical_key in columns:
                    firestore_doc[canonical_key] = v
            # Ensure skills is always a list
            skills_val = rec.get("Skills") or rec.get("skills")
            if isinstance(skills_val, str):
                try:
                    import ast
                    skills_list = ast.literal_eval(skills_val)
                    if not isinstance(skills_list, list):
                        skills_list = [skills_val]
                except Exception:
                    skills_list = [skills_val]
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
            print(f"Uploading player: {doc_id}")
        batch.commit()
        print(f"Uploaded {len(records)} players to Firestore.")
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
        key_map = {
            "Nome": "nome", "Cognome": "cognome", "Punteggio": "punteggio",
            "Fantamedia_2024-2025": "fantamedia_2024_2025", "Fantamedia_2023-2024": "fantamedia_2023_2024", "Fantamedia_2022-2023": "fantamedia_2022_2023",
            "Presenze 2024-2025": "presenze_2024_2025", "Fanta Media 2024-2025": "fanta_media_2024_2025", "FM su tot gare 2024-2025": "fm_su_tot_gare_2024_2025",
            "Presenze previste": "presenze_previste", "Gol previsti": "gol_previsti", "Assist previsti": "assist_previsti",
            "Ruolo": "ruolo", "Ruolo_m": "ruolo_m", "Ruolo_quote": "ruolo_quote", "Skills": "skills", "Buon_investimento": "buon_investimento",
            "Resistenza_infortuni": "resistenza_infortuni", "Consigliato": "consigliato", "Infortunato": "infortunato", "Nuovo_acquisto": "nuovo_acquisto",
            "Squadra": "squadra", "squadra_quote": "squadra_quote", "QuotaAttuale": "quota_attuale", "QuotaIniziale": "quota_iniziale", "Diff": "diff",
            "Qt.A M": "quota_attuale_m", "Qt.I M": "quota_iniziale_m", "Diff.M": "diff_m", "FVM": "fvm", "FVM M": "fvm_m", "Trend": "trend",
            "Presenze": "presenze", "Appetibilita": "appetibilita", "recommendation": "recommendation"
        }
        canonical_rec = {col: None for col in columns}
        for k, v in rec.items():
            canonical_key = key_map.get(k, k.lower())
            if canonical_key in columns:
                canonical_rec[canonical_key] = v
        sql_row = [canonical_rec[col] for col in columns]
        cursor.execute(sql, sql_row)
    conn.commit()
    cursor.close()
    if close_conn:
        conn.close()
