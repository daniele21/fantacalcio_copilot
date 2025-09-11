import { useState, useEffect } from "react";
import { Player } from "../types";
import { fetchUserTeam } from "../../services/teamService";
import { getMatchdays } from "../../services/lineupService";

interface UseTeamManagementProps {
  isLoggedIn?: boolean;
  profileSub?: string;
  idToken?: string;
}

interface UseTeamManagementReturn {
  players: Player[];
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  teamLoading: boolean;
  teamError: string | null;
  showImportDialog: boolean;
  setShowImportDialog: (show: boolean) => void;
  matches: any[];
  matchesLoading: boolean;
  matchesError: string | null;
  nextMatchday: number | null;
}

export function useTeamManagement({
  isLoggedIn,
  profileSub,
  idToken
}: UseTeamManagementProps): UseTeamManagementReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [nextMatchday, setNextMatchday] = useState<number | null>(null);

  // Load saved team on mount
  useEffect(() => {
    const loadTeam = async () => {
      if (!isLoggedIn || !profileSub || !idToken) {
        setTeamLoading(false);
        return;
      }

      try {
        setTeamError(null);
        const teamData = await fetchUserTeam(profileSub, idToken);
        
        console.log("Raw API response for get_team:", teamData);
        console.log("Type of teamData:", typeof teamData);
        console.log("Keys in teamData:", teamData ? Object.keys(teamData) : 'null/undefined');
        
        // teamData is a dictionary with player names as keys, not an array
        if (teamData && typeof teamData === 'object' && Object.keys(teamData).length > 0) {
          // Convert dictionary to array and map to Player type
          const playerEntries = Object.entries(teamData);
          console.log("Player entries:", playerEntries);
          
          const mapped = playerEntries.map(([playerName, playerInfo]: [string, any]) => {
            const stats = playerInfo.stats || {};
            const playerId = playerInfo.player_id || playerName;
            
            console.log(`📋 Loading player: ${playerName} -> ID: ${playerId}`);
            
            return {
              id: playerId,  // Use player_id if available, fallback to playerName
              name: playerName,
              role: playerInfo.role,
              team: playerInfo.team,
              opponent: '', // Will be filled when matches are loaded
              kickoff: '',
              xiProb: 0.0, // Will be updated with probable lineup data
              expMinutes: typeof stats.minutes_played_total === 'number' ? stats.minutes_played_total : 90,
              ciLow: 3, // Default conservative bound
              ciHigh: 8, // Default upside bound
              stats: stats,
            };
          });
          setPlayers(mapped);
          console.log("Loaded team players:", mapped.length, mapped);
        } else {
          // No team found, show import dialog
          console.log("No team data found, showing import dialog");
          setShowImportDialog(true);
        }
      } catch (err: any) {
        console.error('Failed to fetch saved team:', err);
        setTeamError(err.message || 'Errore durante il caricamento della squadra');
        setShowImportDialog(true);
      } finally {
        setTeamLoading(false);
      }
    };

    loadTeam();
  }, [isLoggedIn, profileSub, idToken]);

  // Load matches and set matchday
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    setMatchesLoading(true);
    setMatchesError(null);
    getMatchdays(today)
      .then((data: any) => {
        setMatches(data.matches || []);
        // Set next matchday from the first match if available
        if (data.matches && data.matches.length > 0 && data.matches[0].matchday) {
          const matchdayNumber = typeof data.matches[0].matchday === 'string' 
            ? parseInt(data.matches[0].matchday, 10) 
            : data.matches[0].matchday;
          setNextMatchday(matchdayNumber);
        } else {
          setNextMatchday(null);
        }
        
        // Update players with opponent and kickoff info
        if (players.length > 0) {
          setPlayers(currentPlayers => {
            return currentPlayers.map(player => {
              const teamMatch = data.matches?.find((m: any) => 
                m.home_team === player.team || m.away_team === player.team
              );
              
              if (teamMatch) {
                const opponent = teamMatch.home_team === player.team 
                  ? `vs ${teamMatch.away_team}` 
                  : `@ ${teamMatch.home_team}`;
                const kickoff = teamMatch.date || teamMatch.data || '';
                
                return {
                  ...player,
                  opponent,
                  kickoff
                };
              }
              return player;
            });
          });
        }
      })
      .catch((e: any) => {
        setMatchesError(e.message || "Errore durante il caricamento delle partite.");
      })
      .finally(() => setMatchesLoading(false));
  }, [players.length]); // Depend on players.length to update when team is loaded

  return {
    players,
    setPlayers,
    teamLoading,
    teamError,
    showImportDialog,
    setShowImportDialog,
    matches,
    matchesLoading,
    matchesError,
    nextMatchday
  };
}
