export enum Role {
  GK = 'POR', // Portiere
  DEF = 'DIF', // Difensore
  MID = 'CEN', // Centrocampista
  FWD = 'ATT', // Attaccante
}

export enum Skill {
  Fuoriclasse = 'Fuoriclasse',
  Titolare = 'Titolare',
  BuonaMedia = 'Buona Media',
  Goleador = 'Goleador',
  Rigorista = 'Rigorista',
  Assistman = 'Assistman',
  Outsider = 'Outsider',
  Falloso = 'Falloso',
  GiovaneTalento = 'Giovane talento',
  Panchinaro = 'Panchinaro',
  Piazzati = 'Piazzati',
  CleanSheet = 'Clean Sheet',
  Infortunato = 'Infortunato',
  BuonInvestimento = 'Buon investimento',
  // Add more as needed if new skills appear in the CSV
}

export type AppMode = 'preparation' | 'live_auction';

export interface PlayerStats {
  fm1y: number;
  fm2y: number;
  fm3y: number;
  presenze1y: number;
  injury_score: number;
  exp_assist: string;
  exp_goal: string;
  exp_presenze: string;
  good_bet: number;
}

export interface Player {
  id: string | number;
  player_name: string;
  current_team: string;
  current_team_id: number;
  stats_team: string;
  stats_team_id: number;
  position: string;
  position_id: number;
  season: number;
  season_id: number;
  birthday: string;
  stars?: number;
  skills: string[]; // Accept any string, not just Skill enum
  price?: number;
  baseCost?: number;
  suggestedBidMin?: number;
  suggestedBidMax?: number;
  fvm?: number;
  score?: number;
  recommendation?: number;
  buonInvestimento?: number;
  xGoal?: number;
  fm2324?: number;
  xPresenze?: number;
  xAssist?: number;
  stats?: PlayerStats;

  // --- All new backend features (add as optional, type number | null) ---
  accurate_crosses_per_90?: number | null;
  accurate_crosses_total?: number | null;
  accurate_passes_percentage_total?: number | null;
  accurate_passes_total?: number | null;
  aerial_duels_win_rate?: number | null;
  aerial_duels_win_rate_z?: number | null;
  aerials_won_per_90?: number | null;
  aerials_won_total?: number | null;
  appearances_total?: number | null;
  assists_per_90?: number | null;
  assists_per_90_z?: number | null;
  assists_total?: number | null;
  att_perf?: number | null;
  average_points_per_game_average?: number | null;
  bench_rate?: number | null;
  bench_total?: number | null;
  big_chances_created_per_90?: number | null;
  big_chances_created_per_90_z?: number | null;
  big_chances_created_total?: number | null;
  big_chances_missed_total?: number | null;
  blocked_shots_per_90?: number | null;
  blocked_shots_total?: number | null;
  captain_total?: number | null;
  cards_per_90?: number | null;
  cards_per_90_z?: number | null;
  cards_total?: number | null;
  cen_perf?: number | null;
  clean_sheet_rate?: number | null;
  clean_sheet_rate_z?: number | null;
  cleansheets_away?: number | null;
  cleansheets_home?: number | null;
  cleansheets_total?: number | null;
  clearances_per_90?: number | null;
  clearances_total?: number | null;
  conversion_rate?: number | null;
  conversion_rate_z?: number | null;
  cross_accuracy?: number | null;
  crosses_blocked_crosses_blocked?: number | null;
  crosses_per_90?: number | null;
  crosses_per_90_z?: number | null;
  def_actions?: number | null;
  def_actions_per_90?: number | null;
  def_actions_per_90_rank?: number | null;
  def_actions_per_90_z?: number | null;
  dif_perf?: number | null;
  dispossessed_total?: number | null;
  dribble_attempts_total?: number | null;
  dribble_success_rate?: number | null;
  dribble_success_rate_z?: number | null;
  dribbled_past_total?: number | null;
  duels_won_rate?: number | null;
  duels_won_total?: number | null;
  error_lead_to_goal_total?: number | null;
  fouls_drawn_per_90?: number | null;
  fouls_drawn_total?: number | null;
  fouls_total?: number | null;
  goals_conceded_per_90?: number | null;
  goals_conceded_per_90_z?: number | null;
  goals_conceded_total?: number | null;
  goals_goals?: number | null;
  goals_penalties?: number | null;
  goals_per_90?: number | null;
  goals_per_90_z?: number | null;
  goals_total?: number | null;
  hattricks_average?: number | null;
  hattricks_total?: number | null;
  hit_woodwork_total?: number | null;
  injuries_total?: number | null;
  injury_risk?: number | null;
  injury_risk_band?: string | null;
  injury_risk_z?: number | null;
  interceptions_total?: number | null;
  key_passes_per_90?: number | null;
  key_passes_per_90_z?: number | null;
  key_passes_total?: number | null;
  lineups_total?: number | null;
  long_balls_total?: number | null;
  long_balls_won_total?: number | null;
  minutes_played_total?: number | null;
  minutes_share?: number | null;
  minutes_share_z?: number | null;
  offsides_total?: number | null;
  own_goals_total?: number | null;
  passes_total?: number | null;
  pen_save_rate?: number | null;
  pen_save_rate_z?: number | null;
  penalties_committed?: number | null;
  penalties_missed?: number | null;
  penalties_saved?: number | null;
  penalties_scored?: number | null;
  penalties_total?: number | null;
  penalties_won?: number | null;
  penalty_success_rate?: number | null;
  por_perf?: number | null;
  predicted_price?: number | null;
  quotatarget?: number | null;
  rating_average?: number | null;
  rating_average_z?: number | null;
  rating_highest?: number | null;
  rating_lowest?: number | null;
  rating_std?: number | null;
  redcards_away?: number | null;
  redcards_home?: number | null;
  redcards_total?: number | null;
  role_perf?: number | null;
  save_success_rate?: number | null;
  save_success_rate_z?: number | null;
  saves_insidebox_total?: number | null;
  saves_per_90?: number | null;
  saves_per_90_z?: number | null;
  saves_total?: number | null;
  shots_blocked_total?: number | null;
  shots_off_target_total?: number | null;
  shots_on_target_total?: number | null;
  shots_total_total?: number | null;
  starting_rate?: number | null;
  starting_rate_z?: number | null;
  substitutions_in?: number | null;
  substitutions_out?: number | null;
  successful_dribbles_total?: number | null;
  tackle_success_rate?: number | null;
  tackle_success_rate_z?: number | null;
  tackles_total?: number | null;
  team_draws_total?: number | null;
  team_lost_total?: number | null;
  team_wins_total?: number | null;
  through_balls_total?: number | null;
  through_balls_won_total?: number | null;
  total_crosses_total?: number | null;
  total_duels_total?: number | null;
  volatility_index?: number | null;
  years_old?: number | null;
  yellowcards_away?: number | null;
  yellowcards_home?: number | null;
  yellowcards_total?: number | null;
  yellowred_cards_away?: number | null;
  yellowred_cards_home?: number | null;
  yellowred_cards_total?: number | null;
  
  yellowcards_per_90?: number | null; 
  redcards_per_90?: number | null;
  own_goals_per_90?: number | null;
  penalties_saved_per_90?: number | null;
  gol_bonus?: number | null;
  assist_bonus?: number | null;
  clean_sheet_bonus?: number | null;
  titolarita?: number | null;
  malus_risk_raw?: number | null;
  pen_save_bonus?: number | null;
  xfp_90?: number | null;
  xfp_per_game?: number | null;

}

export interface MyTeamPlayer extends Player {
  purchasePrice: number;
  buyer?: string; // Added for TeamsView UI logic
}

export interface TargetPlayer extends Player {
  maxBid: number;
}

export interface LeagueSettings {
  participants: number;
  budget: number;
  participantNames: string[];
  roster: {
    [Role.GK]: number;
    [Role.DEF]: number;
    [Role.MID]: number;
    [Role.FWD]: number;
  };
  useCleanSheetBonus: boolean;
  useDefensiveModifier: boolean;
  leagueName: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface AggregatedAnalysisResult {
  analysis: string;
  sources: GroundingSource[];
}

export interface DetailedAnalysisResult {
    strengths: string[];
    weaknesses: string[];
    advice: string;
}

export interface BiddingAdviceResult {
    roleBudgetAdvice: string;
    roleSlotAdvice: string;
    recommendedPriceAdvice: string;
    opportunityAdvice: string;
    participantAdvice: string;
    finalAdvice: string;
}

export interface AuctionResult {
  playerId: number;
  player_name: string;
  position: string;
  purchasePrice: number;
  buyer: string;
}