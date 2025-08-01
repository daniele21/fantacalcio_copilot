from typing import Dict, Union
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.discriminant_analysis import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import RepeatedKFold, train_test_split
from sklearn.pipeline import Pipeline
from tqdm import tqdm
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression, RidgeCV
import statsmodels.api as sm

def load_target_price():
    file_path_quote_2425 = "/Users/moltisantid/Personal/fantacalcio/data/quote_2425.csv"
    players_path = "/Users/moltisantid/Personal/fantacalcio/player_statistics_2025-07-21_15-02-25_with_features.csv"
    
    players = pd.read_csv(players_path)
    # players['season'] = players['season'].fillna(2526)
    players = players[players['season'] >= 2425].drop_duplicates()
    target_price = pd.read_csv(file_path_quote_2425, index_col=0, sep=";")
    
    old_teams = target_price["Squadra"].unique()
    for team in tqdm(old_teams):
        if players['current_team'].str.contains(team).any():
             df = players[players['current_team'] == team]
             quote_df = target_price[target_price["Squadra"] == team]
             for quote_player in quote_df['Nome'].unique():
                 # find the matching player with fuzzy matching
                 matching_players = df[df['player_name'].str.contains(quote_player.replace('.', ''), case=False, na=False)]
                 if not matching_players.empty:
                     players.loc[matching_players.index, 'QuotaTarget'] = quote_df[quote_df['Nome'] == quote_player]['QuotaAttuale'].values[0]
                     
    return players                     

def label_data():
    players = load_target_price()
    players.to_csv("player_statistics_2025-07-21_15-02-25_with_target_price.csv", index=False)

def feature_importance_analysis(df, target_col='QuotaTarget', n_estimators=200, random_state=42, plot=True):
    """
    Trains a RandomForestRegressor to predict QuotaTarget and returns feature importances.
    Optionally plots the importances.
    """
    # Drop rows with missing target
    df = df.dropna(subset=[target_col])
    # Select only numeric features (excluding the target)
    feature_cols = [col for col in df.columns if col not in [target_col, 'player_name', 'position', 'current_team', 'birthday'] and df[col].dtype in [float, int]]
    X = df[feature_cols].fillna(0)
    y = df[target_col]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=random_state)
    model = RandomForestRegressor(n_estimators=n_estimators, random_state=random_state)
    model.fit(X_train, y_train)
    importances = model.feature_importances_
    importance_df = pd.DataFrame({'feature': feature_cols, 'importance': importances})
    importance_df = importance_df.sort_values('importance', ascending=False)
    
    if plot:
        plt.figure(figsize=(10, min(12, len(feature_cols)//2)))
        plt.barh(importance_df['feature'][:25][::-1], importance_df['importance'][:25][::-1])
        plt.xlabel('Importance')
        plt.title('Top 25 Feature Importances for QuotaTarget')
        plt.tight_layout()
        plt.show()
    
    return importance_df

def feature_importance_by_position(df, position_col='position', target_col='QuotaTarget', n_estimators=200, random_state=42, plot=True):
    """
    Computes and prints feature importances for each unique position in the DataFrame.
    """
    positions = df[position_col].dropna().unique()
    results = {}
    for pos in positions:
        print(f"\n=== Feature Importance for position: {pos} ===")
        df_pos = df[df[position_col] == pos]
        if df_pos[target_col].notna().sum() < 10:
            print(f"Not enough data for position {pos} (n={df_pos.shape[0]})")
            continue
        importance_df = feature_importance_analysis(df_pos, target_col=target_col, n_estimators=n_estimators, random_state=random_state, plot=plot)
        print(importance_df.head(10))
        results[pos] = importance_df
    return results

def extract_role_coefficients(df, position_col='position', target_col='QuotaTarget', top_n=5):
    """
    For each position, fit a linear regression and print the top N features and their coefficients.
    Returns a dict: {position: [(feature, coef), ...]}
    """
    positions = df[position_col].dropna().unique()
    role_coefs = {}
    for pos in positions:
        df_pos = df[df[position_col] == pos].dropna(subset=[target_col])
        if df_pos.shape[0] < 10:
            print(f"Not enough data for position {pos} (n={df_pos.shape[0]})")
            continue
        feature_cols = [col for col in df_pos.columns if col not in [target_col, 'player_name', 'position', 'current_team', 'birthday'] and df_pos[col].dtype in [float, int]]
        X = df_pos[feature_cols].fillna(0)
        y = df_pos[target_col]
        model = LinearRegression()
        model.fit(X, y)
        coefs = pd.Series(model.coef_, index=feature_cols)
        top_features = coefs.abs().sort_values(ascending=False).head(top_n).index
        print(f"\n=== Top {top_n} coefficients for position: {pos} ===")
        for feat in top_features:
            print(f"{feat}: {coefs[feat]:.3f}")
        role_coefs[pos] = [(feat, coefs[feat]) for feat in top_features]
    return role_coefs

def extract_global_coefficients(df, target_col='QuotaTarget', top_n=10):
    """
    Fit a linear regression on the whole dataset and print the top N features and their coefficients.
    Returns a list of (feature, coef) tuples.
    """
    df = df.dropna(subset=[target_col])
    feature_cols = [col for col in df.columns if col not in [target_col, 'player_name', 'current_team', 'birthday'] and df[col].dtype in [float, int]]
    X = df[feature_cols].fillna(0)
    y = df[target_col]
    model = LinearRegression()
    model.fit(X, y)
    coefs = pd.Series(model.coef_, index=feature_cols)
    top_features = coefs.abs().sort_values(ascending=False).head(top_n).index
    print(f"\n=== Top {top_n} global coefficients ===")
    for feat in top_features:
        print(f"{feat}: {coefs[feat]:.3f}")
    return [(feat, coefs[feat]) for feat in top_features]

def extract_global_coefficients_with_pvalues(df, target_col='QuotaTarget', top_n=100):
    """
    Fit an OLS regression and print the top N features with their coefficients and p-values.
    Returns a DataFrame with feature, coef, and pvalue.
    """
    df = df.dropna(subset=[target_col])
    feature_cols = [col for col in df.columns if col not in [target_col, 'player_name', 'current_team', 'birthday'] and df[col].dtype in [float, int]]
    X = df[feature_cols].fillna(0)
    y = df[target_col]
    X = sm.add_constant(X)
    model = sm.OLS(y, X).fit()
    summary_df = pd.DataFrame({
        'feature': model.params.index,
        'coef': model.params.values,
        'pvalue': model.pvalues.values
    })
    summary_df = summary_df[summary_df['feature'] != 'const']
    summary_df['abs_coef'] = summary_df['coef'].abs()
    summary_df = summary_df.sort_values('abs_coef', ascending=False).head(top_n)
    print(f"\n=== Top {top_n} global coefficients with p-values ===")
    for _, row in summary_df.iterrows():
        print(f"{row['feature']}: coef={row['coef']:.3f}, p-value={row['pvalue']:.4f}")
    return summary_df[['feature', 'coef', 'pvalue']]

def _build_pipeline(feature_names, cv):
    """ColumnTransformer → StandardScaler → RidgeCV (α chosen by *cv*)."""
    numeric = Pipeline([
        ("scale", StandardScaler()),
    ])

    prep = ColumnTransformer([
        ("num", numeric, feature_names)
    ])

    ridge = RidgeCV(alphas=10.**np.linspace(-2, 2, 21), cv=cv)

    return Pipeline([
        ("prep", prep),
        ("reg",  ridge),
    ])


def train_price_models(df_raw: pd.DataFrame,
                       position_col: str = "position") -> Dict[str, Pipeline]:
    """
    Train one pipeline per position (GK/DF/MF/FW) **and**
    a global 'ALL' model.

    Returns
    -------
    dict   keys = position labels ('GK', 'DF', ... , 'ALL')
           values = fitted scikit‑learn Pipelines
    """

    target = np.log1p(df_raw["QuotaTarget"])
    base_cols = ["player_name", "current_team", "QuotaTarget", "birthday", "stats_team", position_col]
    # Only use numeric columns for features
    feature_cols = [col for col in df_raw.columns.difference(base_cols) if pd.api.types.is_numeric_dtype(df_raw[col])]

    cv = RepeatedKFold(n_splits=2, n_repeats=5, random_state=42)
    models: Dict[str, Pipeline] = {}
    # Fill missing values with 0 before fitting
    df_raw = df_raw.fillna(0)
    # Train global model --------------------------------------------------
    pipe_all = _build_pipeline(feature_cols, cv=cv)
    pipe_all.fit(df_raw[feature_cols], target)
    models["ALL"] = pipe_all
    # Train per‑position models ------------------------------------------
    for pos, d_pos in df_raw.groupby(position_col):
        if len(d_pos) < 30:                  # too few rows → skip
            continue
        y_pos = np.log1p(d_pos["QuotaTarget"])
        X_pos = d_pos[feature_cols]
        pipe_pos = _build_pipeline(feature_cols, cv)
        pipe_pos.fit(X_pos, y_pos)
        models[pos] = pipe_pos
    return models

def predict_price(row_or_df: Union[pd.Series, pd.DataFrame],
                  models: Dict[str, Pipeline],
                  position_col: str = "position") -> np.ndarray:
    """
    Predict prices for one or many rows using position‑specific
    model if available, otherwise fallback to global model.

    Parameters
    ----------
    row_or_df : Series or DataFrame (raw, *un‑engineered* columns)
    models    : dict returned by train_price_models()
    """
    if isinstance(row_or_df, pd.Series):
        df_raw = row_or_df.to_frame().T
    else:
        df_raw = row_or_df.copy()
    df_eng = df_raw.copy()
    feature_cols = models["ALL"].named_steps["prep"].transformers_[0][2]

    # Choose model row‑by‑row (vectorised)
    preds = []
    for _, row in df_raw.iterrows():
        pos = row.get(position_col, None)
        model = models.get(pos, models["ALL"])
        log_p = model.predict(df_eng.loc[row.name, feature_cols].values.reshape(1, -1))
        preds.append(float(np.expm1(log_p)[0]))
    return np.array(preds)


def extract_raw_linear_coeffs(pipe):
    """
    Parameters
    ----------
    pipe : sklearn Pipeline as built in price_model.py
           ('prep' -> ColumnTransformer -> StandardScaler,
            'reg'  -> RidgeCV)

    Returns
    -------
    intercept_raw : float
        Intercept in *raw feature space* (still on log‑price scale).
    coef_raw : dict[str, float]
        Mapping feature_name → raw‑unit coefficient.
        These multiply the *unscaled, un‑centred* feature values.
    """
    # --- locate pieces
    scaler  = pipe.named_steps["prep"].named_transformers_["num"].named_steps["scale"]
    ridge   = pipe.named_steps["reg"]
    feats   = pipe.named_steps["prep"].transformers_[0][2]   # same order!

    coef_scaled   = ridge.coef_          # β in standardised space
    intercept_scaled = ridge.intercept_  # α in standardised space
    mean_  = scaler.mean_
    scale_ = scaler.scale_

    # --- convert: β_raw = β_scaled / scale_
    #              α_raw = α_scaled - Σ(μ_i * β_scaled_i / scale_i)
    coef_raw = coef_scaled / scale_
    intercept_raw = intercept_scaled - np.dot(mean_, coef_raw)

    return intercept_raw, dict(zip(feats, coef_raw))


# ─────────────────────────────────────────────────────────────
# 2.  Build a *static* scorer that needs only NumPy / math
# ─────────────────────────────────────────────────────────────
def make_static_price_fn(pipe):
    """
    Returns a function  f(row_dict) -> price  (€ float)
    where *row_dict* supplies the ORIGINAL (un‑engineered) columns
    used during training.

    All heavy objects inside *pipe* are digested into plain numbers,
    so the returned function has **zero external dependencies**.
    """
    intercept_raw, coef_raw = extract_raw_linear_coeffs(pipe)

    # Keep a frozen copy of the coefficient dict for closure speed
    coef_items = tuple(coef_raw.items())

    def price_fn(row: dict) -> float:
        """row = {feature_name: value, …}  (original raw features)"""
        s = intercept_raw
        for feat, w in coef_items:
            s += row.get(feat, 0.0) * w     # missing → assume 0
        log_price = s                       # still log1p scale
        return np.expm1(log_price)          # back to € price

    return price_fn

if __name__ == "__main__":
    label_data()
    # feature_importance_analysis(pd.read_csv("player_statistics_2025-07-21_15-02-25_with_target_price.csv"))
    # feature_importance_by_position(pd.read_csv("player_statistics_2025-07-21_15-02-25_with_target_price.csv"))
    # extract_global_coefficients(pd.read_csv("player_statistics_2025-07-21_15-02-25_with_target_price.csv"))
    # extract_global_coefficients_with_pvalues(pd.read_csv("player_statistics_2025-07-21_15-02-25_with_target_price.csv"))
    df = pd.read_csv("player_statistics_2025-07-21_15-02-25_with_target_price.csv")
    df = df[df['QuotaTarget'].notna()]
    df = df[df['QuotaTarget'] > 0]
    
    models = train_price_models(df)
    price_fn = make_static_price_fn(models["ALL"])

    # Example: predict price for a single player (replace with actual feature values)
    for player_data in df.to_dict(orient='records'):
        # Fill missing values with 0 for all features
        for k, v in player_data.items():
            if pd.isna(v):
                player_data[k] = 0
        predicted_price = price_fn(player_data)
        print(f"Predicted price for {player_data['player_name']}: {predicted_price:.2f} €")
        # add a column for predicted prices
        df.loc[df['player_name'] == player_data['player_name'], 'predicted_price'] = predicted_price
        
    df.to_csv("player_statistics_2025-07-21_15-02-25_with_target_price_and_predictions.csv", index=False)
