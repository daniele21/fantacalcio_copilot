import { useMemo } from "react";
import { Player, LineupRecommendation } from "../types";

interface UseLineupRecommendationProps {
  aiResult: any;
  players: Player[];
}

export function useLineupRecommendation({ aiResult, players }: UseLineupRecommendationProps): LineupRecommendation {
  return useMemo(() => {
    if (aiResult) {
      console.log("🤖 Using AI recommendations");
      console.log("🤖 Available player IDs:", players.map(p => ({ id: p.id, name: p.name })));
      console.log("🤖 AI XI player IDs:", aiResult.xi.map((ai: any) => ai.playerId));
      
      // Build XI from AI recommendations
      const aiXI = aiResult.xi.map((aiPlayer: any) => {
        let player = players.find(p => p.id === aiPlayer.playerId);
        
        // Fallback: try to match by name if ID match fails
        if (!player) {
          player = players.find(p => p.name === aiPlayer.playerName);
          if (player) {
            console.log(`🔄 Matched AI player by name: ${aiPlayer.playerName} (${aiPlayer.playerId})`);
          }
        }
        
        if (!player) {
          console.warn(`⚠️ AI XI player not found: ${aiPlayer.playerId} (${aiPlayer.playerName})`);
          return null;
        }
        return {
          ...player,
          aiReasoning: aiPlayer.reasoning
        };
      }).filter(Boolean);

      // Build bench from AI recommendations
      const aiBench = aiResult.bench.map((aiPlayer: any) => {
        let player = players.find(p => p.id === aiPlayer.playerId);
        
        // Fallback: try to match by name if ID match fails
        if (!player) {
          player = players.find(p => p.name === aiPlayer.playerName);
          if (player) {
            console.log(`🔄 Matched AI bench player by name: ${aiPlayer.playerName} (${aiPlayer.playerId})`);
          }
        }
        
        if (!player) {
          console.warn(`⚠️ AI bench player not found: ${aiPlayer.playerId} (${aiPlayer.playerName})`);
          return null;
        }
        return {
          ...player,
          aiReasoning: aiPlayer.reasoning
        };
      }).filter(Boolean);

      console.log(`🤖 AI Final XI: ${aiXI.length} players`, aiXI.map((p: any) => p?.name));
      console.log(`🤖 AI Final Bench: ${aiBench.length} players`, aiBench.map((p: any) => p?.name));

      // Calculate team xFP for AI recommendation using average of bounds
      const teamXfp = aiXI.reduce((sum: number, p: any) => sum + ((p.ciLow + p.ciHigh) / 2), 0);
      const xiIds = new Set<string>(aiXI.map((p: any) => p.id));

      return {
        xi: aiXI,
        bench: aiBench,
        formation: aiResult.formation || "4-3-3",
        teamXfp,
        xiIds
      };
    }
    
    // No AI result yet - return empty lineup
    return {
      xi: [],
      bench: [],
      formation: "4-3-3",
      teamXfp: 0,
      xiIds: new Set<string>()
    };
  }, [aiResult, players]);
}
