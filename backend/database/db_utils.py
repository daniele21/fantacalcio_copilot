import os
import mysql.connector
from mysql.connector import Error

def get_connection():
    return mysql.connector.connect(
        host=os.environ.get('CLOUDSQL_HOST', 'localhost'),
        user=os.environ.get('CLOUDSQL_USER', 'root'),
        password=os.environ.get('CLOUDSQL_PASSWORD', ''),
        database=os.environ.get('CLOUDSQL_DATABASE', 'fantacalcio')
    )

def insert_giocatore(data):
    conn = get_connection()
    cursor = conn.cursor()
    sql = '''
        INSERT INTO giocatori (
            nome, punteggio, fantamedia_2024_2025, fantamedia_2023_2024, fantamedia_2022_2023,
            presenze_2024_2025, fanta_media_2024_2025, fm_su_tot_gare_2024_2025, presenze_previste,
            gol_previsti, assist_previsti, ruolo, skills, buon_investimento, resistenza_infortuni,
            consigliato, infortunato, nuovo_acquisto, squadra, trend, presenze, appetibilita
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    '''
    cursor.execute(sql, data)
    conn.commit()
    cursor.close()
    conn.close()

def get_all_giocatori():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM giocatori')
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows
