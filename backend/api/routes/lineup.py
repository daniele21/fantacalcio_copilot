
from flask import Blueprint, request, jsonify
import os
from ..util import require_auth, jsonify_success, jsonify_error, get_db
from backend.api.utils.cache import cache_api_lru

try:
    from google.cloud import firestore
except ImportError:
    firestore = None

route_lineup_api = Blueprint('lineup_api', __name__)

@cache_api_lru(maxsize=128, ttl=60*24)  # Cache for 24 hours
def get_matchdays_cached(input_date, db_type):
    from ..util import get_db
    db = get_db()
    from datetime import datetime
    if db_type == 'firestore' and firestore is not None:
        calendar_ref = db.collection('serie_a_calendar')
        docs = list(calendar_ref.stream())
        matchday_data = None
        try:
            input_dt = datetime.strptime(input_date, "%Y-%m-%d")
        except Exception:
            return None, 'Formato data non valido, usa YYYY-MM-DD'
        min_dt = None
        for doc in docs:
            row = doc.to_dict()
            doc_date = row.get('date')
            if not doc_date:
                continue
            try:
                doc_dt = datetime.strptime(doc_date, "%Y-%m-%d")
            except Exception:
                continue
            if doc_dt >= input_dt:
                if min_dt is None or doc_dt < min_dt:
                    min_dt = doc_dt
                    matchday_data = row
        if matchday_data:
            return matchday_data, None
        else:
            return None, f'Nessuna giornata trovata con data >= {input_date}'
    else:
        return None, 'Solo Firestore è supportato per questa operazione'


@route_lineup_api.route('/get_matchdays', methods=['POST'])
@require_auth
def get_matchdays():
    """
    Get Serie A matches for a given matchday from Firestore (collection: serie_a_calendar, doc_id: matchday)
    Expects JSON: { "matchday": <int> }
    Returns: { "matches": [...] }
    """
    data = request.get_json() or {}
    input_date = data.get('date')
    if not isinstance(input_date, str):
        return jsonify_error('bad_request', 'date deve essere una stringa (YYYY-MM-DD)')
    db_type = os.getenv('DB_TYPE', 'sqlite')
    result, err = get_matchdays_cached(input_date, db_type)
    if err:
        if 'Formato data' in err:
            return jsonify_error('bad_request', err)
        elif 'Solo Firestore' in err:
            return jsonify_error('not_implemented', err)
        else:
            return jsonify_error('not_found', err)
    return jsonify_success(result)
