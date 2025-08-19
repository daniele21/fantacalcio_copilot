import json
import os
from flask import Blueprint, request, make_response, g
from google.cloud import firestore
from .util import get_db, require_auth, jsonify_success, jsonify_error

strategy_api = Blueprint('strategy_api', __name__)

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
                "SELECT id, max_bid FROM strategy_board_targets WHERE google_sub = ?",
                (google_sub,)
            ).fetchall()
            target_players = [dict(row) for row in rows]
            return jsonify_success({'strategy_board': {'target_players': target_players}})

    if request.method == 'POST':
        data = request.get_json() or {}
        target_players = data.get('target_players', [])
        if db_type == 'firestore':
            # Delete all previous targets for this user before inserting new ones
            targets_ref = db.collection('strategy_board_targets').where('google_sub', '==', google_sub)
            docs = list(targets_ref.stream())
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            for player in target_players:
                doc_id = f"{google_sub}_{player.get('id')}"
                doc_ref = db.collection('strategy_board_targets').document(doc_id)
                batch.set(doc_ref, {
                    'google_sub': google_sub,
                    'id': player.get('id'),
                    'max_bid': player.get('maxBid', 0)
                }, merge=True)
            batch.commit()
            return jsonify_success({'message': 'Saved'})
        else:
            # Delete all previous targets for this user before inserting new ones
            db.execute("DELETE FROM strategy_board_targets WHERE google_sub = ?", (google_sub,))
            for player in target_players:
                db.execute(
                    """
                    INSERT INTO strategy_board_targets (google_sub, id, max_bid)
                    VALUES (?, ?, ?)
                    ON CONFLICT(google_sub, id) DO UPDATE SET
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
                    'role_budget_gk': 8,
                    'role_budget_def': 12,
                    'role_budget_mid': 30,
                    'role_budget_fwd': 50
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
                    'role_budget_gk': 8,
                    'role_budget_def': 12,
                    'role_budget_mid': 30,
                    'role_budget_fwd': 50
                }
            return jsonify_success({'strategy_board': {'role_budget': role_budget}})

    if request.method == 'POST':
        data = request.get_json() or {}
        gk = data.get('role_budget_gk', 8)
        d = data.get('role_budget_def', 12)
        m = data.get('role_budget_mid', 30)
        f = data.get('role_budget_fwd', 50)
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

@strategy_api.route('/strategy', methods=['DELETE'])
@require_auth
def delete_strategy():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    google_sub = g.user_id
    # Delete all strategy board targets and budget for this user
    if db_type == 'firestore':
        # Delete all strategy_board_targets for this user
        targets_ref = db.collection('strategy_board_targets').where('google_sub', '==', google_sub)
        docs = list(targets_ref.stream())
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        # Delete strategy_board budget doc
        budget_ref = db.collection('strategy_board').document(google_sub)
        batch.delete(budget_ref)
        batch.commit()
    else:
        db.execute("DELETE FROM strategy_board_targets WHERE google_sub = ?", (google_sub,))
        db.execute("DELETE FROM strategy_board WHERE google_sub = ?", (google_sub,))
        db.commit()
    return jsonify_success({'status': 'deleted'})
