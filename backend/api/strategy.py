import json
import os
from flask import Blueprint, request, make_response, g
from google.cloud import firestore
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
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    google_sub = g.user_id

    if request.method == 'GET':
        if db_type == 'firestore':
            targets_ref = db.collection('strategy_board_targets').where('google_sub', '==', google_sub)
            docs = targets_ref.stream()
            target_players = [doc.to_dict() for doc in docs]
            return jsonify_success({'strategy_board': {'target_players': target_players}})
        else:
            rows = db.execute(
                "SELECT player_id, max_bid FROM strategy_board_targets WHERE google_sub = ?",
                (google_sub,)
            ).fetchall()
            target_players = [dict(row) for row in rows]
            return jsonify_success({'strategy_board': {'target_players': target_players}})

    if request.method == 'POST':
        data = request.get_json() or {}
        target_players = data.get('target_players', [])
        if db_type == 'firestore':
            batch = db.batch()
            for player in target_players:
                doc_id = f"{google_sub}_{player.get('id')}"
                doc_ref = db.collection('strategy_board_targets').document(doc_id)
                batch.set(doc_ref, {
                    'google_sub': google_sub,
                    'player_id': player.get('id'),
                    'max_bid': player.get('maxBid', 0)
                }, merge=True)
            batch.commit()
            return jsonify_success({'message': 'Saved'})
        else:
            for player in target_players:
                db.execute(
                    """
                    INSERT INTO strategy_board_targets (google_sub, player_id, max_bid)
                    VALUES (?, ?, ?)
                    ON CONFLICT(google_sub, player_id) DO UPDATE SET
                        max_bid=excluded.max_bid
                    """,
                    (google_sub, player.get('id'), player.get('maxBid', 0))
                )
            db.commit()
            return jsonify_success({'message': 'Saved'})

@strategy_api.route('/strategy-board-budget', methods=['GET', 'POST'])
@require_auth
def strategy_board_budget():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    google_sub = g.user_id

    if request.method == 'GET':
        if db_type == 'firestore':
            doc_ref = db.collection('strategy_board').document(google_sub)
            doc = doc_ref.get()
            if doc.exists:
                role_budget = doc.to_dict()
            else:
                role_budget = {
                    'role_budget_gk': 10,
                    'role_budget_def': 20,
                    'role_budget_mid': 35,
                    'role_budget_fwd': 35
                }
            return jsonify_success({'strategy_board': {'role_budget': role_budget}})
        else:
            row = db.execute(
                "SELECT role_budget_gk, role_budget_def, role_budget_mid, role_budget_fwd FROM strategy_board WHERE google_sub = ?",
                (google_sub,)
            ).fetchone()
            if row:
                role_budget = dict(row)
            else:
                role_budget = {
                    'role_budget_gk': 10,
                    'role_budget_def': 20,
                    'role_budget_mid': 35,
                    'role_budget_fwd': 35
                }
            return jsonify_success({'strategy_board': {'role_budget': role_budget}})

    if request.method == 'POST':
        data = request.get_json() or {}
        gk = data.get('role_budget_gk', 10)
        d = data.get('role_budget_def', 20)
        m = data.get('role_budget_mid', 35)
        f = data.get('role_budget_fwd', 35)
        if db_type == 'firestore':
            doc_ref = db.collection('strategy_board').document(google_sub)
            doc_ref.set({
                'role_budget_gk': gk,
                'role_budget_def': d,
                'role_budget_mid': m,
                'role_budget_fwd': f
            }, merge=True)
            return jsonify_success({'message': 'Saved'})
        else:
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
