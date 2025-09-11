import { useState } from "react";
import { Player, RiskTag, AIRecommendations } from "../types";
import { getProbableLineups } from "../../services/probableLineupsService";
import { optimizeLineup, LineupOptimizationRequest } from "../../services/lineupOptimizationService";

interface UseAIOptimizationProps {
  players: Player[];
  setPlayers: (players: Player[]) => void;
  nextMatchday: number | null;
  risk: number;
  xiThreshold: number;
  preferDefMod: boolean;
  module: string;
  idToken?: string;
}

interface UseAIOptimizationReturn {
  aiOptimizing: boolean;
  aiOptimizationError: string | null;
  aiResult: any;
  aiRecommendations: AIRecommendations | null;
  handleAIOptimization: () => Promise<void>;
  setCaptainId: (id: string | null) => void;
  setViceCaptainId: (id: string | null) => void;
  captainId: string | null;
  viceCaptainId: string | null;
}

export function useAIOptimization({
  players,
  setPlayers,
  nextMatchday,
  risk,
  xiThreshold,
  preferDefMod,
  module,
  idToken
}: UseAIOptimizationProps): UseAIOptimizationReturn {
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiOptimizationError, setAiOptimizationError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendations | null>(null);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);

  const handleAIOptimization = async () => {
    if (!nextMatchday) {
      setAiOptimizationError("Nessuna giornata disponibile per l'ottimizzazione");
      return;
    }

    if (players.length === 0) {
      setAiOptimizationError("Nessun giocatore disponibile per l'ottimizzazione");
      return;
    }

    setAiOptimizing(true);
    setAiOptimizationError(null);

    try {
      console.log("🤖 Starting AI optimization...");
      
      // Step 1: Fetch probable lineups
      console.log("📊 Fetching probable lineups...");
      const playerInfo = players.map((p) => ({ player_name: p.name, role: p.role }));
      const probableLineupsData = await getProbableLineups({ 
        matchday: nextMatchday, 
        playerNames: playerInfo 
      });
      
      console.log("📊 Probable lineups fetched:", Object.keys(probableLineupsData.result || {}).length, "players");
      
      // Step 2: Update players with probable lineup data
      const updatedPlayers = players.map(player => {
        const lineupData = probableLineupsData.result?.[player.name];
        if (lineupData) {
          // Enhanced risk calculation using multiple factors
          let appearances = 0, lineupTotal = 0, minutesPlayed = 0, rating = 0, starterProb = 0;
          if (player.stats) {
            appearances = player.stats.appearances_total ?? 0;
            lineupTotal = player.stats.lineups_total ?? 0;
            minutesPlayed = player.stats.minutes_played_total ?? 0;
            rating = player.stats.beginner?.rating_average ?? player.stats.intermediate?.rating_average ?? 0;
            starterProb = player.stats.expert?.starter_prob ?? 0;
          }
          
          const appearanceRatio = lineupTotal > 0 ? appearances / lineupTotal : 0;
          const minutesPerGame = appearances > 0 ? minutesPlayed / appearances : 0;
          const probTitolare = typeof lineupData.prob_titolare === 'number' ? lineupData.prob_titolare : 0;
          
          // Risk scoring system (0-100, higher = safer)
          let riskScore = 0;
          
          // Lineup probability weight (40% of score)
          riskScore += probTitolare * 40;
          
          // Historical appearance ratio weight (25% of score)
          riskScore += appearanceRatio * 25;
          
          // Minutes per game consistency (20% of score)
          const minutesScore = minutesPerGame >= 70 ? 20 : minutesPerGame >= 45 ? 15 : minutesPerGame >= 20 ? 10 : 5;
          riskScore += minutesScore;
          
          // Performance rating weight (10% of score)
          const ratingScore = rating >= 7.0 ? 10 : rating >= 6.5 ? 7 : rating >= 6.0 ? 5 : 2;
          riskScore += ratingScore;
          
          // Historical starter probability weight (5% of score)
          riskScore += starterProb * 5;
          
          // Determine risk tag based on composite score
          let risk: RiskTag = "Rotation";
          if (riskScore >= 75) {
            risk = "Safe";     // High probability starter with good track record
          } else if (riskScore <= 40) {
            risk = "Upside";   // Low probability/inconsistent but potential value
          }
          
          return {
            ...player,
            titolare: lineupData.titolare,
            prob_titolare: lineupData.prob_titolare,
            prob_subentro: lineupData.prob_subentro,
            ballottaggio: lineupData.ballottaggio,
            lineupNews: lineupData.news,
            xiProb: typeof lineupData.prob_titolare === 'number' ? lineupData.prob_titolare : 0.5,
            risk,
            probableLineupInfo: {
              titolare: lineupData.titolare,
              prob_titolare: lineupData.prob_titolare,
              prob_subentro: lineupData.prob_subentro,
              ballottaggio: lineupData.ballottaggio,
              note: lineupData.note || 'Nessuna nota',
              forma: lineupData.forma || 'N/A',
              news: lineupData.news || 'Nessuna news',
              last_updated: lineupData.last_updated || new Date().toISOString()
            }
          };
        }
        return player;
      });
      
      // Update players state immediately
      setPlayers(updatedPlayers);
      
      // Step 3: Run AI optimization
      console.log("🤖 Running AI optimization...");
      const strategySettings = {
        risk,
        xiThreshold,
        preferDefMod,
        module
      };

      const teamPlayers = updatedPlayers.map(player => ({
        id: player.id,
        name: player.name,
        role: player.role,
        team: player.team,
        opponent: player.opponent,
        kickoff: player.kickoff,
        xiProb: player.xiProb,
        expMinutes: player.expMinutes,
        ciLow: player.ciLow,
        ciHigh: player.ciHigh,
        risk: player.risk,
        status: player.status,
        probableLineupInfo: player.probableLineupInfo
      }));

      const request: LineupOptimizationRequest = {
        strategySettings,
        teamPlayers,
        matchday: nextMatchday
      };

      const result = await optimizeLineup(request, idToken);
      
      console.log("🤖 AI optimization completed:", result);

      // Set captain and vice-captain
      if (result.captain?.playerId) {
        console.log("🤖 Setting captain ID:", result.captain.playerId);
        setCaptainId(result.captain.playerId);
      }
      if (result.viceCaptain?.playerId) {
        console.log("🤖 Setting vice-captain ID:", result.viceCaptain.playerId);
        setViceCaptainId(result.viceCaptain.playerId);
      }

      // Store AI reasoning for display
      const playerReasons: { [playerId: string]: string } = {};
      
      // Collect reasoning for XI players
      result.xi.forEach((player: any) => {
        if (player.reasoning) {
          playerReasons[player.playerId] = player.reasoning;
        }
      });
      
      // Collect reasoning for bench players
      result.bench.forEach((player: any) => {
        if (player.reasoning) {
          playerReasons[player.playerId] = player.reasoning;
        }
      });

      setAiRecommendations({
        overallReasoning: result.reasoning || "AI optimization completed successfully.",
        playerReasons,
        captainReason: result.captain?.reasoning || "Captain choice based on AI analysis.",
        viceCaptainReason: result.viceCaptain?.reasoning || "Vice-captain choice based on AI analysis."
      });

      // Store the full AI result for display
      setAiResult(result);

      console.log("🤖 AI Optimization applied successfully");
      
    } catch (error) {
      console.error("❌ AI Optimization error:", error);
      setAiOptimizationError(error instanceof Error ? error.message : "Errore durante l'ottimizzazione AI");
    } finally {
      setAiOptimizing(false);
    }
  };

  return {
    aiOptimizing,
    aiOptimizationError,
    aiResult,
    aiRecommendations,
    handleAIOptimization,
    setCaptainId,
    setViceCaptainId,
    captainId,
    viceCaptainId
  };
}
