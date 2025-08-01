import os
import sqlite3
import json
from flask import Blueprint, request, g
from ..util import get_db, jsonify_success, require_auth

routes_league_settings = Blueprint('routes_league_settings', __name__)

@routes_league_settings.route('/api/save-league-settings', methods=['POST'])
@require_auth
def save_league_settings():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    data = request.get_json() or {}
    roster = data.get('roster', {})
    if db_type == 'firestore':
        doc_ref = db.collection('league_settings').document(g.user_id)
        doc_ref.set({
            'participants': data.get('participants'),
            'budget': data.get('budget'),
            'participantNames': data.get('participantNames', []),
            'n_gk_players': roster.get('P', 3),
            'n_def_players': roster.get('D', 8),
            'n_mid_players': roster.get('C', 8),
            'n_fwd_players': roster.get('A', 6),
            'use_clean_sheet_bonus': int(bool(data.get('useCleanSheetBonus'))),
            'use_defensive_modifier': int(bool(data.get('useDefensiveModifier'))),
        }, merge=True)
        return jsonify_success()
    else:
        vals = (
            g.user_id,
            data.get('participants'),
            data.get('budget'),
            json.dumps(data.get('participantNames', [])),
            roster.get('P', 3),
            roster.get('D', 8),
            roster.get('C', 8),
            roster.get('A', 6),
            int(bool(data.get('useCleanSheetBonus'))),
            int(bool(data.get('useDefensiveModifier'))),
        )
        try:
            db.execute(
                '''
                INSERT INTO league_settings (
                    google_sub, participants, budget, participant_names,
                    n_gk_players, n_def_players, n_mid_players, n_fwd_players,
                    use_clean_sheet_bonus, use_defensive_modifier
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(google_sub) DO UPDATE SET
                participants=excluded.participants,
                budget=excluded.budget,
                participant_names=excluded.participant_names,
                n_gk_players=excluded.n_gk_players,
                n_def_players=excluded.n_def_players,
                n_mid_players=excluded.n_mid_players,
                n_fwd_players=excluded.n_fwd_players,
                use_clean_sheet_bonus=excluded.use_clean_sheet_bonus,
                use_defensive_modifier=excluded.use_defensive_modifier
                ''' , vals
            )
            db.commit()
            return jsonify_success()
        except Exception:
            return jsonify_success({'error': 'Could not save settings'})

@routes_league_settings.route('/api/league-settings', methods=['GET'])
@require_auth
def get_league_settings():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    db = get_db()
    if db_type == 'firestore':
        doc_ref = db.collection('league_settings').document(g.user_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify_success({'settings': None})
        row = doc.to_dict()
        try:
            settings = {
                'participants': row.get('participants'),
                'budget': row.get('budget'),
                'participantNames': row.get('participantNames', []),
                'roster': {
                    'P': row.get('n_gk_players', 3),
                    'D': row.get('n_def_players', 8),
                    'C': row.get('n_mid_players', 8),
                    'A': row.get('n_fwd_players', 6),
                },
                'useCleanSheetBonus': bool(row.get('use_clean_sheet_bonus', 0)),
                'useDefensiveModifier': bool(row.get('use_defensive_modifier', 0)),
            }
            return jsonify_success({'settings': settings})
        except Exception:
            return jsonify_success({'error': 'Corrupted data'})
    else:
        row = db.execute(
            "SELECT * FROM league_settings WHERE google_sub = ?", (g.user_id,)
        ).fetchone()
        if not row:
            return jsonify_success({'settings': None})
        try:
            settings = {
                'participants': row['participants'],
                'budget': row['budget'],
                'participantNames': json.loads(row['participant_names']),
                'roster': {
                    'P': row['n_gk_players'],
                    'D': row['n_def_players'],
                    'C': row['n_mid_players'],
                    'A': row['n_fwd_players'],
                },
                'useCleanSheetBonus': bool(row['use_clean_sheet_bonus']),
                'useDefensiveModifier': bool(row['use_defensive_modifier']),
            }
            return jsonify_success({'settings': settings})
        except Exception:
            return jsonify_success({'error': 'Corrupted data'})
