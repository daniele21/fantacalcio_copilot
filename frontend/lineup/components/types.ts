// Shared types for LineupCoach modular components

export type Role = "POR" | "DIF" | "CEN" | "ATT";
export type RiskTag = "Safe" | "Upside" | "Rotation";

export type Player = {
  id: string;
  name: string;
  role: Role;
  team: string;
  opponent: string;
  kickoff: string;
  xiProb: number;
  expMinutes: number;
  xFP: number;
  ciLow: number;
  ciHigh: number;
  risk: RiskTag;
  status?: "ok" | "injured" | "suspended" | "doubtful";
  setPieces?: { pens?: boolean; fks?: boolean; corners?: boolean };
};

export type Module = "3-4-3" | "4-3-3" | "4-4-2" | "3-5-2";
