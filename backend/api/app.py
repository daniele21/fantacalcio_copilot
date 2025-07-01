from flask import Flask, request, jsonify
import requests
import sqlite3
import os
from flask_cors import CORS
import stripe
import json

from backend.update_players import merge_and_update_players

app = Flask(__name__)
# CORS(app, origins=[
#     "http://localhost:8000",
#     "http://localhost:8080",
#     "http://127.0.0.1:5173",
#     "http://127.0.0.1:3000",
#     "http://127.0.0.1:8000",
#     "http://127.0.0.1:8080",
#     "http://localhost:5173",
# ], supports_credentials=True)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:*", "http://127.0.0.1:*"]}},
     supports_credentials=True)

# ─── Stripe Setup ──────────────────────────────────────────────────────────────
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

# --- DB Connection ---
def get_db():
    db_path = os.environ.get("SQLITE_PATH") or "backend/database/fantacalcio.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# --- Google Token Verification ---
def verify_google_token(id_token: str):
    resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
    if resp.status_code != 200:
        return None
    return resp.json()

# --- /api/me endpoint ---
@app.route("/api/me", methods=["GET"])
def get_me():
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        app.logger.warning("/api/me: Missing or invalid Authorization header. Headers: %s", dict(request.headers))
        return jsonify({"error": "Missing Authorization header"}), 401
    id_token = auth.split(" ", 1)[1]
    decoded = verify_google_token(id_token)
    if not decoded:
        app.logger.warning("/api/me: Invalid Google ID token. Token: %s", id_token)
        return jsonify({"error": "Invalid Google ID token"}), 401
    google_sub = decoded["sub"]
    db = get_db()
    db.execute(
        """
        INSERT INTO users (google_sub)
        VALUES (?)
        ON CONFLICT(google_sub) DO NOTHING
        """,
        (google_sub,)
    )
    db.commit()
    user = db.execute(
        "SELECT plan FROM users WHERE google_sub = ?",
        (google_sub,)
    ).fetchone()
    if not user:
        return jsonify({"error": "User not found after upsert"}), 404
    return jsonify({
        "plan": user["plan"],
        "email": decoded.get("email"),
        "picture": decoded.get("picture"),
        "sub": google_sub
    })

# ─── /api/create-checkout-session ─────────────────────────────────────────────
@app.route("/api/create-checkout-session", methods=["POST"])
def create_checkout_session():
    # 1) Auth
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return jsonify({"error": "Missing Authorization header"}), 401
    id_token = auth.split(" ", 1)[1]
    decoded  = verify_google_token(id_token)
    if not decoded:
        return jsonify({"error": "Invalid Google ID token"}), 401
    google_sub = decoded["sub"]
    # 2) Plan → Stripe Price ID
    data = request.get_json() or {}
    plan = data.get("plan")
    if plan not in ("basic", "pro", "enterprise"):
        return jsonify({"error": "Invalid plan"}), 400
    price_map = {
        "basic":      os.environ["STRIPE_PRICE_BASIC"],
        "pro":        os.environ["STRIPE_PRICE_PRO"],
        "enterprise": os.environ["STRIPE_PRICE_ENTERPRISE"],
    }
    price_id = price_map[plan]
    # 3) Create session
    
    # MOCKED RESPONSE FOR TESTING
    # return jsonify({"sessionId": "cs_test_mocked_1234567890"})
    
    try:
        session = stripe.checkout.Session.create(
            mode='payment',  # for recurring billing
            payment_method_types=['card'],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{os.environ['FRONTEND_URL']}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=os.environ['FRONTEND_URL'],
            client_reference_id=google_sub,
            metadata={"plan": plan}
        )
        return jsonify({"sessionId": session.id})
    except Exception as e:
        app.logger.error("Stripe error creating checkout session: %s", e)
        return jsonify({"error": "Could not create checkout session"}), 500

# --- /api/checkout-session endpoint ---
@app.route("/api/checkout-session", methods=["GET"])
def get_checkout_session():
    session_id = request.args.get("sessionId")
    if not session_id:
        return jsonify({"error": "Missing sessionId"}), 400
    try:
        session = stripe.checkout.Session.retrieve(
            session_id,
            expand=["payment_intent"],
        )
        # Update user plan in DB if payment is complete and plan is present
        plan = session.metadata.get("plan") if session.metadata else None
        payment_status = session.payment_status
        google_sub = session.client_reference_id
        if plan in ("basic", "pro", "enterprise") and payment_status in ("paid", "complete") and google_sub:
            db = get_db()
            db.execute("UPDATE users SET plan = ? WHERE google_sub = ?", (plan, google_sub))
            db.commit()
        return jsonify({
            "id": session.id,
            "payment_status": payment_status,
            "metadata": session.metadata,
        })
    except Exception as e:
        app.logger.error("Error fetching checkout session: %s", e)
        return jsonify({"error": "Could not retrieve session"}), 500

# --- League Settings Table ---
def ensure_league_settings_table():
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS league_settings (
            google_sub TEXT PRIMARY KEY,
            participants INTEGER,
            budget INTEGER,
            participant_names TEXT,
            n_gk_players INTEGER,
            n_def_players INTEGER,
            n_mid_players INTEGER,
            n_fwd_players INTEGER,
            use_clean_sheet_bonus BOOLEAN,
            use_defensive_modifier BOOLEAN
        )
    ''')
    db.commit()

ensure_league_settings_table()

@app.route('/api/save-league-settings', methods=['POST'])
def save_league_settings():
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return jsonify({"error": "Missing Authorization header"}), 401
    id_token = auth.split(" ", 1)[1]
    decoded = verify_google_token(id_token)
    if not decoded:
        return jsonify({"error": "Invalid Google ID token"}), 401
    google_sub = decoded["sub"]
    data = request.get_json() or {}
    roster = data.get('roster', {})
    try:
        db = get_db()
        db.execute(
            """
            INSERT INTO league_settings (
                google_sub, participants, budget, participant_names, n_gk_players, n_def_players, n_mid_players, n_fwd_players, use_clean_sheet_bonus, use_defensive_modifier
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
            """,
            (
                google_sub,
                data.get('participants'),
                data.get('budget'),
                json.dumps(data.get('participantNames', [])),
                roster.get('P', 3),
                roster.get('D', 8),
                roster.get('C', 8),
                roster.get('A', 6),
                int(bool(data.get('useCleanSheetBonus'))),
                int(bool(data.get('useDefensiveModifier')))
            )
        )
        db.commit()
        return jsonify({"success": True})
    except Exception as e:
        app.logger.error("Error saving league settings: %s", e)
        return jsonify({"error": "Could not save settings"}), 500

@app.route('/api/league-settings', methods=['GET'])
def get_league_settings():
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return jsonify({"error": "Missing Authorization header"}), 401
    id_token = auth.split(" ", 1)[1]
    decoded = verify_google_token(id_token)
    if not decoded:
        return jsonify({"error": "Invalid Google ID token"}), 401
    google_sub = decoded["sub"]
    db = get_db()
    row = db.execute("SELECT * FROM league_settings WHERE google_sub = ?", (google_sub,)).fetchone()
    if not row:
        return jsonify({"settings": None})
    try:
        settings = {
            "participants": row["participants"],
            "budget": row["budget"],
            "participantNames": json.loads(row["participant_names"]),
            "roster": {
                "P": row["n_gk_players"],
                "D": row["n_def_players"],
                "C": row["n_mid_players"],
                "A": row["n_fwd_players"]
            },
            "useCleanSheetBonus": bool(row["use_clean_sheet_bonus"]),
            "useDefensiveModifier": bool(row["use_defensive_modifier"])
        }
        return jsonify({"settings": settings})
    except Exception as e:
        app.logger.error("Error loading league settings: %s", e)
        return jsonify({"settings": None, "error": "Corrupted data"})

def init_db():
    db_path = os.environ.get("SQLITE_PATH") or "backend/database/fantacalcio.db"
    sql_path = os.path.join(os.path.dirname(__file__), '../database/init.sqlite.sql')
    with sqlite3.connect(db_path) as conn:
        with open(sql_path, 'r') as f:
            conn.executescript(f.read())

init_db()  # Ensure DB is initialized at app startup

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    response.headers['Access-Control-Allow-Origin'] = origin or 'http://localhost:8000'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = request.headers.get(
        'Access-Control-Request-Headers', 'Content-Type,Authorization'
    )
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

def get_user_plan(google_sub: str) -> str:
    db = get_db()
    user = db.execute("SELECT plan FROM users WHERE google_sub = ?", (google_sub,)).fetchone()
    if user:
        app.logger.info(f"User {google_sub} has plan: {user['plan']}")
        return user["plan"]
    app.logger.info(f"User {google_sub} not found in users table.")
    return None

@app.route('/api/giocatori', methods=['GET'])
def get_giocatori():
    db = get_db()
    rows = db.execute('SELECT * FROM giocatori').fetchall()
    giocatori = [dict(row) for row in rows]
    if len(giocatori) == 0:
        app.logger.info(f"Loading Players...")
        merge_and_update_players()
        rows = db.execute('SELECT * FROM giocatori').fetchall()
        giocatori = [dict(row) for row in rows]
    return jsonify({'giocatori': giocatori})

@app.route('/api/strategy-board', methods=['POST'])
def save_strategy_board():
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return jsonify({"error": "Missing Authorization header"}), 401
    id_token = auth.split(" ", 1)[1]
    decoded = verify_google_token(id_token)
    if not decoded:
        return jsonify({"error": "Invalid Google ID token"}), 401
    google_sub = decoded["sub"]
    data = request.get_json() or {}
    role_budget = data.get('roleBudget', {})
    target_players = data.get('targetPlayers', [])
    # Now expect: targetPlayers is a list of dicts with 'id' and 'maxBid'
    if not isinstance(target_players, list):
        return jsonify({"error": "targetPlayers must be a list of objects"}), 400
    # Validate and extract player ids and max bids
    player_bid_pairs = []
    for entry in target_players:
        try:
            max_bid = int(entry['maxBid'])
        except Exception:
            max_bid = 0
        player_bid_pairs.append((google_sub, entry['id'], max_bid))
    try:
        db = get_db()
        # Upsert strategy_board (role budgets)
        db.execute(
            """
            INSERT INTO strategy_board (
                google_sub, role_budget_gk, role_budget_def, role_budget_mid, role_budget_fwd
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(google_sub) DO UPDATE SET
                role_budget_gk=excluded.role_budget_gk,
                role_budget_def=excluded.role_budget_def,
                role_budget_mid=excluded.role_budget_mid,
                role_budget_fwd=excluded.role_budget_fwd
            """,
            (
                google_sub,
                role_budget.get('GK', 0),
                role_budget.get('DEF', 0),
                role_budget.get('MID', 0),
                role_budget.get('FWD', 0)
            )
        )
        # Remove old targets
        db.execute("DELETE FROM strategy_board_targets WHERE google_sub = ?", (google_sub,))
        # Insert new targets with max_bid
        db.executemany(
            "INSERT INTO strategy_board_targets (google_sub, player_id, max_bid) VALUES (?, ?, ?)",
            player_bid_pairs
        )
        db.commit()
        return jsonify({"success": True})
    except Exception as e:
        app.logger.error("Error saving strategy board: %s", e)
        return jsonify({"error": "Could not save strategy board"}), 500

@app.route('/api/strategy-board', methods=['GET'])
def load_strategy_board():
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return jsonify({"error": "Missing Authorization header"}), 401
    id_token = auth.split(" ", 1)[1]
    decoded = verify_google_token(id_token)
    if not decoded:
        return jsonify({"error": "Invalid Google ID token"}), 401
    google_sub = decoded["sub"]
    db = get_db()
    # Load role budgets
    row = db.execute("SELECT role_budget_gk, role_budget_def, role_budget_mid, role_budget_fwd FROM strategy_board WHERE google_sub = ?", (google_sub,)).fetchone()
    if not row:
        return jsonify({"roleBudget": None, "targetPlayers": [], "targetPlayerDetails": []})
    role_budget = {
        "GK": row["role_budget_gk"],
        "DEF": row["role_budget_def"],
        "MID": row["role_budget_mid"],
        "FWD": row["role_budget_fwd"]
    }
    # Load target player IDs and max bids
    target_rows = db.execute("SELECT player_id, max_bid FROM strategy_board_targets WHERE google_sub = ?", (google_sub,)).fetchall()
    target_players = [
        {"player_id": r["player_id"], "max_bid": r["max_bid"]} for r in target_rows
    ]
    # Load player details (if any targets)
    target_player_details = []
    if target_players:
        player_ids = [r["player_id"] for r in target_rows]
        placeholders = ','.join(['?'] * len(player_ids))
        details_rows = db.execute(f"SELECT * FROM giocatori WHERE id IN ({placeholders})", player_ids).fetchall()
        max_bid_map = {r["player_id"]: r["max_bid"] for r in target_rows}
        target_player_details = []
        for row in details_rows:
            player_id = row["id"]
            player = {
                "nome": row["nome"],
                "ruolo": row["ruolo"],
                "quota_attuale": row["quota_attuale"],
                "max_bid": max_bid_map.get(player_id, 0)
            }
            target_player_details.append(player)
    return jsonify({
        "targetPlayer": target_player_details
    })

if __name__ == "__main__":
    app.run(debug=True)
