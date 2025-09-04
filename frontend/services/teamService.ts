import { Role } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export interface TeamPlayer {
  player_name: string;
  team: string;
  role: Role;
}

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
  const response = await fetch(`${BASE_URL}/api/team`, {
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
