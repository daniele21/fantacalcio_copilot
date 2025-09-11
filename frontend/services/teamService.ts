import { Role } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export interface TeamPlayer {
  player_id?: string;  // Add player_id for AI optimization
  player_name: string;
  team: string;
  role: Role;
}

export interface TeamPlayerData {
  player_id?: string;  // Add player_id for AI optimization
  role: Role;
  team: string;
  stats: any;
}

export interface TeamDict {
  [playerName: string]: TeamPlayerData;
}

/**
 * Fetches the user's team from Firestore via backend API.
 * @param google_sub The user's Google sub (id).
 * @param idToken The user's authentication token (optional).
 * @returns Dictionary of team players with player names as keys.
 */
export const fetchUserTeam = async (
  google_sub: string,
  idToken?: string
): Promise<TeamDict> => {
  if (!google_sub) {
    throw new Error('Missing google_sub');
  }
  const url = `${BASE_URL}/api/get_team?google_sub=${encodeURIComponent(google_sub)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch team.');
  }
  const responseData = await response.json();
  
  console.log("fetchUserTeam - Full API response:", responseData);
  console.log("fetchUserTeam - Extracted team data:", responseData.data);
  
  // Backend returns { "success": true, "data": team_dict }
  // Extract the actual team data from the "data" field
  return responseData.data ?? {};
};

/**
 * Stores the user's team in Firestore via backend API.
 * @param google_sub The user's Google sub (id).
 * @param team_players Array of team players (player_name, team, role).
 * @param idToken The user's authentication token (optional, for future use).
 */
export const saveUserTeam = async (
  google_sub: string,
  team_players: TeamPlayer[],
  idToken?: string
): Promise<void> => {
  if (!google_sub || !Array.isArray(team_players)) {
    throw new Error('Missing google_sub or team_players');
  }
  const payload = {
    google_sub,
    team_players,
  };
  const response = await fetch(`${BASE_URL}/api/save_team`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to save team.');
  }
};
