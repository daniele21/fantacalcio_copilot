import os
import sqlite3
import json
from flask import Blueprint, request, g
from ..util import get_db, jsonify_success, require_auth

routes_auction_log = Blueprint('routes_auction_log', __name__)

@routes_auction_log.route('/api/save-auction-log', methods=['POST'])
@require_auth
def save_auction_log():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    data = request.get_json() or {}
    auction_log = data.get('auctionLog', {})
    if db_type == 'firestore':
        doc_ref = db.collection('auction_logs').document(g.user_id)
        doc_ref.set({'auctionLog': auction_log}, merge=True)
        return jsonify_success()
    else:
        try:
            db.execute(
                '''
                INSERT INTO auction_log (google_sub, auction_log)
                VALUES (?, ?)
                ON CONFLICT(google_sub) DO UPDATE SET auction_log=excluded.auction_log
                ''',
                (g.user_id, json.dumps(auction_log))
            )
            db.commit()
            return jsonify_success()
        except Exception:
            return jsonify_success({'error': 'Could not save auction log'})

@routes_auction_log.route('/api/get-auction-log', methods=['GET'])
@require_auth
def get_auction_log():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    if db_type == 'firestore':
        doc_ref = db.collection('auction_logs').document(g.user_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify_success({'auctionLog': {}})
        row = doc.to_dict()
        return jsonify_success({'auctionLog': row.get('auctionLog', {})})
    else:
        row = db.execute(
            "SELECT auction_log FROM auction_log WHERE google_sub = ?", (g.user_id,)
        ).fetchone()
        if not row:
            return jsonify_success({'auctionLog': {}})
        try:
            return jsonify_success({'auctionLog': json.loads(row['auction_log'])})
        except Exception:
            return jsonify_success({'error': 'Corrupted auction log'})
