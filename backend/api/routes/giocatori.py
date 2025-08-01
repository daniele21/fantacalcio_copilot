import os
import sqlite3
from flask import Blueprint, request, jsonify, g
from tqdm import tqdm
from ..util import get_db, jsonify_success, require_auth
from backend.api.utils.cache import cache_api_lru
from backend.update_players import merge_and_update_players
import random

routes_giocatori = Blueprint('routes_giocatori', __name__)

@cache_api_lru(maxsize=1024, ttl=60*24)
def get_giocatori_cached(db_type, db_path):
    if db_type == 'firestore':
        db = get_db()
        giocatori_ref = db.collection('giocatori')
        docs = giocatori_ref.get()
        giocatori = [doc.to_dict() | {'id': doc.id} for doc in tqdm(docs) if doc.id != 'init']
        return giocatori
    else:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute('SELECT * FROM giocatori').fetchall()
        if not rows:
            rows = conn.execute('SELECT * FROM giocatori').fetchall()
        conn.close()
        return [dict(r) for r in rows]

@routes_giocatori.route('/api/giocatori', methods=['GET'])
@require_auth
def get_giocatori():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db_path = os.getenv('SQLITE_PATH', 'backend/database/fantacalcio.db')
    giocatori = get_giocatori_cached(db_type, db_path)
    plan = 'free'
    if db_type == 'firestore':
        db = get_db()
        user_ref = db.collection('users').document(g.user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            plan = user_data.get('plan', 'free')
    else:
        db = get_db()
        row = db.execute("SELECT plan FROM users WHERE google_sub = ?", (g.user_id,)).fetchone()
        if row:
            plan = row['plan']
    if plan == 'free' and len(giocatori) > 30:
        from collections import defaultdict
        groups = defaultdict(list)
        for p in giocatori:
            try:
                rec = int(round(float(p.get('stars', 1))))
            except Exception:
                rec = 1
            groups[rec].append(p)
        total = 30
        rec_levels = sorted(groups.keys(), reverse=True)
        group_sizes = {k: len(groups[k]) for k in rec_levels}
        total_players = sum(group_sizes.values())
        stratified = []
        remaining = total
        for i, k in enumerate(rec_levels):
            if i == len(rec_levels) - 1:
                n = remaining
            else:
                n = max(1, int(round(total * group_sizes[k] / total_players)))
                n = min(n, group_sizes[k])
            if n > 0:
                stratified.extend(random.sample(groups[k], n))
            remaining -= n
            if remaining <= 0:
                break
        if len(stratified) < total:
            leftovers = [p for k in rec_levels for p in groups[k] if p not in stratified]
            needed = total - len(stratified)
            if leftovers:
                stratified.extend(random.sample(leftovers, min(needed, len(leftovers))))
        random.shuffle(stratified)
        giocatori = stratified[:total]
    return jsonify_success({'giocatori': giocatori})
