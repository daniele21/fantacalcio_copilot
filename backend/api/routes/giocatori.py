
import os
import sqlite3
from flask import Blueprint, request, jsonify, g
from tqdm import tqdm
from ..util import get_db, jsonify_success, require_auth
from backend.api.utils.cache import cache_api_lru
import random

routes_giocatori = Blueprint('routes_giocatori', __name__)

@cache_api_lru(maxsize=1024, ttl=60)  # Cache for 1 hour (60 minutes)
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

@routes_giocatori.route('/api/save_team', methods=['POST'])
@require_auth
def store_user_team():
    """
    API endpoint to override the user's team in Firestore with team_players (list of dicts with player_name, team, role).
    Expects JSON: { "google_sub": ..., "team_players": [ {"player_name": ..., "team": ..., "role": ...}, ... ] }
    """
    data = request.get_json(force=True)
    google_sub = data.get('google_sub') or g.user_id
    team_players = data.get('team_players', [])
    if not google_sub or not isinstance(team_players, list):
        return jsonify({"success": False, "error": "Missing google_sub or team_players"}), 400
    db = get_db()
    user_ref = db.collection('users').document(google_sub)
    user_ref.set({'team': team_players}, merge=True)
    return jsonify_success({"success": True})

@routes_giocatori.route('/api/get_team', methods=['GET'])
@require_auth
def get_user_team():
    """
    API endpoint to read the user's team from Firestore.
    Accepts optional query param 'google_sub', otherwise uses g.user_id.
    Returns: { "team": [...] }
    """
    google_sub = request.args.get('google_sub') or g.user_id
    return get_user_team_cached(google_sub)

@cache_api_lru(maxsize=1024, ttl=60)
def get_user_team_cached(google_sub):
    """
    Cached function to read the user's team from Firestore.
    Only takes google_sub as parameter to ensure stable cache keys.
    """
    db = get_db()  # Get db inside the function to avoid cache key issues
    user_ref = db.collection('users').document(google_sub)
    user_doc = user_ref.get()
    team = []
    if user_doc.exists:
        user_data = user_doc.to_dict()
        team = user_data.get('team', [])

    # Enrich each team player with stats from 'players_current_statistics' and build dict keyed by player_name
    stats_collection = db.collection('players_current_statistics')
    team_dict = {}
    for player in team:
        player_name = player.get('player_name')
        player_id = player.get('player_id')  # Get player_id if available
        stats_doc = stats_collection.document(player_name).get()
        stats = stats_doc.to_dict() if stats_doc.exists else {}
        team_dict[player_name] = {
            'player_id': player_id,  # Include player_id for AI optimization
            'role': player.get('role'),
            'team': player.get('team'),
            'stats': stats
        }

    return jsonify_success(team_dict)
