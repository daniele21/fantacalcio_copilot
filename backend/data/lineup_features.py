#!/usr/bin/env python3
"""
Build lineup decision features for Fantacalcio by user tier and player role.

Usage:
  python build_lineup_features.py --input players.csv --outdir ./out

Outputs:
  out/beginner_{gk|def|mid|fwd}_lineup_features.csv
  out/intermediate_{gk|def|mid|fwd}_lineup_features.csv
  out/expert_{gk|def|mid|fwd}_lineup_features.csv

Notes:
- Robust to missing columns: non-existent columns are skipped automatically.
- Position mapping: POR->GK, DIF->DEF, CEN->MID, ATT->FWD.
- Adds per-90 rates, success rates, and composite indices.
"""

import argparse
import glob
import os
import re
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd


# ---------- Helpers ----------

def to_snake(name: str) -> str:
    """Convert column name to snake_case and normalize symbols."""
    name = str(name).strip().replace("%", "pct")
    name = re.sub(r"[^\w]+", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_").lower()


def per90(series: pd.Series, minutes: pd.Series) -> pd.Series:
    """Compute per-90 rate safely."""
    return np.where(minutes.fillna(0) > 0, 90.0 * series.fillna(0) / minutes.fillna(0), np.nan)


def coerce_numeric(df: pd.DataFrame, text_cols: List[str]) -> pd.DataFrame:
    """Coerce non-text columns to numeric where possible."""
    for col in df.columns:
        if col not in text_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add per-90, rates, and composite indices (role-agnostic)."""
    # Minutes column (may be absent)
    mins_col = "minutes_played_total" if "minutes_played_total" in df.columns else None

    # Universal rates
    df["starter_prob"] = np.where(df.get("appearances_total", 0) > 0,
                                  df.get("lineups_total", np.nan) / df.get("appearances_total"), np.nan)
    df["sub_in_rate"] = np.where(df.get("appearances_total", 0) > 0,
                                 df.get("substitutions_in", np.nan) / df.get("appearances_total"), np.nan)
    df["sub_out_rate"] = np.where(df.get("appearances_total", 0) > 0,
                                  df.get("substitutions_out", np.nan) / df.get("appearances_total"), np.nan)
    df["clean_sheet_rate"] = np.where(df.get("appearances_total", 0) > 0,
                                      df.get("cleansheets_total", np.nan) / df.get("appearances_total"), np.nan)

    # Success % and accuracies
    df["duels_win_rate"] = np.where(df.get("total_duels_total", 0) > 0,
                                    df.get("duels_won_total", np.nan) / df.get("total_duels_total"), np.nan)
    df["dribble_success_rate"] = np.where(df.get("dribble_attempts_total", 0) > 0,
                                          df.get("successful_dribbles_total", np.nan) / df.get("dribble_attempts_total"), np.nan)
    df["cross_accuracy"] = np.where(df.get("total_crosses_total", 0) > 0,
                                    df.get("accurate_crosses_total", np.nan) / df.get("total_crosses_total"), np.nan)
    df["long_ball_accuracy"] = np.where(df.get("long_balls_total", 0) > 0,
                                        df.get("long_balls_won_total", np.nan) / df.get("long_balls_total"), np.nan)
    df["sot_pct"] = np.where(df.get("shots_total_total", 0) > 0,
                             df.get("shots_on_target_total", np.nan) / df.get("shots_total_total"), np.nan)
    df["team_win_rate"]  = np.where(df.get("appearances_total", 0) > 0,
                                    df.get("team_wins_total", np.nan) / df.get("appearances_total"), np.nan)
    df["team_loss_rate"] = np.where(df.get("appearances_total", 0) > 0,
                                    df.get("team_lost_total", np.nan) / df.get("appearances_total"), np.nan)

    # Per-90s
    per90_targets = {
        "shots_per90": "shots_total_total",
        "sot_per90": "shots_on_target_total",
        "key_passes_per90": "key_passes_total",
        "dribbles_per90": "dribble_attempts_total",
        "succ_dribbles_per90": "successful_dribbles_total",
        "tackles_per90": "tackles_total",
        "interceptions_per90": "interceptions_total",
        "clearances_per90": "clearances_total",
        "aerials_won_per90": "aerials_won_total",
        "duels_won_per90": "duels_won_total",
        "duels_total_per90": "total_duels_total",
        "fouls_drawn_per90": "fouls_drawn_total",
        "fouls_per90": "fouls_total",
        "crosses_per90": "total_crosses_total",
        "accurate_crosses_per90": "accurate_crosses_total",
        "long_balls_per90": "long_balls_total",
        "long_balls_won_per90": "long_balls_won_total",
        "offsides_per90": "offsides_total",
        "goals_per90": "goals_total",
        "assists_per90": "assists_total",
        "goal_involvements_per90": None,  # special: goals + assists
        "dispossessed_per90": "dispossessed_total",
        "saves_per90": "saves_total",
        "saves_inbox_per90": "saves_insidebox_total",
        "hit_woodwork_per90": "hit_woodwork_total",
        "big_chances_created_per90": "big_chances_created_total",
    }
    if mins_col:
        for out_col, base_col in per90_targets.items():
            if out_col == "goal_involvements_per90":
                df[out_col] = per90(df.get("goals_total", 0).fillna(0) + df.get("assists_total", 0).fillna(0),
                                    df[mins_col])
            else:
                df[out_col] = per90(df.get(base_col, 0), df[mins_col]) if base_col in df.columns else np.nan
    else:
        for out_col in per90_targets.keys():
            df[out_col] = np.nan

    # GK-specific
    df["save_pct"] = np.where((df.get("saves_total", 0).fillna(0) + df.get("goals_conceded_total", 0).fillna(0)) > 0,
                              df.get("saves_total", np.nan) /
                              (df.get("saves_total", 0).fillna(0) + df.get("goals_conceded_total", 0).fillna(0)),
                              np.nan)

    # Composite indices
    df["defending_efficiency_index"] = df[["tackles_per90", "interceptions_per90", "clearances_per90"]].sum(axis=1, min_count=1)
    df["progression_index"] = (df.get("key_passes_per90", 0).fillna(0) +
                               df.get("accurate_crosses_per90", 0).fillna(0) +
                               df.get("long_balls_won_per90", 0).fillna(0))
    df["danger_creation_index"] = (df.get("sot_per90", 0).fillna(0) +
                                   df.get("big_chances_created_per90", 0).fillna(0) +
                                   df.get("succ_dribbles_per90", 0).fillna(0))
    df["wing_threat_index"] = df.get("crosses_per90", 0) * df.get("cross_accuracy", 0)

    return df


def export_tier_role_tables(df: pd.DataFrame, outdir: Path) -> None:
    """Create and export CSVs per (tier × role)."""
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    # Identity columns to keep first (included if present)
    id_cols = [c for c in [
        "player_name", "position", "role", "stats_team", "season",
        "minutes_played_total", "appearances_total", "lineups_total"
    ] if c in df.columns]

    # Tier definitions
    tiers: Dict[str, Dict[str, List[str]]] = {
        "Beginner": {
            "GK": id_cols + ["cleansheets_total","goals_conceded_total","saves_total","rating_average","average_points_per_game_average"],
            "DEF": id_cols + ["cleansheets_total","goals_total","assists_total","yellowcards_total","rating_average"],
            "MID": id_cols + ["goals_total","assists_total","yellowcards_total","rating_average"],
            "FWD": id_cols + ["goals_total","assists_total","yellowcards_total","rating_average"],
        },
        "Intermediate": {
            "GK": id_cols + ["saves_per90","save_pct","clean_sheet_rate","rating_average"],
            "DEF": id_cols + ["tackles_per90","interceptions_per90","clearances_per90","aerials_won_per90","duels_win_rate","accurate_passes_percentage_total"],
            "MID": id_cols + ["key_passes_per90","accurate_passes_percentage_total","long_ball_accuracy","dribble_success_rate","fouls_drawn_per90"],
            "FWD": id_cols + ["shots_per90","sot_per90","sot_pct","dribble_success_rate","big_chances_created_per90","offsides_per90"],
        },
        "Expert": {
            "GK": id_cols + ["saves_inbox_per90","save_pct","average_points_per_game_average","starter_prob","sub_in_rate","team_win_rate","team_loss_rate"],
            "DEF": id_cols + ["defending_efficiency_index","duels_win_rate","clean_sheet_rate","progression_index","wing_threat_index","starter_prob","sub_in_rate"],
            "MID": id_cols + ["goal_involvements_per90","progression_index","dribble_success_rate","dispossessed_per90","starter_prob","sub_in_rate"],
            "FWD": id_cols + ["goal_involvements_per90","sot_pct","danger_creation_index","offsides_per90","hit_woodwork_per90","starter_prob","sub_in_rate"],
        }
    }

    # Sorting keys per tier/role
    sort_keys = {
        ("Beginner","GK"): ["cleansheets_total","saves_total","rating_average"],
        ("Beginner","DEF"): ["goals_total","assists_total","rating_average"],
        ("Beginner","MID"): ["goals_total","assists_total","rating_average"],
        ("Beginner","FWD"): ["goals_total","assists_total","rating_average"],

        ("Intermediate","GK"): ["save_pct","saves_per90"],
        ("Intermediate","DEF"): ["duels_win_rate","defending_efficiency_index","tackles_per90"],
        ("Intermediate","MID"): ["key_passes_per90","dribble_success_rate"],
        ("Intermediate","FWD"): ["shots_per90","sot_pct"],

        ("Expert","GK"): ["average_points_per_game_average","save_pct","saves_inbox_per90"],
        ("Expert","DEF"): ["defending_efficiency_index","wing_threat_index","clean_sheet_rate"],
        ("Expert","MID"): ["goal_involvements_per90","progression_index"],
        ("Expert","FWD"): ["goal_involvements_per90","danger_creation_index","sot_pct"],
    }

    # Export
    for tier_name, roles in tiers.items():
        for role_name, cols in roles.items():
            cols_present = [c for c in cols if c in df.columns]  # guard missing
            subset = df[df["role"] == role_name][cols_present].copy()

            # Round numeric
            num_cols = subset.select_dtypes(include=[np.number]).columns
            subset[num_cols] = subset[num_cols].round(3)

            # Sort
            key = sort_keys.get((tier_name, role_name), [])
            valid_sort = [k for k in key if k in subset.columns]
            if valid_sort:
                subset = subset.sort_values(valid_sort, ascending=False, na_position="last")

            # Save
            path = outdir / f"{tier_name.lower()}_{role_name.lower()}_lineup_features.csv"
            subset.to_csv(path, index=False)
            print(f"Wrote: {path}")

# --- Firestore upload for player statistics features ---
def upload_player_statistics_to_firestore(df: pd.DataFrame, base_dir: str):
    """
    Stores player statistics features in Firestore under 'players_current_statistics'.
    Each document is player_name, with keys: beginner, intermediate, expert, each containing role features.
    """
    import os
    from google.cloud import firestore
    firestore_db = os.environ.get('FIRESTORE_DB_NAME', 'fantacopilot-db')
    firestore_project = os.environ.get('FIRESTORE_PROJECT', 'fantacalcio-project')
    db = firestore.Client(project=firestore_project, database=firestore_db)
    print(f"Using Firestore database: {firestore_db}, project: {firestore_project}")

    # Group features by player_name
    tiers = ['Beginner', 'Intermediate', 'Expert']
    roles = ['GK', 'DEF', 'MID', 'FWD']
    id_cols = [c for c in ["player_name", "position", "stats_team", "season",
        "minutes_played_total", "appearances_total", "lineups_total"] if c in df.columns]

    # Prepare batch
    batch = db.batch()
    from tqdm import tqdm
    grouped = df.groupby("player_name")
    non_numeric = set(["player_name", "position", "stats_team", "season"])
    numeric_id_cols = set(["minutes_played_total", "appearances_total", "lineups_total"])
    for player_name, player_df in tqdm(grouped, desc="Uploading player statistics"):
        doc_ref = db.collection('players_current_statistics').document(str(player_name))
        doc_data = {}
        # Add id_cols as top-level fields (take first non-null value for each)
        for col in id_cols:
            val = player_df[col].dropna().iloc[0] if col in player_df.columns and not player_df[col].dropna().empty else None
            if col in numeric_id_cols:
                if pd.isnull(val) or val is None:
                    doc_data[col] = 0
                else:
                    doc_data[col] = val
            else:
                doc_data[col] = val
        # Get the player's single role
        player_role = player_df['role'].dropna().iloc[0] if 'role' in player_df.columns and not player_df['role'].dropna().empty else None
        # Add each expertise group as a flat dict (for the player's role only)
        for tier in tiers:
            if tier == 'Beginner':
                feature_cols = [
                    "cleansheets_total","goals_conceded_total","saves_total","rating_average","average_points_per_game_average",
                    "goals_total","assists_total","yellowcards_total"
                ]
            elif tier == 'Intermediate':
                feature_cols = [
                    "saves_per90","save_pct","clean_sheet_rate","rating_average",
                    "tackles_per90","interceptions_per90","clearances_per90","aerials_won_per90","duels_win_rate","accurate_passes_percentage_total",
                    "key_passes_per90","long_ball_accuracy","dribble_success_rate","fouls_drawn_per90",
                    "shots_per90","sot_per90","sot_pct","big_chances_created_per90","offsides_per90"
                ]
            else:  # Expert
                feature_cols = [
                    "saves_inbox_per90","save_pct","average_points_per_game_average","starter_prob","sub_in_rate","team_win_rate","team_loss_rate",
                    "defending_efficiency_index","duels_win_rate","clean_sheet_rate","progression_index","wing_threat_index",
                    "goal_involvements_per90","danger_creation_index","dispossessed_per90","sot_pct","hit_woodwork_per90"
                ]
            # Only keep columns present in player_df and not in id_cols
            cols_present = [c for c in feature_cols if c in player_df.columns and c not in id_cols]
            role_df = player_df[player_df["role"] == player_role][cols_present].copy()
            tier_features = {}
            if not role_df.empty:
                for k, v in role_df.iloc[0].items():
                    if k not in non_numeric:
                        # Fill NaN/null/None with 0 for numeric features
                        if pd.isnull(v) or v is None:
                            tier_features[k] = 0
                        else:
                            tier_features[k] = v
                    else:
                        tier_features[k] = v
            if tier_features:
                doc_data[tier.lower()] = tier_features
        if doc_data:
            batch.set(doc_ref, doc_data, merge=False)
    batch.commit()
    print(f"Uploaded {len(grouped)} player docs to 'players_current_statistics' collection.")

def main():
    base_dir = '/Users/moltisantid/Personal/fantacalcio'
    stat_files = glob.glob(os.path.join(base_dir, 'updated_current_player_statistics_*.csv'))
    if not stat_files:
        raise FileNotFoundError('No updated_current_player_statistics_*.csv files found!')

    latest_file = max(stat_files, key=os.path.getmtime)

    df = pd.read_csv(latest_file, sep=",", engine="python")
    df.columns = [to_snake(c) for c in df.columns]

    # Clean string fields if present
    for c in ["player_name","stats_team","current_team","position","season"]:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip()

    # Coerce numerics
    text_cols = ["player_name","birthday","stats_team","current_team","position","season"]
    df = coerce_numeric(df, text_cols)

    # Map position to generalized role
    role_map = {"POR":"GK", "DIF":"DEF", "CEN":"MID", "ATT":"FWD"}
    df["role"] = df.get("position", "").map(role_map).fillna(df.get("position", ""))

    # Engineer features
    df = add_engineered_features(df)

    # Export tier/role tables
    out_file = latest_file.replace('.csv', '_with_features.csv')
    df.to_csv(out_file, index=False)

    outdir = base_dir + '/data/lineup/'
    export_tier_role_tables(df, outdir)
    # Upload to Firestore
    upload_player_statistics_to_firestore(df, base_dir)

if __name__ == "__main__":
    main()
