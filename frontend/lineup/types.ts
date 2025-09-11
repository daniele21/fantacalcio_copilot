export type Role = "POR" | "DIF" | "CEN" | "ATT";

export type RiskTag = "Safe" | "Upside" | "Rotation";

export type Module = "3-4-3" | "4-3-3" | "4-4-2" | "3-5-2";

export type Player = {
  id: string;
  name: string;
  role: Role;
  team: string;
  opponent: string; // e.g., "vs JUV" / "@ INT"
  kickoff: string; // ISO or readable "Sat 18:00"
  xiProb: number; // 0..1
  expMinutes: number; // expected minutes 0..90
  ciLow: number; // conservative bound
  ciHigh: number; // upside bound
  risk?: RiskTag; // Optional until we have probable lineup data
  status?: "ok" | "injured" | "suspended" | "doubtful";
  setPieces?: { pens?: boolean; fks?: boolean; corners?: boolean };
  news?: string;
  sentiment?: "positive" | "neutral" | "negative";
  // Probable lineup data
  titolare?: boolean;
  prob_titolare?: number;
  prob_subentro?: number;
  ballottaggio?: string | null;
  lineupNews?: string;
  // Player statistics
  stats?: any;
  // Complete probable lineup info
  probableLineupInfo?: {
    titolare: boolean;
    prob_titolare: number;
    prob_subentro: number;
    ballottaggio: string | null;
    note: string;
    forma: string;
    news: string;
    last_updated: string;
  };
  // AI reasoning (added dynamically)
  aiReasoning?: string;
};

export type AIRecommendations = {
  overallReasoning: string;
  playerReasons: { [playerId: string]: string };
  captainReason: string;
  viceCaptainReason: string;
};

export type LineupRecommendation = {
  xi: Player[];
  bench: Player[];
  formation: string;
  teamXfp: number;
  xiIds: Set<string>;
};

// Formation slots map
export const MODULE_SLOTS: Record<Module, { POR: number; DIF: number; CEN: number; ATT: number }> = {
  "3-4-3": { POR: 1, DIF: 3, CEN: 4, ATT: 3 },
  "4-3-3": { POR: 1, DIF: 4, CEN: 3, ATT: 3 },
  "4-4-2": { POR: 1, DIF: 4, CEN: 4, ATT: 2 },
  "3-5-2": { POR: 1, DIF: 3, CEN: 5, ATT: 2 },
};
