import os

def init_db():
    """
    Initialize the database or Firestore collections based on db type.
    For SQL: executes the correct SQL script.
    For Firestore: creates collections with a dummy doc (Firestore is schemaless).
    """
    db_type = os.environ.get('DB_TYPE', 'sqlite')  # 'mysql', 'sqlite', or 'firestore'
    db_name = os.environ.get('CLOUDSQL_DATABASE', 'fantacalcio')
    if db_type == 'firestore':
        from google.cloud import firestore
        db = firestore.Client(project="fantacalcio-project", database='fantacalcio-db')
        # Optionally create collections with a dummy doc (Firestore is schemaless)
        collections = [
            'giocatori', 'users', 'league_settings', 'strategy_board', 'strategy_board_targets'
        ]
        for col in collections:
            doc_ref = db.collection(col).document('init')
            doc_ref.set({'init': True}, merge=True)
        print("Firestore collections initialized (dummy docs created).")
        return
    # Choose the right SQL file
    if db_type == 'sqlite':
        sql_path = os.path.join(os.path.dirname(__file__), 'init.sqlite.sql')
    else:
        sql_path = os.path.join(os.path.dirname(__file__), 'init.mysql.sql')
    with open(sql_path, 'r') as f:
        sql = f.read()

    if db_type == 'sqlite':
        import sqlite3
        db_path = os.environ.get('SQLITE_PATH', os.path.join(os.path.dirname(__file__), 'fantacalcio.db'))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        for statement in sql.split(';'):
            stmt = statement.strip()
            if stmt:
                try:
                    cursor.execute(stmt)
                except Exception as e:
                    print(f"SQLite error: {e}\nStatement: {stmt}")
        conn.commit()
        cursor.close()
        conn.close()
    else:
        import mysql.connector
        db_config = {
            'host': os.environ.get('CLOUDSQL_HOST', 'localhost'),
            'user': os.environ.get('CLOUDSQL_USER', 'root'),
            'password': os.environ.get('CLOUDSQL_PASSWORD', ''),
        }
        # Step 1: create database if not exists
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        try:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        except Exception as e:
            print(f"MySQL error (create db): {e}")
        cursor.close()
        conn.close()
        # Step 2: connect to the database and create tables
        db_config['database'] = db_name
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        for statement in sql.split(';'):
            stmt = statement.strip()
            if stmt:
                try:
                    cursor.execute(stmt)
                except Exception as e:
                    print(f"MySQL error: {e}\nStatement: {stmt}")
        conn.commit()
        cursor.close()
        conn.close()
