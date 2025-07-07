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
  id: number;
  name: string;
  team: string;
  role: Role;
  price: number;
  baseCost: number;
  suggestedBidMin: number;
  suggestedBidMax: number;
  fvm: number;
  // 'skills' is the array of strings from the 'Skills' column in players_attributes.csv
  skills: Skill[];
  score: number;
  recommendation: number;
  buonInvestimento?: number;
  xGoal?: number;
  fm2324?: number;
  xPresenze?: number;
  xAssist?: number;
  stats: PlayerStats;
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
    finalAdvice: string;
}

export interface AuctionResult {
  playerId: number;
  purchasePrice: number;
  buyer: string;
}