import { Player, Role, AggregatedAnalysisResult, GroundingSource, LeagueSettings, MyTeamPlayer, DetailedAnalysisResult, BiddingAdviceResult } from "../types";
import { base_url } from "./api";
import { useContext } from "react";
import { AuthContext } from "./AuthContext";

// Helper to get idToken from AuthContext if not provided
function getAuthToken(providedToken?: string): string | null {
  if (providedToken) return providedToken;
  try {
    // Use window.AuthContext if available (for non-hook usage)
    if ((window as any).AuthContext?.idToken) return (window as any).AuthContext.idToken;
  } catch {}
  // fallback: try React context (for hook usage)
  try {
    // This will only work inside a React component
    // @ts-ignore
    const ctx = useContext(AuthContext);
    return ctx?.idToken || null;
  } catch {}
  // fallback: try localStorage
  return localStorage.getItem('idToken');
}

export const getAggregatedAnalysis = async (
  players: Player[],
  role: Role | null,
  idToken?: string
): Promise<{ result: AggregatedAnalysisResult; cost: number }> => {
  if (!Array.isArray(players) || players.length === 0)
    return {
      result: {
        analysis: "Nessun giocatore selezionato per l'analisi. Modifica i filtri.",
        sources: [],
      },
      cost: 0,
    };
  try {
    const token = getAuthToken(idToken);
    const resp = await fetch(`${base_url}/api/gemini/aggregated-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ players, role }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return {
        result: {
          analysis: data.message || "Errore dal backend Gemini.",
          sources: [],
        },
        cost: 0,
      };
    }
    return data.data;
  } catch (error: any) {
    return {
      result: {
        analysis: "Impossibile generare l'analisi aggregata a causa di un errore di rete o del server.",
        sources: [],
      },
      cost: 0,
    };
  }
};

export const getDetailedPlayerAnalysis = async (
  playerName: string,
  playerTeam: string,
  playerRole: Role,
  idToken?: string
): Promise<{ result: DetailedAnalysisResult; cost: number }> => {
  if (!playerName || !playerTeam || !playerRole) {
    return {
      result: {
        strengths: [],
        weaknesses: [],
        advice: "Analisi AI non disponibile (dati mancanti).",
      },
      cost: 0,
    };
  }
  try {
    const token = getAuthToken(idToken);
    const resp = await fetch(`${base_url}/api/gemini/detailed-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ playerName, playerTeam, playerRole }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return {
        result: {
          strengths: [],
          weaknesses: [],
          advice: data.message || "Errore dal backend Gemini.",
        },
        cost: 0,
      };
    }
    return data.data;
  } catch (error: any) {
    return {
      result: {
        strengths: [],
        weaknesses: [],
        advice: "Impossibile generare l'analisi AI dettagliata a causa di un errore di rete, del server o di un formato di risposta non valido.",
      },
      cost: 0,
    };
  }
};

export const getBiddingAdvice = async (
  player: Player,
  myTeam: MyTeamPlayer[],
  settings: LeagueSettings,
  currentBid: number,
  roleBudget: Record<Role, number>,
  allPlayers?: Player[],
  auctionLog?: Record<number, any>,
  idToken?: string
): Promise<{ result: BiddingAdviceResult; cost: number }> => {
  if (!player || !myTeam || !settings || currentBid == null || !roleBudget) {
    return {
      result: {
        roleBudgetAdvice: "Consiglio AI non disponibile (dati mancanti).",
        roleSlotAdvice: "",
        recommendedPriceAdvice: "",
        opportunityAdvice: "",
        finalAdvice: "",
      },
      cost: 0,
    };
  }
  try {
    const token = getAuthToken(idToken);
    const resp = await fetch(`${base_url}/api/gemini/bidding-advice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        player,
        myTeam,
        settings,
        currentBid,
        roleBudget,
        allPlayers,
        auctionLog,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return {
        result: {
          roleBudgetAdvice: data.message || "Errore dal backend Gemini.",
          roleSlotAdvice: "",
          recommendedPriceAdvice: "",
          opportunityAdvice: "",
          finalAdvice: "",
        },
        cost: 0,
      };
    }
    return data.data;
  } catch (error: any) {
    return {
      result: {
        roleBudgetAdvice: "Impossibile ottenere un consiglio a causa di un errore di rete, del server o di un formato di risposta non valido.",
        roleSlotAdvice: "",
        recommendedPriceAdvice: "",
        opportunityAdvice: "",
        finalAdvice: "",
      },
      cost: 0,
    };
  }
};