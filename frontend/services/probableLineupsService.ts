import { base_url } from "./api";
import { getAuthToken } from "./geminiService";

export interface PlayerInfo {
  player_name: string;
  role: string;
}

export interface ProbableLineupsOptions {
  matchday: number;
  season?: string;
  idToken?: string;
  playerNames?: PlayerInfo[];
}

export async function getProbableLineups(options: ProbableLineupsOptions) {
  const { matchday, season, idToken, playerNames } = options;
  const token = getAuthToken(idToken);
  const body: any = { matchday };
  if (season) body.season = season;
  if (playerNames && Array.isArray(playerNames)) {
    body.player_names = playerNames;
  }
  const resp = await fetch(`${base_url}/api/gemini/probable-lineups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.message || "Errore dal backend Gemini.");
  }
  return data.data;
}
