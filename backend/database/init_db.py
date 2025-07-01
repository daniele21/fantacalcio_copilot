import os

def init_db():
    """
    Initialize the database by executing the correct SQL script based on db type.
    Creates the database if it does not exist (for MySQL), then creates tables if not present.
    Uses local MySQL, Cloud SQL, or SQLite depending on env vars.
    """
    db_type = os.environ.get('DB_TYPE', 'mysql')  # 'mysql' or 'sqlite'
    db_name = os.environ.get('CLOUDSQL_DATABASE', 'fantacalcio')
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
