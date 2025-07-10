-- Script di inizializzazione tabella giocatori per SQLite
CREATE TABLE IF NOT EXISTS giocatori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT,
    punteggio REAL,
    fantamedia_2024_2025 REAL,
    fantamedia_2023_2024 REAL,
    fantamedia_2022_2023 REAL,
    presenze_2024_2025 REAL,
    fanta_media_2024_2025 REAL,
    fm_su_tot_gare_2024_2025 REAL,
    presenze_previste TEXT,
    gol_previsti TEXT,
    assist_previsti REAL,
    ruolo TEXT,
    ruolo_m TEXT,
    ruolo_quote TEXT,
    skills TEXT,
    buon_investimento REAL,
    resistenza_infortuni REAL,
    consigliato INTEGER,
    infortunato INTEGER,
    nuovo_acquisto INTEGER,
    squadra TEXT,
    squadra_quote TEXT,
    quota_attuale INTEGER,
    quota_iniziale INTEGER,
    diff INTEGER,
    quota_attuale_m INTEGER,
    quota_iniziale_m INTEGER,
    diff_m INTEGER,
    fvm INTEGER,
    fvm_m INTEGER,
    trend TEXT,
    presenze INTEGER,
    appetibilita REAL,
    recommendation INTEGER,
    fvm_recommendation INTEGER,
    suggested_bid_min INTEGER,
    suggested_bid_max INTEGER,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- USERS & PLANS TABLES FOR LOGIN/SUBSCRIPTION MANAGEMENT
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT UNIQUE NOT NULL,    -- the Google “sub” claim
  plan TEXT NOT NULL DEFAULT 'free',  -- e.g. 'free' | 'basic' | 'pro' | 'enterprise'
  ai_credits INTEGER NOT NULL DEFAULT 0, -- AI credits for the user
  spent_credits INTEGER NOT NULL DEFAULT 0, -- Credits spent by the user
  api_cost NUMERIC NOT NULL DEFAULT 0, -- API cost for the user
  last_credits_update TIMESTAMP,        -- Last update timestamp for credits
  last_session_id TEXT,                  -- Last Stripe session id for plan/credits
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optional: relational plans table
CREATE TABLE IF NOT EXISTS plans (
  key TEXT PRIMARY KEY,  -- 'free', 'basic', 'pro'
  price NUMERIC,
  features TEXT
);

-- If you want to enforce the foreign key (optional, requires plans table to be populated first):
-- ALTER TABLE users ADD CONSTRAINT fk_plan FOREIGN KEY (plan) REFERENCES plans(key);

-- CREATE TABLE IF NOT EXISTS strategy_boards (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     user_id INTEGER NOT NULL,
--     role_budget_role_gk INTEGER,
--     role_budget_role_def INTEGER,
--     role_budget_role_mid INTEGER,
--     role_budget_role_fwd INTEGER,
--     -- Target players as separate table is best, but for now, flatten a few fields for quick access
--     target_players TEXT NOT NULL -- JSON string (for now, can be normalized later)
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY(user_id) REFERENCES users(id)
-- );

CREATE TABLE IF NOT EXISTS league_settings (
    google_sub TEXT PRIMARY KEY,
    participants INTEGER,
    budget INTEGER,
    participant_names TEXT,
    n_gk_players INTEGER,
    n_def_players INTEGER,
    n_mid_players INTEGER,
    n_fwd_players INTEGER,
    use_clean_sheet_bonus INTEGER,
    use_defensive_modifier INTEGER
);

CREATE TABLE IF NOT EXISTS strategy_board (
    google_sub TEXT PRIMARY KEY,
    role_budget_gk INTEGER,
    role_budget_def INTEGER,
    role_budget_mid INTEGER,
    role_budget_fwd INTEGER,
    FOREIGN KEY(google_sub) REFERENCES users(google_sub)
);

CREATE TABLE IF NOT EXISTS strategy_board_targets (
    google_sub TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    max_bid INTEGER DEFAULT 0,
    PRIMARY KEY (google_sub, player_id),
    FOREIGN KEY(google_sub) REFERENCES users(google_sub),
    FOREIGN KEY(player_id) REFERENCES giocatori(id)
);

CREATE TABLE IF NOT EXISTS auction_log (
    google_sub TEXT PRIMARY KEY,
    auction_log TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(google_sub) REFERENCES users(google_sub)
);

CREATE TABLE IF NOT EXISTS processed_sessions (
    session_id TEXT PRIMARY KEY,
    google_sub TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
