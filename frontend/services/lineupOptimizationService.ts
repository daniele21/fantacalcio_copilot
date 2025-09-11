import { base_url } from "./api";
import { getAuthToken } from "./geminiService";

export interface LineupOptimizationRequest {
  strategySettings: {
    risk: number; // 0-100
    xiThreshold: number; // 0-1
    preferDefMod: boolean;
    module: string; // e.g., "4-3-3"
  };
  teamPlayers: Array<{
    id: string;
    name: string;
    role: string;
    team: string;
    opponent: string;
    kickoff: string;
    xiProb: number;
    expMinutes: number;
    ciLow: number;
    ciHigh: number;
    risk?: string;
    status?: string;
    // Include all player stats and probable lineup info
    stats?: any;
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
  }>;
  matchday: number;
}

export interface LineupOptimizationResponse {
  xi: Array<{
    playerId: string;
    playerName: string;
    role: string;
    reasoning: string;
  }>;
  bench: Array<{
    playerId: string;
    playerName: string;
    role: string;
    reasoning: string;
  }>;
  captain: {
    playerId: string;
    playerName: string;
    reasoning: string;
  };
  viceCaptain: {
    playerId: string;
    playerName: string;
    reasoning: string;
  };
  formation: string;
  totalXfp: number;
  reasoning: string;
  cost: number;
}

export async function optimizeLineup(
  request: LineupOptimizationRequest,
  idToken?: string
): Promise<LineupOptimizationResponse> {
  const token = getAuthToken(idToken);
  
  console.log('Sending AI optimization request:', request);
  
  const resp = await fetch(`${base_url}/api/gemini/optimize-lineup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(request),
  });

  const data = await resp.json();
  
  console.log('AI optimization response:', { status: resp.status, data });
  
  if (!resp.ok || !data.success) {
    const errorMessage = data.message || data.error || `HTTP ${resp.status}: Errore nell'ottimizzazione della formazione.`;
    console.error('AI optimization error details:', { status: resp.status, data, errorMessage });
    throw new Error(errorMessage);
  }

  // Handle nested response structure: data.result contains the actual optimization result
  return data.data?.result || data.result;
}
