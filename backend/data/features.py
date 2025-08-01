import pandas as pd
from scipy.stats import zscore

# Carica i dati da un file CSV/tab-delimited
# Sostituisci 'data.csv' con il percorso corretto
df = pd.read_csv('data.csv', sep='\t', parse_dates=['birthday'], dayfirst=True)

# Funzione per calcolare feature normalizzate per 90 minuti
def per_90(series, minutes):
    return series.div(minutes).mul(90)

# =========================
# CALCOLO FEATURE DERIVATE
# =========================
# 1. Rendimento offensivo
# Gol e assist per 90'
df['goals_per_90'] = per_90(df['Goals_total'], df['Minutes Played_total'])
df['assists_per_90'] = per_90(df['Assists_total'], df['Minutes Played_total'])
df['big_chances_created_per_90'] = per_90(df['Big Chances Created_total'], df['Minutes Played_total'])
df['conversion_rate'] = df['Goals_total'] / df['Shots Total_total']

# Placeholder per xG e xA
# df['xG_total'] = df.get('xG_total', pd.NA)
# df['xA_total'] = df.get('xA_total', pd.NA)
# df['xG_diff'] = df['Goals_total'] - df['xG_total']
# df['xA_diff'] = df['Assists_total'] - df['xA_total']

# 2. Coinvolgimento nel gioco
df['key_passes_per_90'] = per_90(df['Key Passes_total'], df['Minutes Played_total'])
df['crosses_per_90'] = per_90(df['Total Crosses_total'], df['Minutes Played_total'])
df['dribble_success_rate'] = df['Successful Dribbles_total'] / df['Dribble Attempts_total']
df['aerial_duels_win_rate'] = df['Aerials Won_total'] / df['Total Duels_total']

# 3. Efficienza difensiva
def defensive_actions(df_in):
    return df_in['Clearances_total'] + df_in['Interceptions_total'] + df_in['Shots Blocked_total']
df['def_actions_per_90'] = per_90(defensive_actions(df), df['Minutes Played_total'])
df['tackle_success_rate'] = df['Tackles_total'] / df['Total Duels_total']
df['clean_sheet_rate'] = df['Cleansheets_total'] / df['Appearances_total']
df['goals_conceded_per_90'] = per_90(df['Goals Conceded_total'], df['Minutes Played_total'])

# 4. Affidabilità e disponibilità
df['starting_rate'] = df['Lineups_total'] / df['Appearances_total']
df['minutes_share'] = df['Minutes Played_total'] / (df['Appearances_total'] * 90)
df['bench_rate'] = df['Bench_total'] / df['Appearances_total']
df['cards_total'] = df[['Yellowcards_total','Redcards_total','Yellowred Cards_total']].fillna(0).sum(axis=1)
df['injury_risk'] = df['Injuries_total'] / df['Minutes Played_total'] * 1000

df['rating_std'] = df.groupby('player_name')['Rating_average'].transform('std')
df['expected_minutes'] = df['starting_rate'] * 90

# 6. Indicatori di contesto
df['next_match_difficulty'] = pd.NA
df['position'] = df.get('position', pd.NA)

# =========================
# CALCOLO DEL VALORE DEL GIOCATORE (basato su performance relative)
# =========================
metrics = [
    'goals_per_90','assists_per_90','big_chances_created_per_90',
    'key_passes_per_90','crosses_per_90','def_actions_per_90',
    'clean_sheet_rate','tackle_success_rate'
]
# z-score normalizzati
for m in metrics:
    df[f'{m}_z'] = zscore(df[m].fillna(0))
# Composite performance score e percentile
z_cols = [f'{m}_z' for m in metrics]
df['performance_score'] = df[z_cols].mean(axis=1)
df['performance_percentile'] = df['performance_score'].rank(pct=True)
# Categoria valore
def classify_value(pct):
    if pct >= 0.8:
        return 'Elite'
    elif pct >= 0.6:
        return 'High'
    elif pct >= 0.4:
        return 'Medium'
    elif pct >= 0.2:
        return 'Low'
    else:
        return 'Very Low'

df['value_category'] = df['performance_percentile'].apply(classify_value)

# =========================
# FUNZIONE DI AGGREGAZIONE
# =========================
def compute_features(dataframe):
    """Restituisce DataFrame con raw + derivate + valore giocatore."""
    original = dataframe.columns.tolist()
    derived = [
        'goals_per_90','assists_per_90','big_chances_created_per_90','conversion_rate',
        'xG_total','xA_total','xG_diff','xA_diff',
        'key_passes_per_90','crosses_per_90','dribble_success_rate','aerial_duels_win_rate',
        'def_actions_per_90','tackle_success_rate','clean_sheet_rate','goals_conceded_per_90',
        'starting_rate','minutes_share','bench_rate','cards_total','injury_risk',
        'rating_std','expected_minutes','next_match_difficulty','position',
        # value metrics
        *[f'{m}_z' for m in metrics],
        'performance_score','performance_percentile','value_category'
    ]
    cols = original + [c for c in derived if c not in original]
    return dataframe[cols]

# Esempio utilizzo
df_features = compute_features(df)
df_features.to_csv('fantacalcio_features_all.csv', index=False)
print(df_features.head())
