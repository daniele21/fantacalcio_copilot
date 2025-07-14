# File: app.py
import os
import re
import click
import sqlite3
import json
from functools import wraps
from flask import Flask, request, jsonify, g, make_response
import stripe
from google.cloud import firestore
import functools
import hashlib
import time
from functools import lru_cache
import sys
import yaml
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Utility and blueprint imports
from backend.api.utils import (
    get_db,
    close_db,
    init_db,
    require_auth,
    jsonify_success,
    jsonify_error,
    verify_google_token
)
from backend.api.strategy import strategy_api
from backend.update_players import merge_and_update_players


def create_app():
    app = Flask(__name__)
    # Configuration
    app.config['SQLITE_PATH'] = os.getenv('SQLITE_PATH', 'backend/database/fantacalcio.db')
    app.config['FRONTEND_URL'] = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    app.config['STRIPE_SECRET_KEY'] = os.getenv('STRIPE_SECRET_KEY')
    app.config['STRIPE_PRICE_BASIC'] = os.getenv('STRIPE_PRICE_BASIC')
    app.config['STRIPE_PRICE_PRO'] = os.getenv('STRIPE_PRICE_PRO')
    app.config['STRIPE_PRICE_ENTERPRISE'] = os.getenv('STRIPE_PRICE_ENTERPRISE')
    app.config['STRIPE_CREDITS'] = os.getenv('STRIPE_CREDITS')
    app.config['CORS_ORIGINS'] = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://fantacalcio-project.web.app'
    ]

    # Stripe setup
    stripe.api_key = app.config['STRIPE_SECRET_KEY']

    # Handle CORS preflight for /api/*
    @app.before_request
    def handle_global_options():
        if request.method == 'OPTIONS' and request.path.startswith('/api/'):
            return make_response('', 204)

    # Teardown DB
    app.teardown_appcontext(close_db)

    # CLI: init-db
    @app.cli.command('init-db')
    def init_db_command():
        init_db(app.config['SQLITE_PATH'])
        click.echo('Initialized the database.')

    # Health check
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify_success({'status': 'ok'})

    # --- /api/me ---
    @app.route('/api/me', methods=['GET'])
    @require_auth
    def get_me():
        sub = g.user_id
        db_type = os.getenv('DB_TYPE', 'sqlite')
        db = get_db()
        tos_accepted = False
        if db_type == 'firestore':
            user_ref = db.collection('users').document(sub)
            user_doc = user_ref.get()
            if not user_doc.exists:
                plan = 'free'
                # Create user if not exists
                user_ref.set({'plan': plan, 
                              'email': g.user_email, 
                              'created_at': firestore.SERVER_TIMESTAMP, 
                              'ai_credits': CREDITS_PER_PLAN[plan]}, 
                             merge=True)
                tos_accepted = False
            else:
                user_data = user_doc.to_dict()
                plan = user_data.get('plan', 'free')
                ai_credits = user_data.get('ai_credits', 0)
                tos_accepted = bool(user_data.get('tos_version'))
            return jsonify_success({
                'plan': plan,
                'email': g.user_email,
                'picture': g.user_picture,
                'sub': sub,
                'ai_credits': ai_credits,
                'tos_accepted': tos_accepted
            })
        else:
            # Check if user exists
            row = db.execute("SELECT plan, ai_credits FROM users WHERE google_sub = ?", (sub,)).fetchone()
            if not row:
                plan = 'free'
                credits = CREDITS_PER_PLAN.get(plan, 0)
                db.execute(
                    "INSERT INTO users (google_sub, plan, ai_credits) VALUES (?, ?, ?)",
                    (sub, plan, credits)
                )
                db.commit()
                ai_credits = credits
                tos_accepted = False
            else:
                plan = row['plan']
                ai_credits = row['ai_credits']
                # Check tos_acceptance table
                tos_row = db.execute("SELECT version FROM tos_acceptance WHERE google_sub = ?", (sub,)).fetchone()
                tos_accepted = bool(tos_row)
            return jsonify_success({
                'plan': plan,
                'email': g.user_email,
                'picture': g.user_picture,
                'sub': sub,
                'ai_credits': ai_credits,
                'tos_accepted': tos_accepted
            })

    # --- /api/create-checkout-session ---
    @app.route('/api/create-checkout-session', methods=['POST'])
    @require_auth
    def create_checkout_session():
        data = request.get_json() or {}
        plan = data.get('plan')
        credits = data.get('credits', 0)  # Default to 30 credits if not specified
        if plan not in ('free', 'basic', 'pro', 'enterprise'):
            return jsonify_error('invalid_plan', 'Plan must be one of basic, pro, enterprise')
        price_map = {
            'basic': app.config['STRIPE_PRICE_BASIC'],
            'pro': app.config['STRIPE_PRICE_PRO'],
            'enterprise': app.config['STRIPE_PRICE_ENTERPRISE']
        }
        try:
            if credits > 0 :
                # For credits, we use a different mode
                credits_stripe = app.config['STRIPE_CREDITS']  # FIX: remove comma, should be string not tuple
                session = stripe.checkout.Session.create(
                    mode='payment',
                    payment_method_types=['card'],
                    line_items=[{'price': credits_stripe, 'quantity': credits}],
                    success_url=f"{app.config['FRONTEND_URL']}/success?session_id={{CHECKOUT_SESSION_ID}}",
                    cancel_url=app.config['FRONTEND_URL'],
                    client_reference_id=g.user_id,
                    metadata={'plan': plan, 'credits': credits}
                )
            else:
                session = stripe.checkout.Session.create(
                    mode='payment',
                    payment_method_types=['card'],
                    line_items=[{'price': price_map[plan], 'quantity': 1}],
                    success_url=f"{app.config['FRONTEND_URL']}/success?session_id={{CHECKOUT_SESSION_ID}}",
                    cancel_url=app.config['FRONTEND_URL'],
                    client_reference_id=g.user_id,
                    metadata={'plan': plan}
                )
            return jsonify_success({'sessionUrl': session.url})
        except stripe.error.StripeError as e:
            app.logger.exception('Stripe error')
            return jsonify_error('stripe_error', e.user_message or 'Could not create checkout session', 500)

    # --- /api/checkout-session ---
    @app.route('/api/checkout-session', methods=['GET'])
    @require_auth
    def get_checkout_session():
        session_id = request.args.get('sessionId')
        credits = request.args.get('credits', 0)
        if not session_id:
            return jsonify_error('missing_session', 'Missing sessionId')
        try:
            session = stripe.checkout.Session.retrieve(session_id, expand=['payment_intent'])
            db_type = os.getenv('DB_TYPE', 'sqlite')
            db = get_db()
            if session.payment_status in ('paid', 'complete') and session.metadata:
                plan = session.metadata.get('plan')
                credits = CREDITS_PER_PLAN.get(plan, 0) if credits == 0 else int(credits)
                if db_type == 'firestore':
                    user_ref = db.collection('users').document(session.client_reference_id)
                    user_doc = user_ref.get()
                    last_session_id = None
                    current_credits = 0
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        last_session_id = user_data.get('last_session_id')
                        current_credits = user_data.get('ai_credits', 0)
                    if last_session_id != session.id:
                        # If this is a topup (not a plan change), add credits to existing
                        if plan == user_data.get('plan'):
                            new_credits = current_credits + credits
                        else:
                            new_credits = credits
                        user_ref.set({'plan': plan, 'ai_credits': new_credits, 'last_session_id': session.id}, merge=True)
                else:
                    # processed_sessions table is always present from init.sql
                    already_processed = db.execute(
                        "SELECT 1 FROM processed_sessions WHERE session_id = ?", (session.id,)
                    ).fetchone()
                    if not already_processed:
                        db.execute(
                            "UPDATE users SET plan = ?, ai_credits = ai_credits + ?, last_credits_update = CURRENT_TIMESTAMP, last_session_id = ? WHERE google_sub = ?",
                            (plan, credits, session.id, session.client_reference_id)
                        )
                        db.execute(
                            "INSERT INTO processed_sessions (session_id, google_sub) VALUES (?, ?)",
                            (session.id, session.client_reference_id)
                        )
                        db.commit()
            return jsonify_success({
                'id': session.id,
                'payment_status': session.payment_status,
                'metadata': session.metadata,
            })
        except Exception:
            app.logger.exception('Error retrieving checkout session')
            return jsonify_error('stripe_error', 'Could not retrieve session', 500)

    @app.route('/api/checkout-session', methods=['POST'])
    @require_auth
    def post_checkout_session():
        data = request.get_json() or {}
        plan = data.get('plan')
        credits = data.get('credits')
        current_plan = data.get('current_plan')
        session_id = data.get('sessionId')
        if not session_id or (plan is None and credits is None):
            return jsonify_error('missing_data', 'Missing plan/credits or sessionId')
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            db_type = os.getenv('DB_TYPE', 'sqlite')
            db = get_db()
            meta = session.metadata or {}
            # If credits is present, this is a credit top-up
            if credits is not None:
                credits = int(credits)
                if credits <= 0:
                    return jsonify_error('invalid_credits', 'Credits must be > 0')
                if db_type == 'firestore':
                    user_ref = db.collection('users').document(session.client_reference_id)
                    user_doc = user_ref.get()
                    last_session_id = None
                    current_credits = 0
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        last_session_id = user_data.get('last_session_id')
                        current_credits = user_data.get('ai_credits', 0)
                    if last_session_id != session.id:
                        new_credits = current_credits + credits
                        # Do NOT change plan, just add credits
                        user_ref.set({'ai_credits': new_credits, 'last_session_id': session.id}, merge=True)
                else:
                    already_processed = db.execute(
                        "SELECT 1 FROM processed_sessions WHERE session_id = ?", (session.id,)
                    ).fetchone()
                    if not already_processed:
                        db.execute(
                            "UPDATE users SET ai_credits = ai_credits + ?, last_credits_update = CURRENT_TIMESTAMP, last_session_id = ? WHERE google_sub = ?",
                            (credits, session.id, session.client_reference_id)
                        )
                        db.execute(
                            "INSERT INTO processed_sessions (session_id, google_sub) VALUES (?, ?)",
                            (session.id, session.client_reference_id)
                        )
                        db.commit()
                return jsonify_success({'status': 'updated', 'credits': credits, 'plan': current_plan})
            # Otherwise, this is a plan change
            else:
                credits_to_set = CREDITS_PER_PLAN.get(plan, 0)
                if db_type == 'firestore':
                    user_ref = db.collection('users').document(session.client_reference_id)
                    user_doc = user_ref.get()
                    last_session_id = None
                    current_credits = 0
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        last_session_id = user_data.get('last_session_id')
                        current_credits = user_data.get('ai_credits', 0)
                    if last_session_id != session.id:
                        if plan == user_data.get('plan'):
                            new_credits = current_credits + credits_to_set
                        else:
                            new_credits = credits_to_set
                        user_ref.set({'plan': plan, 'ai_credits': new_credits, 'last_session_id': session.id}, merge=True)
                else:
                    already_processed = db.execute(
                        "SELECT 1 FROM processed_sessions WHERE session_id = ?", (session.id,)
                    ).fetchone()
                    if not already_processed:
                        db.execute(
                            "UPDATE users SET plan = ?, ai_credits = ai_credits + ?, last_credits_update = CURRENT_TIMESTAMP, last_session_id = ? WHERE google_sub = ?",
                            (plan, credits_to_set, session.id, session.client_reference_id)
                        )
                        db.execute(
                            "INSERT INTO processed_sessions (session_id, google_sub) VALUES (?, ?)",
                            (session.id, session.client_reference_id)
                        )
                        db.commit()
                return jsonify_success({'status': 'updated', 'plan': plan, 'credits': credits_to_set})
        except Exception:
            app.logger.exception('Error updating plan after checkout')
            return jsonify_error('stripe_error', 'Could not update plan', 500)

    # --- /api/save-league-settings ---
    @app.route('/api/save-league-settings', methods=['POST'])
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
                app.logger.exception('Error saving league settings')
                return jsonify_error('db_error', 'Could not save settings', 500)

    # --- /api/league-settings ---
    @app.route('/api/league-settings', methods=['GET'])
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
                app.logger.exception('Error loading league settings')
                return jsonify_error('corrupted', 'Corrupted data')
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
                app.logger.exception('Error loading league settings')
                return jsonify_error('corrupted', 'Corrupted data')

    # --- /api/giocatori ---
    @cache_api_lru(maxsize=128, ttl=60*24)  # Cache for 24 hours
    def get_giocatori_cached(db_type, db_path):
        if db_type == 'firestore':
            db = get_db()
            giocatori_ref = db.collection('giocatori')
            docs = giocatori_ref.stream()
            giocatori = [doc.to_dict() | {'id': doc.id} for doc in docs if doc.id != 'init']
            if not giocatori:
                merge_and_update_players()
                docs = giocatori_ref.stream()
                giocatori = [doc.to_dict() | {'id': doc.id} for doc in docs if doc.id != 'init']
            return giocatori
        else:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            rows = conn.execute('SELECT * FROM giocatori').fetchall()
            if not rows:
                merge_and_update_players()
                rows = conn.execute('SELECT * FROM giocatori').fetchall()
            conn.close()
            return [dict(r) for r in rows]

    @app.route('/api/giocatori', methods=['GET'])
    @require_auth
    def get_giocatori():
        db_type = os.getenv('DB_TYPE', 'sqlite')
        db_path = os.getenv('SQLITE_PATH', 'backend/database/fantacalcio.db')
        giocatori = get_giocatori_cached(db_type, db_path)
        # Fetch user plan
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
        # If free plan, return a stratified random sample (e.g., 30 players by recommendation)
        if plan == 'free' and len(giocatori) > 30:
            import random
            from collections import defaultdict
            # Group by recommendation (rounded to int, fallback 0)
            groups = defaultdict(list)
            for p in giocatori:
                try:
                    rec = int(round(float(p.get('fvm_recommendation', 0))))
                except Exception:
                    rec = 0
                groups[rec].append(p)
            # Define how many to sample from each group (proportional, but at least 1 if group not empty)
            total = 30
            rec_levels = sorted(groups.keys(), reverse=True)  # e.g., 5,4,3,2,1,0
            group_sizes = {k: len(groups[k]) for k in rec_levels}
            total_players = sum(group_sizes.values())
            # Proportional allocation
            stratified = []
            remaining = total
            for i, k in enumerate(rec_levels):
                if i == len(rec_levels) - 1:
                    n = remaining  # all remaining
                else:
                    n = max(1, int(round(total * group_sizes[k] / total_players)))
                    n = min(n, group_sizes[k])
                if n > 0:
                    stratified.extend(random.sample(groups[k], n))
                remaining -= n
                if remaining <= 0:
                    break
            # If not enough, fill up with randoms
            if len(stratified) < total:
                leftovers = [p for k in rec_levels for p in groups[k] if p not in stratified]
                needed = total - len(stratified)
                if leftovers:
                    stratified.extend(random.sample(leftovers, min(needed, len(leftovers))))
            random.shuffle(stratified)
            giocatori = stratified[:total]
        return jsonify_success({'giocatori': giocatori})

    # --- /api/save-auction-log ---
    @app.route('/api/save-auction-log', methods=['POST'])
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
            # Store as JSON string in new table auction_log
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
                app.logger.exception('Error saving auction log')
                return jsonify_error('db_error', 'Could not save auction log', 500)

    # --- /api/get-auction-log ---
    @app.route('/api/get-auction-log', methods=['GET'])
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
                app.logger.exception('Error loading auction log')
                return jsonify_error('corrupted', 'Corrupted auction log')

    # --- /api/use-ai-credit ---
    @app.route('/api/use-ai-credit', methods=['POST'])
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
            # Atomically decrement ai_credits, increment api_cost and spent_credits
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
            # Use a transaction to ensure atomicity
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
                app.logger.exception('Error decrementing ai_credits or incrementing api_cost/spent_credits')
                return jsonify_error('db_error', 'Errore nel decremento crediti o aggiornamento costi', 500)

    # --- /api/check-credit ---
    @app.route('/api/check-credit', methods=['GET'])
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

    # --- /api/accept-tos ---
    @app.route('/api/accept-tos', methods=['POST'])
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
            # SQLite: upsert into tos_acceptance table
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

    # --- Flask-Limiter setup ---
    limiter = Limiter(get_remote_address, default_limits=["20 per minute"])
    limiter.init_app(app)
    app.limiter = limiter  # Attach to app for blueprint access

    # Register strategy blueprint
    app.register_blueprint(strategy_api, url_prefix='/api')

    # Register blueprints
    from backend.api.gemini_api import gemini_api
    app.register_blueprint(gemini_api, url_prefix='/api/gemini')

    # Global CORS headers
    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin in app.config['CORS_ORIGINS']:
            response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = request.headers.get(
            'Access-Control-Request-Headers', 'Authorization,Content-Type'
        )
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,DELETE,OPTIONS'
        return response

    return app


# --- SIMPLE LRU CACHE DECORATOR FOR API (per-process, not distributed) ---
def cache_api_lru(maxsize=128, ttl=60*24):
    def decorator(func):
        cached_func = lru_cache(maxsize=maxsize)(func)
        cache_times = {}
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Use function arguments as cache key
            key = str(args) + str(kwargs)
            key_hash = hashlib.sha256(key.encode()).hexdigest()
            now = time.time()
            # Check TTL
            if key_hash in cache_times and now - cache_times[key_hash] < ttl:
                print("\033[92m[Cache] {} served from cache_api_lru\033[0m".format(request.path), file=sys.stderr)
                return cached_func(*args, **kwargs)
            # Call and cache
            result = func(*args, **kwargs)
            cached_func.cache_clear()  # Clear LRU cache to avoid memory leak
            cached_func(*args, **kwargs)  # Store dummy value to keep LRU logic
            cache_times[key_hash] = now
            return result
        return wrapper
    return decorator


def load_credits_config():
    config_path = os.getenv('CREDITS_CONFIG_PATH', 'backend/api/credits_config.yaml')
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            return config.get('credits_per_plan', {})
    except Exception as e:
        print(f"[WARN] Could not load credits config: {e}")
        return {'free': 0, 'basic': 0, 'pro': 0, 'enterprise': 0}


CREDITS_PER_PLAN = load_credits_config()


if __name__ == '__main__':
    create_app().run(debug=True)
