import os
from flask import Blueprint, request, g
from ..util import get_db, jsonify_success, jsonify_error, require_auth
from google.cloud import firestore

routes_credit = Blueprint('routes_credit', __name__)

@routes_credit.route('/api/use-ai-credit', methods=['POST'])
@require_auth
def use_ai_credit():
    sub = g.user_id
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    data = request.get_json() or {}
    cost = data.get('cost', 0)
    try:
        cost = float(cost)
    except Exception:
        cost = 0
    if db_type == 'firestore':
        user_ref = db.collection('users').document(sub)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return jsonify_error('no_credits', 'Crediti AI esauriti', 403)
        user_data = user_doc.to_dict()
        ai_credits = user_data.get('ai_credits', 0)
        api_cost = user_data.get('api_cost', 0)
        spent_credits = user_data.get('spent_credits', 0)
        if ai_credits < 1:
            return jsonify_error('no_credits', 'Crediti AI esauriti', 403)
        user_ref.update({
            'ai_credits': firestore.Increment(-1),
            'api_cost': firestore.Increment(cost),
            'spent_credits': firestore.Increment(1)
        })
        return jsonify_success({
            'ai_credits': ai_credits - 1,
            'api_cost': api_cost + cost,
            'spent_credits': spent_credits + 1,
            'call_cost': cost
        })
    else:
        try:
            cur = db.execute("SELECT ai_credits, api_cost, spent_credits FROM users WHERE google_sub = ?", (sub,))
            row = cur.fetchone()
            if not row or row['ai_credits'] < 1:
                return jsonify_error('no_credits', 'Crediti AI esauriti', 403)
            db.execute("UPDATE users SET ai_credits = ai_credits - 1, api_cost = api_cost + ?, spent_credits = spent_credits + 1 WHERE google_sub = ? AND ai_credits > 0", (cost, sub))
            db.commit()
            return jsonify_success({
                'ai_credits': row['ai_credits'] - 1,
                'api_cost': row['api_cost'] + cost,
                'spent_credits': row['spent_credits'] + 1,
                'call_cost': cost
            })
        except Exception:
            return jsonify_error('db_error', 'Errore nel decremento crediti o aggiornamento costi', 500)

@routes_credit.route('/api/check-credit', methods=['GET'])
@require_auth
def check_credit():
    sub = g.user_id
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    if db_type == 'firestore':
        user_ref = db.collection('users').document(sub)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return jsonify_success({'has_credit': False, 'ai_credits': 0})
        user_data = user_doc.to_dict()
        ai_credits = user_data.get('ai_credits', 0)
        return jsonify_success({'has_credit': ai_credits > 0, 'ai_credits': ai_credits})
    else:
        row = db.execute("SELECT ai_credits FROM users WHERE google_sub = ?", (sub,)).fetchone()
        if not row:
            return jsonify_success({'has_credit': False, 'ai_credits': 0})
        ai_credits = row['ai_credits']
        return jsonify_success({'has_credit': ai_credits > 0, 'ai_credits': ai_credits})

@routes_credit.route('/api/accept-tos', methods=['POST'])
@require_auth
def accept_tos():
    data = request.get_json() or {}
    version = data.get('version', '1.0')
    sub = g.user_id
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    if db_type == 'firestore':
        user_ref = db.collection('users').document(sub)
        user_doc = user_ref.get()
        if not user_doc.exists:
            user_ref.set({'tos_version': version, 'tos_accepted_at': firestore.SERVER_TIMESTAMP}, merge=True)
        else:
            user_ref.update({'tos_version': version, 'tos_accepted_at': firestore.SERVER_TIMESTAMP})
        return jsonify_success({'status': 'accepted', 'version': version})
    else:
        db.execute(
            '''
            INSERT INTO tos_acceptance (google_sub, version, accepted_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(google_sub) DO UPDATE SET version=excluded.version, accepted_at=CURRENT_TIMESTAMP
            ''',
            (sub, version)
        )
        db.commit()
        return jsonify_success({'status': 'accepted', 'version': version})
