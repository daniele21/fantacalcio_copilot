import os
from flask import Blueprint, request, jsonify, g
from ..util import get_db, jsonify_success, require_auth
from backend.api.utils.cache import cache_api_lru
from tqdm import tqdm
from datetime import datetime

routes_player_stats = Blueprint('routes_player_stats', __name__)



@cache_api_lru(maxsize=1024, ttl=60)  # Cache for 1 hour
def get_player_stats_cached(date: str):
    db = get_db()
    stats_ref = db.collection('players_current_statistics')
    docs = stats_ref.get()
    # Each doc id is player_name, and doc contains id_cols + beginner/intermediate/expert
    player_stats = [doc.to_dict() | {'player_name': doc.id} for doc in tqdm(docs)]
    return player_stats


@routes_player_stats.route('/player_stats', methods=['GET'])
@require_auth
def get_player_stats():
    # Use date from query param, or default to today
    date = request.args.get('date')
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')
    player_stats = get_player_stats_cached(date)
    return jsonify_success({'player_stats': player_stats})
