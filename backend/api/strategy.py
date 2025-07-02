import json
from flask import Blueprint, request, make_response, g
from backend.api.utils import get_db, require_auth, jsonify_success, jsonify_error

strategy_api = Blueprint('strategy_api', __name__)

# OPTIONS handled by global CORS, no need for per-route

@strategy_api.route('/strategy', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
@require_auth
def strategy():
    db = get_db()
    user_id = g.user_id

    if request.method == 'GET':
        row = db.execute(
            'SELECT strategy_data FROM user_strategies WHERE user_id = ?',
            (user_id,)
        ).fetchone()
        if not row:
            return jsonify_error('not_found', 'No strategy found', 404)
        return jsonify_success(json.loads(row['strategy_data']))

    if request.method == 'POST':
        data = request.get_json() or {}
        if 'roleBudget' not in data or 'targetPlayerIds' not in data:
            return jsonify_error('malformed', 'Malformed strategy data')
        serial = json.dumps(data)
        try:
            db.execute(
                '''
                INSERT INTO user_strategies (user_id, strategy_data)
                VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  strategy_data = excluded.strategy_data,
                  updated_at = CURRENT_TIMESTAMP
                ''',
                (user_id, serial)
            )
            db.commit()
            return jsonify_success({'message': 'Strategy saved successfully'})
        except Exception:
            return jsonify_error('db_error', 'Could not save strategy', 500)

    if request.method == 'DELETE':
        db.execute('DELETE FROM user_strategies WHERE user_id = ?', (user_id,))
        db.commit()
        return '', 204

    # OPTIONS fallback
    response = make_response('', 204)
    return response
