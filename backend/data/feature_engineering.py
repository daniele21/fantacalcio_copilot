import numpy as np
import pandas as pd
from scipy.stats import zscore
from typing import List, Dict
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

# ===============================
# 1.  Helper functions
# ===============================
def round_credit(x):
    frac = x - int(x)
    return int(x) + (1 if frac > 0.5 else 0)

def compute_initial_quotations(
    df: pd.DataFrame,
    min_credit: float = 5,
    max_credit: float = 40,
    age_bonus: bool = True,
    weights_combo: dict = None
) -> pd.DataFrame:
    """
    Calcola le quotazioni iniziali per fantacalcio dando maggiore peso a bonus/malus,
    mantenendo comunque un contributo da performance di ruolo e rating.

    Parametri:
    - df: DataFrame con feature raw e colonne 'role' ('FW','MF','DF','GK'), 'birthday', 'Rating_average'.
    - min_credit, max_credit: range crediti.
    - age_bonus: applica correttore età.
    - weights_combo: dizionario con pesi per 'core', 'bonus', 'rating' (default {'core':0.2,'bonus':0.7,'rating':0.1}).

    Ritorna il DataFrame con nuova colonna 'Quotazione'.
    """
    df = df.copy()
    # 1) Calcolo età
    df['years_old'] = ((pd.Timestamp.now() - pd.to_datetime(df['birthday'], errors='coerce')).dt.days // 365).fillna(0)

    # 2) Assumiamo feature per-90 e rate già presenti

    # 3) Normalizzazione per ruolo
    metrics = {
        'FW': ['goals_per_90', 'assists_per_90', 'big_chances_created_per_90', 'conversion_rate'],
        'MF': ['key_passes_per_90', 'assists_per_90', 'dribble_success_rate', 'cross_accuracy'],
        'DF': ['def_actions_per_90', 'clearances_per_90', 'aerials_won_per_90', 'clean_sheet_rate'],
        'GK': ['saves_per_90', 'save_success_rate', 'pen_save_rate', 'clean_sheet_rate'],
    }
    scaler = MinMaxScaler()
    for role, cols in metrics.items():
        mask = df['position'] == role
        if mask.any():
            df.loc[mask, cols] = scaler.fit_transform(df.loc[mask, cols])

    # 4) Pesi e raw_score per performance di ruolo
    weights_role = {
        'ATT': {'goals_per_90':0.35, 'assists_per_90':0.20, 'big_chances_created_per_90':0.15, 'conversion_rate':0.30},
        'CEN': {'key_passes_per_90':0.30, 'assists_per_90':0.25, 'dribble_success_rate':0.20, 'cross_accuracy':0.25},
        'DIF': {'def_actions_per_90':0.30, 'clearances_per_90':0.25, 'aerials_won_per_90':0.20, 'clean_sheet_rate':0.25},
        'POR': {'saves_per_90':0.40, 'save_success_rate':0.30, 'pen_save_rate':0.15, 'clean_sheet_rate':0.15},
    }
    def score_role(row):
        w = weights_role[row['position']] if row['position'] in weights_role else {}
        return sum(row[m] * w[m] for m in w)
    df['raw_score'] = df.apply(score_role, axis=1)

    # 5) Calcolo bonus/malus potential
    df['bonus_potential'] = (
        df['Goals_total'] * 3 +
        df['Assists_total'] * 1 +
        df['Penalties_scored'] * 3 -
        df['Penalties_missed'] * 2 -
        df['cards_per_90'] * 1
    )
    # Normalizzazione bonus e rating
    bonus_scaler = MinMaxScaler()
    df['bonus_norm'] = bonus_scaler.fit_transform(df[['bonus_potential']])
    rating_scaler = MinMaxScaler()
    df['rating_norm'] = rating_scaler.fit_transform(df[['Rating_average']].fillna(df['Rating_average'].mean()))

    # 6) Fusione punteggi con peso maggiore al bonus
    # Default: core 20%, bonus 70%, rating 10%
    if weights_combo is None:
        weights_combo = {'core':0.1, 'bonus':0.4, 'rating':0.5}
    df['combined_score'] = (
        df['raw_score'] * weights_combo['core'] +
        df['bonus_norm'] * weights_combo['bonus'] +
        df['rating_norm'] * weights_combo['rating']
    )

    # 7) Scala al range crediti
    df['crediti'] = df['combined_score'] * (max_credit - min_credit) + min_credit

    # 8) Arrotondamento e correttore età
    df['Quotazione'] = df['crediti'].apply(round_credit)
    if age_bonus:
        df['Quotazione'] += df['years_old'].apply(lambda y: +1 if y <= 24 else (-1 if y >= 32 else 0))
        df['Quotazione'] = df['Quotazione'].apply(round_credit)

    return df


def per_90(series: pd.Series, minutes: pd.Series) -> pd.Series:
    """Return statistic scaled per 90 minutes (safe divide)."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return series.div(minutes.replace(0, np.nan)).mul(90).fillna(0)


def safe_div(num, den):
    """Safe division that returns 0 where denominator is 0. Handles both scalars and Series."""
    if isinstance(num, (int, float, np.integer, np.floating)) and isinstance(den, (int, float, np.integer, np.floating)):
        return num / den if den != 0 else 0
    else:
        return pd.Series(num).div(pd.Series(den).replace(0, np.nan)).fillna(0) if not isinstance(num, pd.Series) else num.div(pd.Series(den).replace(0, np.nan)).fillna(0)


def percentile_rank(series: pd.Series) -> pd.Series:
    return series.rank(pct=True)


def classify_value(p: float) -> str:
    if p >= 0.8:
        return "Very High"
    if p >= 0.6:
        return "High"
    if p >= 0.4:
        return "Medium"
    if p >= 0.2:
        return "Low"
    return "Very Low"


# def map_stars(p: float) -> int:
#     return 5 if p >= 0.9 else 4 if p >= 0.75 else 3 if p >= 0.55 else 2 if p >= 0.30 else 1


def role_coeff(role: str) -> float:
    return {"ATT": 1.40, "CEN": 1.10, "DIF": 0.80, "POR": 0.70}.get(role, 1.0)

# ----------------------------------------------------------
# 2. Badge rules
# ----------------------------------------------------------

def tag_rules(row: pd.Series) -> List[str]:
    tags: List[str] = []

    # Qualità & presenza
    # if row["performance_percentile"] >= 0.80:
    #     tags.append("Fuoriclasse")
    if row["starting_rate"] >= 0.75 and row["minutes_share"] >= 0.75:
        tags.append("Titolare")

    # Offensivi
    if row["goals_per_90"] >= 0.45:
        tags.append("Bomber")
    if row["conversion_rate"] >= 0.3:
        tags.append("Rifinitore")
    if (
        row["assists_per_90"] >= 0.4
        or row["key_passes_per_90"] >= 3
        # or row["big_chances_created_per_90"] >= 0.8
    ):
        tags.append("Playmaker")
        
    # if row.get("Hit Woodwork_total", 0) >= 3:
    #     tags.append("Woodwork Magnet")

    # Cross & set‑pieces
    if row["accurate_crosses_per_90"] >= 2.5 and row["cross_accuracy"] >= 0.35:
        tags.append("Cross Master")
    if row["crosses_per_90"] >= 3 or row["big_chances_created_per_90"] >= 0.3:
        tags.append("Piazzati")

    # Fisico / duelli
    if row["aerial_duels_win_rate"] >= 0.65 and row["aerials_won_per_90"] >= 3:
        tags.append("Dominio Aereo")
    if row["duels_won_rate"] >= 0.65 or row.get("Total Duels_total", 0) >= 300:
        tags.append("Fisico")

    # Difesa
    if row["def_actions_per_90_rank"] >= 0.80 and row["position"] == "DIF":
        tags.append("Wall")
    # if row["blocked_shots_per_90"] >= 0.5:
    #     tags.append("Ball-Stopper")
    if row["clearances_per_90"] >= 5:
        tags.append("Pulitore D'area")

    # Disciplina / falli
    if row["cards_per_90"] >= 0.3:
        tags.append("Cartellino Facile")
    if row["fouls_drawn_per_90"] >= 3:
        tags.append("Falloso")

    # Affidabilità
    if row["injury_risk_band"] in ('Mid', 'High'):
        tags.append("Fragile")

    # Panchinari impattanti
    if row["bench_rate"] >= 0.75 and (row["goals_per_90"] >= 0.2 or row["assists_per_90"] >= 0.2):
        tags.append("Super Panchinaro")

    # Specialità
    # if row.get("Captain_total", 0) >= 10:
    #     tags.append("Captain")
    if row.get("Hattricks_total", 0) >= 2:
        tags.append("Goal Testa")
    if (
        row.get("Penalties_scored", 0) >= 2
        and safe_div(int(row.get("Goals_penalties", 0)), max(row["Goals_total"], 1)) >= 0.3
    ):
        tags.append("Rigorista")

    # Portieri
    if row.get("Penalties_saved", 0) >= 2 or row["pen_save_rate"] >= 0.30:
        tags.append("Pararigori")
    if row["saves_per_90"] >= 3.5 and row["save_success_rate"] >= 0.75:
        tags.append("Paratutto")

    return tags[:4]

# ===============================
# 3. Main pipeline
# ===============================

def preprocessing(df: pd.DataFrame) -> pd.DataFrame:
    df['season'] = df['season'].fillna(2526).astype(int)
    df = df[df['season'] >= 2425].copy()  # Fix SettingWithCopyWarning
    fillna_cols = df.drop(columns=["player_name", "position","position_id",
                                   'birthday', 'season_id',
                                   'season', 'current_team', 'current_team_id',
                                   'stats_team', 'stats_team_id']).columns.tolist()
    df[fillna_cols] = df[fillna_cols].fillna(0)
    return df
    

def add_fantacopilot_features(df: pd.DataFrame, 
                              league_budget: int = 500,
                              num_teams: int = 8,
                              quota_tit: dict = {'ATT': 3, 'CEN': 4, 'DIF': 3, 'POR': 1},
                              role_budget_weight: dict = {'ATT': .40, 'CEN': .31, 'DIF': .21, 'POR': .08},
                              
                              ) -> pd.DataFrame:
    """Arricchisce `df` con tutte le feature utili alle *player‑cards*.

    Parameters
    ----------
    df : DataFrame
        Dataset grezzo con statistiche stagionali:
        - 'Accurate Crosses_total', 'Accurate Passes Percentage_total',
            'Accurate Passes_total', 'Aerials Won_total', 'Appearances_total',
            'Assists_total', 'Average Points Per Game_average', 'Bench_total',
            'Big Chances Created_total', 'Big Chances Missed_total',
            'Blocked Shots_total', 'Captain_total', 'Cleansheets_away',
            'Cleansheets_home', 'Cleansheets_total', 'Clearances_total',
            'Crosses Blocked_crosses_blocked', 'Dispossessed_total',
            'Dribble Attempts_total', 'Dribbled Past_total', 'Duels Won_total',
            'Fouls Drawn_total', 'Fouls_total', 'Goals Conceded_total',
            'Goals_goals', 'Goals_penalties', 'Goals_total', 'Hit Woodwork_total',
            'Injuries_total', 'Interceptions_total', 'Key Passes_total',
            'Lineups_total', 'Long Balls Won_total', 'Long Balls_total',
            'Minutes Played_total', 'Offsides_total', 'Passes_total',
            'Penalties_committed', 'Penalties_missed', 'Penalties_saved',
            'Penalties_scored', 'Penalties_total', 'Penalties_won',
            'Rating_average', 'Rating_highest', 'Rating_lowest',
            'Shots Blocked_total', 'Shots Off Target_total',
            'Shots On Target_total', 'Shots Total_total', 'Substitutions_in',
            'Substitutions_out', 'Successful Dribbles_total', 'Tackles_total',
            'Team Draws_total', 'Team Lost_total', 'Team Wins_total',
            'Through Balls Won_total', 'Through Balls_total', 'Total Crosses_total',
            'Total Duels_total', 'Yellowcards_away', 'Yellowcards_home',
            'Yellowcards_total', 'Yellowred Cards_away', 'Yellowred Cards_home',
            'Yellowred Cards_total', 'Error Lead To Goal_total',
            'Saves Insidebox_total', 'Saves_total', 'Redcards_away',
            'Redcards_home', 'Redcards_total', 'Own Goals_total',
            'Hattricks_average', 'Hattricks_total'
        
    league_budget : int, default 500
        Budget di lega di riferimento (cred). Usato per scalare i prezzi.
    """

    df = df.copy()
    df = preprocessing(df)
    
    # Years old
    df["birthday"] = pd.to_datetime(df["birthday"], errors="coerce")
    df["years_old"] = (pd.Timestamp.now() - df["birthday"]).dt.days // 365
    
    # ------------------------------------------------------------------
    # Base per‑90 / percent rates
    # ------------------------------------------------------------------
    df['titolarita'] = 100 * df['Appearances_total'] / 38
    
    df['Accurate Passes Percentage_total'] = df['Accurate Passes Percentage_total']/100
    
    df["goals_per_90"] = per_90(df["Goals_total"], df["Minutes Played_total"])
    df["assists_per_90"] = per_90(df["Assists_total"], df["Minutes Played_total"])
    df["big_chances_created_per_90"] = per_90(df["Big Chances Created_total"], df["Minutes Played_total"])
    df["conversion_rate"] = safe_div(df["Goals_total"], df["Shots Total_total"])

    df["key_passes_per_90"] = per_90(df["Key Passes_total"], df["Minutes Played_total"])
    df["crosses_per_90"] = per_90(df["Total Crosses_total"], df["Minutes Played_total"])
    df["accurate_crosses_per_90"] = per_90(df["Accurate Crosses_total"], df["Minutes Played_total"])
    df["cross_accuracy"] = safe_div(df["Accurate Crosses_total"], df["Total Crosses_total"])

    df["dribble_success_rate"] = safe_div(df["Successful Dribbles_total"], df["Dribble Attempts_total"])
    df["aerial_duels_win_rate"] = safe_div(df["Aerials Won_total"], df["Total Duels_total"])
    df["aerials_won_per_90"] = per_90(df["Aerials Won_total"], df["Minutes Played_total"])
    df["duels_won_rate"] = safe_div(df["Duels Won_total"], df["Total Duels_total"])

    df["blocked_shots_per_90"] = per_90(df["Shots Blocked_total"], df["Minutes Played_total"])
    df["clearances_per_90"] = per_90(df["Clearances_total"], df["Minutes Played_total"])

    df["def_actions"] = (
        df["Clearances_total"] + df["Interceptions_total"] + df["Shots Blocked_total"]
    )
    df["def_actions_per_90"] = per_90(df["def_actions"], df["Minutes Played_total"])
    df["tackle_success_rate"] = safe_div(df["Tackles_total"], df["Total Duels_total"])
    df["clean_sheet_rate"] = safe_div(df["Cleansheets_total"], df["Appearances_total"])
    df["goals_conceded_per_90"] = per_90(df["Goals Conceded_total"], df["Minutes Played_total"])

    df["cards_total"] = df[["Yellowcards_total", "Redcards_total", "Yellowred Cards_total"]].fillna(0).sum(axis=1)
    df["cards_per_90"] = per_90(df["cards_total"], df["Minutes Played_total"])
    df["fouls_drawn_per_90"] = per_90(df["Fouls Drawn_total"], df["Minutes Played_total"])

    df["starting_rate"] = safe_div(df["Lineups_total"], df["Appearances_total"])
    df["minutes_share"] = safe_div(df["Minutes Played_total"], df["Appearances_total"] * 90)
    df["bench_rate"] = safe_div(df["Bench_total"], df["Appearances_total"])
    df["injury_risk"] = safe_div(df["Injuries_total"], df["Appearances_total"]).mul(10)
    df["injury_risk_band"] = pd.cut(df["injury_risk"], bins=[-float('inf'), 1, 2, float('inf')], labels=["Low", "Mid", "High"])
    
    df['penalty_success_rate'] = safe_div(df['Penalties_scored'], df['Penalties_total'])

    # Goalkeeper metrics
    df["saves_per_90"] = per_90(df["Saves_total"], df["Minutes Played_total"])
    df["save_success_rate"] = safe_div(df["Saves_total"], df["Shots On Target_total"])
    df["pen_save_rate"] = safe_div(df["Penalties_saved"], df["Penalties_total"])
    df["def_actions_per_90_rank"] = df["def_actions_per_90"].rank(pct=True)

    # Volatility
    if "Rating_average" in df.columns:
        df["rating_std"] = df.groupby("player_name")["Rating_average"].transform("std")
        df["volatility_index"] = safe_div(df["rating_std"], df["Rating_average"])

    # ------------------------------------------------------------------
    # Composite score & ranks
    # ------------------------------------------------------------------
    # ALL_METRICS = [
    #     "goals_per_90", "assists_per_90", "big_chances_created_per_90",
    #     "key_passes_per_90", "crosses_per_90", "def_actions_per_90",
    #     "clean_sheet_rate", "tackle_success_rate", "starting_rate",
    #     "save_success_rate", "saves_per_90", "aerial_duels_win_rate"
    # ]

    # for m in ALL_METRICS:
    #     df[f"{m}_z"] = zscore(df[m].fillna(0))

    # 2.  Mappatura ruolo → metriche rilevanti
    # Compute z-scores for all relevant metrics
    METRIC_LIST = set()
    for metrics in [
        {
            "goals_per_90": 0.25,
            "assists_per_90": 0.15,
            "big_chances_created_per_90": 0.10,
            "key_passes_per_90": 0.10,
            "crosses_per_90": 0.05,
            "starting_rate": 0.10,
            "minutes_share": 0.10,
            "conversion_rate": 0.10,
            "dribble_success_rate": 0.05,
            "Rating_average": 0.3,
            "injury_risk": 0.05,
            "titolarita": 0.1
        },
        {
            "goals_per_90": 0.15,
            "assists_per_90": 0.15,
            "key_passes_per_90": 0.15,
            "def_actions_per_90": 0.10,
            "tackle_success_rate": 0.10,
            "starting_rate": 0.10,
            "minutes_share": 0.10,
            "conversion_rate": 0.10,
            "dribble_success_rate": 0.05,
            "Rating_average": 0.3,
            "injury_risk": 0.05,
            "titolarita": 0.1
        },
        {
            "def_actions_per_90": 0.20,
            "clean_sheet_rate": 0.15,
            "tackle_success_rate": 0.15,
            "aerial_duels_win_rate": 0.10,
            "goals_per_90": 0.10,
            "starting_rate": 0.10,
            "crosses_per_90": 0.10,
            "assists_per_90": 0.05,
            "minutes_share": 0.05,
            "Rating_average": 0.3,
            "injury_risk": 0.05,
            "titolarita": 0.1
        },
        {
            "clean_sheet_rate": 0.20,
            "save_success_rate": 0.20,
            "saves_per_90": 0.15,
            "goals_conceded_per_90": 0.10,
            "pen_save_rate": 0.10,
            "starting_rate": 0.10,
            "cards_per_90": 0.05,
            "injury_risk": 0.05,
            "Rating_average": 0.3,
            "titolarita": 0.1
        }
    ]:
        METRIC_LIST.update(metrics.keys())
    for m in METRIC_LIST:
        df[f"{m}_z"] = zscore(df[m].fillna(0))
    # Scale all _z features to 0-1 range
    z_cols = [col for col in df.columns if col.endswith('_z')]
    scaler = MinMaxScaler()
    df[z_cols] = scaler.fit_transform(df[z_cols])

    PERF_METRICS = {
        "ATT": {  # Attaccanti
            "goals_per_90_z": 0.13,
            "assists_per_90_z": 0.07,
            "big_chances_created_per_90_z": 0.04,
            "key_passes_per_90_z": 0.04,
            "crosses_per_90_z": 0.02,
            "starting_rate_z": 0.22,
            "minutes_share_z": 0.18,
            "conversion_rate_z": 0.09,
            "dribble_success_rate_z": 0.02,
            "Rating_average_z": 0.13,
            "injury_risk_z": -0.1,
            "titolarita_z": 0.1
        },
        "CEN": {  # Centrocampisti
            "goals_per_90_z": 0.14,
            "assists_per_90_z": 0.10,
            "key_passes_per_90_z": 0.07,
            "def_actions_per_90_z": 0.05,
            "tackle_success_rate_z": 0.05,
            "starting_rate_z": 0.19,
            "minutes_share_z": 0.14,
            "conversion_rate_z": 0.05,
            "dribble_success_rate_z": 0.02,
            "Rating_average_z": 0.14,
            "injury_risk_z": -0.05,
            "titolarita_z": 0.1
        },
        "DIF": {  # Difensori
            "def_actions_per_90_z": 0.10,
            "clean_sheet_rate_z": 0.08,
            "tackle_success_rate_z": 0.08,
            "aerial_duels_win_rate_z": 0.05,
            "goals_per_90_z": 0.05,
            "starting_rate_z": 0.21,
            "crosses_per_90_z": 0.05,
            "assists_per_90_z": 0.03,
            "minutes_share_z": 0.15,
            "Rating_average_z": 0.15,
            "injury_risk_z": -0.05,
            "titolarita_z": 0.1
        },
        "POR": {  # Portieri
            "clean_sheet_rate_z": 0.09,
            "save_success_rate_z": 0.04,
            "saves_per_90_z": 0.06,
            "goals_conceded_per_90_z": 0.13,
            "pen_save_rate_z": 0.13,
            "starting_rate_z": 0.21,
            "minutes_share_z": 0.17,
            "cards_per_90_z": 0.02,
            "injury_risk_z": -0.02,
            "Rating_average_z": 0.17,
            "titolarita_z": 0.1
        },
    }
    
    # ------------------------------------------------------------------
    # Stars & Tags
    # ------------------------------------------------------------------
    # Compute performance percentiles for each role
    for role, metrics in PERF_METRICS.items():
        df[f"{role}_perf"] = df[list(metrics.keys())].apply(
            lambda x: sum(x[m] * w for m, w in metrics.items()), axis=1
        )
        df[f"{role}_perf"] = df[f"{role}_perf"].fillna(0)

    # Assign stars using 10 quantile bins and custom mapping
    # Create a column with the correct perf value for each player based on their role
    df["role_perf"] = df.apply(lambda row: row.get(f"{row['position']}_perf", 0), axis=1)
    bins = pd.qcut(df["role_perf"], 10, labels=False, duplicates='drop') + 1
    def star_map(bin):
        if bin in [1,2]: return 5
        if bin in [3,4]: return 4
        if bin in [5,6,7]: return 3
        if bin in [8,9]: return 2
        return 1
    # df["stars"] = bins.map(star_map)
    df["skills"] = df.apply(tag_rules, axis=1)


    # ------------------------------------------------------------------
    # Fantasy KPIs & xFP/90 (integrated)
    # ------------------------------------------------------------------
    # GOAL_POINTS = {'ATT': 3, 'CEN': 3.5, 'DIF': 4, 'POR': 6}
    GOAL_POINTS = {'ATT': 3, 'CEN': 3, 'DIF': 3, 'POR': 3}
    CS_POINTS = {'DIF': 1, 'POR': 1}
    MALUS_YELLOW = 0.5
    MALUS_RED = 1
    MALUS_GC = 1
    MALUS_OWN = 2
    ASSIST_POINTS = 1
    PEN_SAVE_POINTS = 3

    df['yellowcards_per_90'] = per_90(df['Yellowcards_total'], df['Minutes Played_total'])
    df['redcards_per_90'] = per_90(df['Redcards_total'], df['Minutes Played_total'])
    df['own_goals_per_90'] = per_90(df['Own Goals_total'], df['Minutes Played_total'])
    df['penalties_saved_per_90'] = per_90(df['Penalties_saved'], df['Minutes Played_total'])

    df['gol_bonus'] = df.apply(lambda row: (row['goals_per_90'] * GOAL_POINTS.get(row['position'], 3)), axis=1)
    df['assist_bonus'] = df['assists_per_90'] * ASSIST_POINTS + df['big_chances_created_per_90']
    df['clean_sheet_bonus'] = df.apply(lambda row: row['clean_sheet_rate'] * CS_POINTS.get(row['position'], 0) if row['position'] in CS_POINTS else 0, axis=1)
    
    df['malus_risk_raw'] = -(
        df['yellowcards_per_90'] * MALUS_YELLOW +
        df['redcards_per_90'] * MALUS_RED +
        df['own_goals_per_90'] * MALUS_OWN +
        df.apply(lambda row: row['goals_conceded_per_90'] * MALUS_GC if row['position'] in ['POR', 'DIF'] else 0, axis=1)
    )
    df['pen_save_bonus'] = df['pen_save_rate'] * PEN_SAVE_POINTS
    df['rating_bonus'] = (df['Rating_average'] - 6).clip(lower=0)
    
    def calc_xfp90(row):
        if row['position'] == 'POR':
            return row['rating_bonus'] + row['clean_sheet_bonus'] \
                + row['pen_save_bonus'] + row['malus_risk_raw']
        else:
            return (
                row['gol_bonus'] + row['assist_bonus']
                + row['malus_risk_raw'] + row['rating_bonus']
            )
    
    
    df['xfp_90'] = df.apply(calc_xfp90, axis=1)
    df["xfp_90_clipped"] = df["xfp_90"].clip(lower=0)
    df['xfp_per_game'] = df['xfp_90'] * df['minutes_share']

    for col in ['gol_bonus', 'assist_bonus', 'clean_sheet_bonus', 'titolarita', 'malus_risk_raw', 'xfp_90', 'xfp_per_game']:
        for role in df['position'].unique():
            mask = df['position'] == role
            df.loc[mask, f'{col}_pct'] = percentile_rank(df.loc[mask, col]) * 100

    df["availability"] = df["Appearances_total"].clip(upper=38) / 38

    # df["xfp_season"] = df["xfp_90"] * df["minutes_share"] * 38
    df["xfp_season"] = df["xfp_90_clipped"] * df["minutes_share"] * 38 * df['availability']


    # ----------------------------------------------------------------------
    # 2. Budget e valore per fantapunto nel singolo ruolo
    # ----------------------------------------------------------------------
    C_tot = league_budget * num_teams                      # crediti totali nella lega
    price_per_xfp = {}

    # for role, q in quota_tit.items():
    #     top_n = q * num_teams                              # titolari “teorici”
    #     top_players = (
    #         df[df["position"] == role]
    #         # .nlargest(top_n, "xfp_season", keep="all")
    #     )
    #     sum_xfp_role = top_players["xfp_season"].sum()

    #     # quota di budget destinata al ruolo (pesi storici / configurabili)
    #     budget_role = C_tot * role_budget_weight[role]

    #     # valore monetario di 1 fantapunto stagionale nel ruolo
    #     price_per_xfp[role] = (
    #         budget_role / sum_xfp_role if sum_xfp_role > 0 else 0
    #     )
    for role, q in quota_tit.items():
        mask = (df["position"] == role) & (df["Appearances_total"] >= 10)
        top_players = df.loc[mask].nlargest(q * num_teams, "xfp_season")
        sum_xfp_role = top_players["xfp_season"].sum()
        budget_role = C_tot * role_budget_weight[role]
        price_per_xfp[role] = (
            budget_role / sum_xfp_role if sum_xfp_role > 0 else 1
    )

    # ----------------------------------------------------------------------
    # 3. Prezzo atteso grezzo per ogni giocatore
    # ----------------------------------------------------------------------
    df["price_expected"] = df.apply(
        lambda r: r["xfp_season"] * price_per_xfp.get(r["position"], 0), axis=1
    )
    df["price_expected"] = df["price_expected"].round()
    df["price_expected"] = df["price_expected"].astype(int)
    df.loc[df["price_expected"] < 1, "price_expected"] = 1
    # ----------------------------------------------------------------------
    # 4. Coefficienti di aggiustamento: rischio & hype
    # ----------------------------------------------------------------------
    # • Rischio legato a infortuni + basso minutaggio  → max 15 %
    df["risk_coeff"] = np.clip(
        (df["injury_risk"] / 10) + (1 - df["minutes_share"]), 0, 0.15
    )

    # ----------------------------------------------------------------------
    # 5. Range d’asta FCP: −5 % “cuscinetto” +/− rischio/hype
    # ----------------------------------------------------------------------
    df["range_low"]  = (
        df["price_expected"] * (1 - 0.05)
    ).round().astype(int)

    df["range_high"] = (
        df["price_expected"] * (1 + 0.05)
    ).round().astype(int)



    # # add stars feature basing on price expected dividing in 5 ranges differencing by role
    # df['stars'] = df.groupby('position')['price_expected'].transform(
    #     lambda x: pd.qcut(x, 5, labels=[1,2,3,4,5])
    # )
    # df['stars'] = df['stars'].cat.add_categories([0]).fillna(0).astype(int)

    # # • Hype: stelle alte, nuovo top club, ecc. (qui semplificato) → max 20 %
    # df["hype_coeff"] = np.where(df["stars"] >= 4, 0.10, 0)   # 10 % solo per 4-5 stelle

    

    # ----------------------------------------------------------------------
    # 6. Pulizia finale: evita range negativi e colonne intermedie opzionali
    # ----------------------------------------------------------------------
    df["range_low"]  = df["range_low"].clip(lower=1)
    df["range_high"] = df[["range_high", "range_low"]].max(axis=1)

    # Export Excel file with each role as a separate sheet
    with pd.ExcelWriter("perf_metrics_by_role.xlsx") as writer:
        for role, metrics in PERF_METRICS.items():
            cols = ["player_name", "position"] + list(metrics.keys())
            df_role = df[df["position"] == role][cols].copy()
            # Add weights as a header row
            weights_row = ["WEIGHT", role] + [metrics[m] for m in metrics]
            df_role_with_weights = pd.concat([
                pd.DataFrame([weights_row], columns=cols),
                df_role
            ], ignore_index=True)
            df_role_with_weights.to_excel(writer, sheet_name=role, index=False)

    # Add stars feature: divide price_expected into 5 quantile-based bins per position, with robust label assignment
    def safe_qcut(x):
        try:
            qcut_result, bins = pd.qcut(x, 5, retbins=True, duplicates='drop')
            n_bins = len(bins) - 1
            if n_bins < 2:
                # Not enough unique values for even 2 bins
                return pd.Series([0]*len(x), index=x.index, dtype='int')
            labels = list(range(1, n_bins))  # labels must be one fewer than bin edges
            return pd.qcut(x, q=n_bins, labels=labels, duplicates='drop')
        except Exception:
            return pd.Series([0]*len(x), index=x.index, dtype='int')
    df['stars'] = df.groupby('position')['price_expected'].transform(safe_qcut)
    # Ensure 'stars' is categorical before using .cat, otherwise fallback to int
    if pd.api.types.is_categorical_dtype(df['stars']):
        df['stars'] = df['stars'].cat.add_categories([0]).fillna(0).astype(int)
    else:
        df['stars'] = df['stars'].fillna(0).astype(int)

    return df



if __name__ == "__main__":
    # Automatically select the latest player_statistics_*.csv file
    import glob
    import os
    base_dir = '/Users/moltisantid/Personal/fantacalcio'
    stat_files = glob.glob(os.path.join(base_dir, 'player_statistics_*.csv'))
    stat_files = [f for f in stat_files if '_with_features' not in f and '_with_target_price' not in f and '_with_target_price_and_predictions' not in f]
    if not stat_files:
        raise FileNotFoundError('No player_statistics_*.csv files found!')
    latest_file = max(stat_files, key=os.path.getmtime)
    print(f"Using latest statistics file: {latest_file}")
    statistics = pd.read_csv(latest_file)
    df_features = add_fantacopilot_features(statistics, league_budget=500)
    out_file = latest_file.replace('.csv', '_with_features.csv')
    df_features.to_csv(out_file, index=False)
    print(f"Features saved to: {out_file}")
    # final_quotes = compute_initial_quotations(df_features, min_credit=1, max_credit=50, age_bonus=True)
    # a = final_quotes[['player_name', 'position', 'Quotazione', 'raw_score', 'bonus_norm', 'rating_norm', 'crediti']]
    # df_features