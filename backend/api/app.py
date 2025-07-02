# File: app.py
import os
import re
import click
import sqlite3
import json
from functools import wraps
from flask import Flask, request, jsonify, g, make_response
import stripe

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
    app.config['CORS_ORIGINS'] = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
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
        db = get_db()
        db.execute(
            "INSERT INTO users (google_sub) VALUES (?) ON CONFLICT(google_sub) DO NOTHING",
            (sub,)
        )
        db.commit()
        row = db.execute(
            "SELECT plan FROM users WHERE google_sub = ?", (sub,)
        ).fetchone()
        if not row:
            return jsonify_error('user_not_found', 'User not found', 404)
        return jsonify_success({
            'plan': row['plan'],
            'email': g.user_email,
            'picture': g.user_picture,
            'sub': sub
        })

    # --- /api/create-checkout-session ---
    @app.route('/api/create-checkout-session', methods=['POST'])
    @require_auth
    def create_checkout_session():
        data = request.get_json() or {}
        plan = data.get('plan')
        if plan not in ('basic', 'pro', 'enterprise'):
            return jsonify_error('invalid_plan', 'Plan must be one of basic, pro, enterprise')
        price_map = {
            'basic': app.config['STRIPE_PRICE_BASIC'],
            'pro': app.config['STRIPE_PRICE_PRO'],
            'enterprise': app.config['STRIPE_PRICE_ENTERPRISE'],
        }
        try:
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
        if not session_id:
            return jsonify_error('missing_session', 'Missing sessionId')
        try:
            session = stripe.checkout.Session.retrieve(session_id, expand=['payment_intent'])
            if session.payment_status in ('paid', 'complete') and session.metadata:
                db = get_db()
                db.execute(
                    "UPDATE users SET plan = ? WHERE google_sub = ?",
                    (session.metadata.get('plan'), session.client_reference_id)
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

    # --- /api/save-league-settings ---
    @app.route('/api/save-league-settings', methods=['POST'])
    @require_auth
    def save_league_settings():
        data = request.get_json() or {}
        roster = data.get('roster', {})
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
            db = get_db()
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
        row = get_db().execute(
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
    @app.route('/api/giocatori', methods=['GET'])
    def get_giocatori():
        db = get_db()
        rows = db.execute('SELECT * FROM giocatori').fetchall()
        if not rows:
            merge_and_update_players()
            rows = db.execute('SELECT * FROM giocatori').fetchall()
        return jsonify_success({'giocatori': [dict(r) for r in rows]})

    # Register strategy blueprint
    app.register_blueprint(strategy_api, url_prefix='/api')

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


if __name__ == '__main__':
    create_app().run(debug=True)
