import os
import re
import json
import sqlite3
from flask import request, jsonify, g
from functools import wraps
import requests


def get_db():
    if 'db' not in g:
        conn = sqlite3.connect(
            os.getenv('SQLITE_PATH', 'backend/database/fantacalcio.db'),
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db(db_path):
    sql_path = os.path.join(os.path.dirname(__file__), '../database/init.sqlite.sql')
    with sqlite3.connect(db_path) as conn:
        with open(sql_path, 'r') as f:
            conn.executescript(f.read())


def jsonify_success(data=None):
    return jsonify({'success': True, 'data': data or {}})


def jsonify_error(code, message, status=400):
    return jsonify({'success': False, 'error': {'code': code, 'message': message}}), status


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow CORS preflight
        if request.method == 'OPTIONS':
            from flask import make_response
            return make_response('', 204)
        auth = request.headers.get('Authorization', '')
        m = re.match(r'^Bearer\s+(\S+)$', auth, flags=re.IGNORECASE)
        if not m:
            return jsonify_error('missing_auth', 'Missing or invalid Authorization header', 401)
        token = m.group(1)
        decoded = verify_google_token(token)
        if not decoded or 'sub' not in decoded:
            return jsonify_error('invalid_token', 'Invalid Google ID token', 401)
        g.user_id = decoded['sub']
        g.user_email   = decoded.get('email')
        g.user_picture = decoded.get('picture')
        return f(*args, **kwargs)
    return decorated


def verify_google_token(id_token: str):
    resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
    if resp.status_code != 200:
        return None
    return resp.json()

