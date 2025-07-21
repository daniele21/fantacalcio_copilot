import numpy as np
import pandas as pd
from scipy.stats import zscore
from typing import List

# ===============================
# 1.  Helper functions
# ===============================

def per_90(series: pd.Series, minutes: pd.Series) -> pd.Series:
    """Scala una metrica a valore per 90′, con gestione divisioni per zero."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return series.div(minutes.replace(0, np.nan)).mul(90).fillna(0)


# def classify_value(percentile: float) -> str:
#     if percentile >= 0.8:
#         return "Very High"
#     if percentile >= 0.6:
#         return "High"
#     if percentile >= 0.4:
#         return "Medium"
#     if percentile >= 0.2:
#         return "Low"
#     return "Very Low"


def map_stars(percentile: float) -> int:
    if percentile >= 0.9:
        return 5
    if percentile >= 0.75:
        return 4
    if percentile >= 0.55:
        return 3
    if percentile >= 0.30:
        return 2
    return 1


def role_coeff(role: str) -> float:
    mapping = {"ATT": 1.40, "CEN": 1.10, "DIF": 0.80, "POR": 0.70}
    return mapping.get(role, 1.0)


def tag_rules(row: pd.Series) -> List[str]:
    tags: List[str] = []
    if row["performance_percentile"] >= 0.80:
        tags.append("Fuoriclasse")
        
    if row["starting_rate"] >= 0.75 and row["minutes_share"] >= 0.75:
        tags.append("Titolare")
        
    if row["assists_per_90"] >= 0.25 or row["key_passes_per_90"] >= 2:
        tags.append("Assist‑Man")
        
    if row["goals_per_90"] >= 0.45:
        tags.append("Bomber")
        
    if row["def_actions_per_90_rank"] >= 0.80 and row["position"] == "DIF":
        tags.append("Muro Difensivo")
        
    # Nuova soglia: >=1 infortunio ogni 10 partite
    if row["injury_risk"] >= 1.0:
        tags.append("Fragile")
        
    if row.get("Penalties_scored", 0) >= 2 or (
        row.get("Goals_penalties", 0) / max(row["Goals_total"], 1) >= 0.30
    ):
        tags.append("Rigori")
        
    if row["crosses_per_90"] >= 3 or row["big_chances_created_per_90"] >= 0.3:
        tags.append("Piazzati")
        
    return tags[:4]


# ===============================
# 2.  Main pipeline
# ===============================

def add_fantacopilot_features(df: pd.DataFrame, league_budget: int = 500) -> pd.DataFrame:
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

    # ---------------------------
    # Core derived metrics
    # ---------------------------
    df["goals_per_90"] = per_90(df["Goals_total"], df["Minutes Played_total"])
    df["assists_per_90"] = per_90(df["Assists_total"], df["Minutes Played_total"])
    df["big_chances_created_per_90"] = per_90(
        df["Big Chances Created_total"], df["Minutes Played_total"]
    )
    df["conversion_rate"] = df["Goals_total"].div(df["Shots Total_total"].replace(0, np.nan)).fillna(0)

    # Coinvolgimento nel gioco
    df["key_passes_per_90"] = per_90(df["Key Passes_total"], df["Minutes Played_total"])
    df["crosses_per_90"] = per_90(df["Total Crosses_total"], df["Minutes Played_total"])
    df["dribble_success_rate"] = df["Successful Dribbles_total"].div(
        df["Dribble Attempts_total"].replace(0, np.nan)
    ).fillna(0)
    df["aerial_duels_win_rate"] = df["Aerials Won_total"].div(
        df["Total Duels_total"].replace(0, np.nan)
    ).fillna(0)

    # Difensivo
    df["def_actions"] = (
        df["Clearances_total"] + df["Interceptions_total"] + df["Shots Blocked_total"]
    )
    df["def_actions_per_90"] = per_90(df["def_actions"], df["Minutes Played_total"])
    df["tackle_success_rate"] = df["Tackles_total"].div(
        df["Total Duels_total"].replace(0, np.nan)
    ).fillna(0)
    df["clean_sheet_rate"] = df["Cleansheets_total"].div(
        df["Appearances_total"].replace(0, np.nan)
    ).fillna(0)
    df["goals_conceded_per_90"] = per_90(df["Goals Conceded_total"], df["Minutes Played_total"])

    # Affidabilità
    df["starting_rate"] = df["Lineups_total"].div(df["Appearances_total"].replace(0, np.nan)).fillna(0)
    df["minutes_share"] = df["Minutes Played_total"].div(
        (df["Appearances_total"] * 90).replace(0, np.nan)
    ).fillna(0)
    df["bench_rate"] = df["Bench_total"].div(df["Appearances_total"].replace(0, np.nan)).fillna(0)

    df["cards_total"] = (
        df[["Yellowcards_total", "Redcards_total", "Yellowred Cards_total"]]
        .fillna(0)
        .sum(axis=1)
    )
    # **Nuova definizione**: infortuni ogni 10 apparizioni
    df["injury_risk"] = df["Injuries_total"].div(df["Appearances_total"].replace(0, np.nan)).mul(10).fillna(0)

    # Volatilità rating se disponibile
    if "Rating_average" in df.columns:
        df["rating_std"] = df.groupby("player_name")["Rating_average"].transform("std")
        df["volatility_index"] = df["rating_std"].div(df["Rating_average"].replace(0, np.nan)).fillna(0)

    metrics = [
        "goals_per_90",
        "assists_per_90",
        "big_chances_created_per_90",
        "key_passes_per_90",
        "crosses_per_90",
        "def_actions_per_90",
        "clean_sheet_rate",
        "tackle_success_rate",
    ]

    for m in metrics:
        df[f"{m}_z"] = zscore(df[m].fillna(0))

    z_cols = [f"{m}_z" for m in metrics]
    df["performance_score"] = df[z_cols].mean(axis=1)
    df["performance_percentile"] = df["performance_score"].rank(pct=True)
    # df["value_category"] = df["performance_percentile"].apply(classify_value)
    df["def_actions_per_90_rank"] = df["def_actions_per_90"].rank(pct=True)

    # Stelle & Tag
    df["stars"] = df["performance_percentile"].apply(map_stars).astype(int)
    df["tags"] = df.apply(tag_rules, axis=1)

    # ---------------------------
    # Price estimation
    # ---------------------------
    max_injury = df["injury_risk"].max() or 1
    df["injury_scaled"] = 1 - df["injury_risk"].div(max_injury)
    df["role_coeff"] = df["position"].apply(role_coeff)

    df["price_base"] = (
        df["performance_percentile"] * 0.60
        + df["minutes_share"] * 0.25
        + df["injury_scaled"] * 0.15
    ) * df["role_coeff"]

    scale_factor = league_budget / df["price_base"].sum() * df.shape[0]
    df["price_estimate"] = df["price_base"] * scale_factor

    def pct_range(s: pd.Series) -> pd.Series:
        return pd.Series({"low": s.quantile(0.10), "high": s.quantile(0.90)})

    price_ranges = df.groupby("position")["price_estimate"].apply(pct_range).unstack()
    df = df.join(price_ranges, on="position", rsuffix="_role")
    df.rename(columns={"low": "price_low", "high": "price_high"}, inplace=True)

    price_cols = ["price_estimate", "price_low", "price_high"]
    df[price_cols] = df[price_cols].round(0).astype(int)

    percent_cols = [
        "performance_percentile",
        "conversion_rate",
        "dribble_success_rate",
        "aerial_duels_win_rate",
        "tackle_success_rate",
        "clean_sheet_rate",
    ]
    df[percent_cols] = df[percent_cols].mul(100).round(1)

    return df

if __name__ == "__main__":
    statistics = pd.read_csv('/Users/moltisantid/Personal/fantacalcio/player_statistics_2025-07-21_10-07-09.csv')
    df_features = add_fantacopilot_features(statistics, league_budget=500)
    df_features