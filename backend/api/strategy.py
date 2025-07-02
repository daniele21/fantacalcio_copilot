import json
from flask import Blueprint, request, make_response, g
from backend.api.utils import get_db, require_auth, jsonify_success, jsonify_error

strategy_api = Blueprint('strategy_api', __name__)

# OPTIONS handled by global CORS, no need for per-route

# @strategy_api.route('/strategy-board', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
# @require_auth
# def strategy():
#     db = get_db()
#     user_id = g.user_id

#     if request.method == 'GET':
#         row = db.execute(
#             'SELECT strategy_data FROM user_strategies WHERE user_id = ?',
#             (user_id,)
#         ).fetchone()
#         if not row:
#             return jsonify_error('not_found', 'No strategy found', 404)
#         return jsonify_success(json.loads(row['strategy_data']))

#     if request.method == 'POST':
#         data = request.get_json() or {}
#         if 'roleBudget' not in data or 'targetPlayerIds' not in data:
#             return jsonify_error('malformed', 'Malformed strategy data')
#         serial = json.dumps(data)
#         try:
#             db.execute(
#                 '''
#                 INSERT INTO user_strategies (user_id, strategy_data)
#                 VALUES (?, ?)
#                 ON CONFLICT(user_id) DO UPDATE SET
#                   strategy_data = excluded.strategy_data,
#                   updated_at = CURRENT_TIMESTAMP
#                 ''',
#                 (user_id, serial)
#             )
#             db.commit()
#             return jsonify_success({'message': 'Strategy saved successfully'})
#         except Exception:
#             return jsonify_error('db_error', 'Could not save strategy', 500)

#     if request.method == 'DELETE':
#         db.execute('DELETE FROM user_strategies WHERE user_id = ?', (user_id,))
#         db.commit()
#         return '', 204

#     # OPTIONS fallback
#     response = make_response('', 204)
#     return response

@strategy_api.route('/strategy-board', methods=['GET', 'POST'])
@require_auth
def strategy_board():
    db = get_db()
    google_sub = g.user_id

    if request.method == 'GET':
        rows = db.execute(
            "SELECT player_id, max_bid FROM strategy_board_targets WHERE google_sub = ?",
            (google_sub,)
        ).fetchall()
        target_players = [dict(row) for row in rows]
        return jsonify_success({'strategy_board': {'target_players': target_players}})

    if request.method == 'POST':
        data = request.get_json() or {}
        target_players = data.get('target_players', [])
        # Remove all current targets for this user
        db.execute("DELETE FROM strategy_board_targets WHERE google_sub = ?", (google_sub,))
        # Insert new targets
        for player in target_players:
            db.execute(
                "INSERT INTO strategy_board_targets (google_sub, player_id, max_bid) VALUES (?, ?, ?)",
                (google_sub, player.get('id'), player.get('max_bid', 0))
            )
        db.commit()
        return jsonify_success({'message': 'Saved'})

@strategy_api.route('/strategy-board-budget', methods=['GET', 'POST'])
@require_auth
def strategy_board_budget():
    db = get_db()
    google_sub = g.user_id

    if request.method == 'GET':
        row = db.execute(
            "SELECT role_budget_gk, role_budget_def, role_budget_mid, role_budget_fwd FROM strategy_board WHERE google_sub = ?",
            (google_sub,)
        ).fetchone()
        if row:
            role_budget = dict(row)
        else:
            # Default to zeros if not set
            role_budget = {
                'role_budget_gk': 10,
                'role_budget_def': 20,
                'role_budget_mid': 35,
                'role_budget_fwd': 35
            }
        return jsonify_success({'strategy_board': {'role_budget': role_budget}})

    if request.method == 'POST':
        data = request.get_json() or {}
        role_budget = data.get('role_budget', {})
        gk = role_budget['role_budget_gk']
        d = role_budget['role_budget_def']
        m = role_budget['role_budget_mid']
        f = role_budget['role_budget_fwd']
        # Upsert logic
        db.execute(
            """
            INSERT INTO strategy_board (google_sub, role_budget_gk, role_budget_def, role_budget_mid, role_budget_fwd)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(google_sub) DO UPDATE SET
                role_budget_gk=excluded.role_budget_gk,
                role_budget_def=excluded.role_budget_def,
                role_budget_mid=excluded.role_budget_mid,
                role_budget_fwd=excluded.role_budget_fwd
            """,
            (google_sub, gk, d, m, f)
        )
        db.commit()
        return jsonify_success({'message': 'Saved'})
