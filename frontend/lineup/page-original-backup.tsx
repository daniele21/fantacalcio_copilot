
"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/services/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FormationPitch from "./components/FormationPitch";
import ImportTeamDialog, { ImportedPlayer, ImportMode } from "@/components/ImportTeamDialog";
import { Wand2, ShieldCheck, Upload, Zap, Crown } from "lucide-react";

// Types and utilities
import { Module, MODULE_SLOTS } from "./types";
import { exportTeamToCSV, mapImported, mergePlayers } from "./utils";

// Hooks
import { useTeamManagement } from "./hooks/useTeamManagement";
import { useAIOptimization } from "./hooks/useAIOptimization";
import { useLineupRecommendation } from "./hooks/useLineupRecommendation";


/**
 * Lineup Coach – Matchday Optimizer UI (MVP)
 *
 * Repo style notes:
 * - Use brand accents via shadcn `primary`/`secondary` (no monochrome).
 * - Solid buttons for primary actions, tinted badges, subtle primary rings.
 * - Progress and highlights use `bg-primary` + `ring-primary/30`.
 *
 * Update: Starting XI now rendered on a **soccer pitch** with SVG lines + green stripes.
 * Update 2: Add/Remove between XI and Bench via Popover actions & bench rows.
 * Update 3: 3-4-3 always fills 3 forwards (fallback ignores xiThreshold if needed).
 * Update 4: **Captain & Vice-captain suggestions** with one-click apply + VC badge & action.
 */

// --- Types -----------------------------------------------------------------

type Role = "POR" | "DIF" | "CEN" | "ATT";

type RiskTag = "Safe" | "Upside" | "Rotation";

type Player = {
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
};

type Module = "3-4-3" | "4-3-3" | "4-4-2" | "3-5-2";


// CSV export helper
function exportTeamToCSV(players: Player[]) {
  const header = ['player_name', 'role', 'team'];
  const rows = players.map(p => [p.name, p.role, p.team]);
  const csv = [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my_team.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// --- Import helpers --------------------------------------------------------

function mapImported(ip: ImportedPlayer): Player {
  return {
    id: ip.id,
    name: ip.name,
    role: ip.role,
    team: ip.team ?? "",
    opponent: ip.opponent ?? "",
    kickoff: ip.kickoff ?? "",
    xiProb: typeof ip.xiProb === "number" ? Math.min(1, Math.max(0, ip.xiProb)) : 0.0,
    expMinutes: 90,
    ciLow: 2,
    ciHigh: 8,
    // Don't set risk until we have probable lineup data
  };
}

function mergePlayers(current: Player[], incoming: Player[]): Player[] {
  const byId = new Map(current.map(p => [p.id, p]));
  incoming.forEach(p => byId.set(p.id, p));
  return Array.from(byId.values());
}

// Formation slots map
const MODULE_SLOTS: Record<Module, { POR: number; DIF: number; CEN: number; ATT: number }> = {
  "3-4-3": { POR: 1, DIF: 3, CEN: 4, ATT: 3 },
  "4-3-3": { POR: 1, DIF: 4, CEN: 3, ATT: 3 },
  "4-4-2": { POR: 1, DIF: 4, CEN: 4, ATT: 2 },
  "3-5-2": { POR: 1, DIF: 3, CEN: 5, ATT: 2 },
};

// --- Helpers (simple, replace with your optimizer later) -------------------

function adjustedScore(p: Player, riskLevel: number, preferDefModifier: boolean): number {
  // riskLevel: 0 (safe) .. 100 (upside)
  const base = (p.ciLow + p.ciHigh) / 2; // Use average of bounds as base score
  const upsideBoost = (p.ciHigh - base) * (riskLevel / 100);
  const safetyBoost = (base - p.ciLow) * ((100 - riskLevel) / 100);
  const roleBonus = preferDefModifier && p.role === "DIF" ? 0.35 : 0;
  const xiPenalty = p.xiProb < 0.75 ? -0.75 : 0; // favor starters
  return base + upsideBoost * 0.5 + safetyBoost * 0.15 + roleBonus + xiPenalty;
}

function selectRolePlayers(
  players: Player[],
  role: Role,
  count: number,
  riskLevel: number,
  preferDefModifier: boolean,
  locked: Set<string>,
  excluded: Set<string>,
  xiThreshold: number,
  forcedXI: Set<string>,
  forcedBench: Set<string>
) {
  // Filter to only include players with probable lineup data (xiProb > 0) or forced/locked players
    const healthy = players.filter((p) => 
      p.role === role && 
      p.status !== "injured" && 
      p.status !== "suspended" && 
      !excluded.has(p.id) &&
      (p.xiProb > 0 || forcedXI.has(p.id) || locked.has(p.id))
    );

    if (role === 'POR' && forcedXI.size > 0) {
      console.log(`DEBUG ${role} - Total players for role:`, players.filter(p => p.role === role).length);
      console.log(`DEBUG ${role} - Healthy players after filter:`, healthy.length);
      console.log(`DEBUG ${role} - ForcedXI for this role:`, 
        Array.from(forcedXI).filter(id => players.find(p => p.id === id)?.role === role)
      );
      console.log(`DEBUG ${role} - Players with xiProb > 0:`, 
        players.filter(p => p.role === role && p.xiProb > 0).map(p => ({ id: p.id, name: p.name, xiProb: p.xiProb }))
      );
      healthy.forEach(p => {
        const inForced = forcedXI.has(p.id);
        const inLocked = locked.has(p.id);
        console.log(`DEBUG ${role} - ${p.name} (${p.id}): xiProb=${p.xiProb}, forcedXI=${inForced}, locked=${inLocked}`);
      });
    }  // 1) Force-ins and locked first
  const mustStartIds = new Set<string>([...forcedXI, ...locked]);
  const mustStart = healthy.filter((p) => mustStartIds.has(p.id) && !forcedBench.has(p.id));

  // 2) Eligible pool respecting threshold
  const eligible = healthy.filter((p) => !mustStartIds.has(p.id) && !forcedBench.has(p.id) && p.xiProb >= xiThreshold);

  // 3) Score
  const scored = eligible
    .map((p) => ({ p, score: adjustedScore(p, riskLevel, preferDefModifier) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  // 4) Fill up with mustStart first
  let picked: Player[] = [...mustStart.slice(0, count)];
  for (const p of scored) {
    if (picked.length >= count) break;
    picked.push(p);
  }

  // 5) Fallback: if still missing slots, ignore xiThreshold but keep health/exclusions
  if (picked.length < count) {
    const backfill = healthy.filter((p) => !picked.some((x) => x.id === p.id) && !forcedBench.has(p.id));
    backfill
      .sort((a, b) => adjustedScore(b, riskLevel, preferDefModifier) - adjustedScore(a, riskLevel, preferDefModifier))
      .slice(0, count - picked.length)
      .forEach((p) => picked.push(p));
  }

  return picked;
}

function buildRecommendation(
  players: Player[],
  module: Module,
  riskLevel: number,
  preferDefModifier: boolean,
  locked: Set<string>,
  excluded: Set<string>,
  xiThreshold: number,
  forcedXI: Set<string>,
  forcedBench: Set<string>
) {
  const slots = MODULE_SLOTS[module];

  // NEW: holes = how many players you explicitly sent to bench for each role
  const holes = {
    POR: players.filter(p => p.role === "POR" && forcedBench.has(p.id)).length,
    DIF: players.filter(p => p.role === "DIF" && forcedBench.has(p.id)).length,
    CEN: players.filter(p => p.role === "CEN" && forcedBench.has(p.id)).length,
    ATT: players.filter(p => p.role === "ATT" && forcedBench.has(p.id)).length,
  };

  // clamp to never request negative slots
  const need = {
    POR: Math.max(0, slots.POR - holes.POR),
    DIF: Math.max(0, slots.DIF - holes.DIF),
    CEN: Math.max(0, slots.CEN - holes.CEN),
    ATT: Math.max(0, slots.ATT - holes.ATT),
  };

  // build XI with the reduced counts (so holes remain visible)
  const gk  = selectRolePlayers(players, "POR", need.POR, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const dif = selectRolePlayers(players, "DIF", need.DIF, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const cen = selectRolePlayers(players, "CEN", need.CEN, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const att = selectRolePlayers(players, "ATT", need.ATT, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const xi = [...gk, ...dif, ...cen, ...att];
  const xiIds = new Set(xi.map((p) => p.id));

  // Bench ordering: only include players with xiProb > 0 or forced players
  const benchCandidates = players.filter((p) => 
    !xiIds.has(p.id) && 
    !excluded.has(p.id) && 
    (p.xiProb > 0 || forcedBench.has(p.id))
  );
  const forcedFirst = benchCandidates.filter((p) => forcedBench.has(p.id));
  const rest = benchCandidates.filter((p) => !forcedBench.has(p.id));
  const restSorted = rest
    .map((p) => ({ p, score: p.xiProb * 2 + ((p.ciLow + p.ciHigh) / 2) * 0.5 + (p.role === "POR" ? 0.2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  const bench = [...forcedFirst, ...restSorted];
  const teamXfp = xi.reduce((acc, p) => acc + ((p.ciLow + p.ciHigh) / 2), 0);
  return { xi, bench, teamXfp, xiIds };
}

// --- Captaincy suggestion ---------------------------------------------------

function captainScore(p: Player, riskLevel: number) {
  // Base projection using average of bounds
  let score = (p.ciLow + p.ciHigh) / 2;
  // Reward starters reliability
  score += p.xiProb * 2.2;
  // Upside lever influences captaincy preference
  score += (p.ciHigh - ((p.ciLow + p.ciHigh) / 2)) * (riskLevel / 100) * 0.8;
  // Role preference: attackers > mids > defs > gk
  const roleW = p.role === "ATT" ? 0.8 : p.role === "CEN" ? 0.4 : p.role === "DIF" ? 0.1 : -0.6;
  score += roleW;
  // Set pieces bonus
  if (p.setPieces?.pens) score += 0.6;
  if (p.setPieces?.fks) score += 0.25;
  if (p.setPieces?.corners) score += 0.15;
  return score;
}

function suggestCaptaincy(xi: Player[], riskLevel: number) {
  if (!xi.length) return { capId: null as string | null, viceId: null as string | null };
  const ranked = [...xi]
    .map((p) => ({ id: p.id, score: captainScore(p, riskLevel) }))
    .sort((a, b) => b.score - a.score);
  const capId = ranked[0]?.id ?? null;
  let viceId = ranked[1]?.id ?? null;
  // Safety: ensure vice != captain
  if (viceId === capId) viceId = ranked[2]?.id ?? null;
  return { capId, viceId };
}

// --- UI --------------------------------------------------------------------

export default function LineupCoachPage() {
  // Auth context for user info
  const authContext = useAuth();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  
  // UI State
  const [isMatchesOpen, setIsMatchesOpen] = useState(false);
  const [isRoleRowsOpen, setIsRoleRowsOpen] = useState<{ [role: string]: boolean }>({
    P: false,
    D: false,
    C: false,
    A: false,
  });
  const [importOpen, setImportOpen] = useState(false);
  
  // Strategy settings - only used for AI optimization
  const [module, setModule] = useState<Module>("4-3-3");
  const [risk, setRisk] = useState<number>(35);
  const [preferDefMod, setPreferDefMod] = useState<boolean>(false);
  const [xiThreshold, setXiThreshold] = useState<number>(0.7);
  
  // Captain/Vice-Captain from AI optimization
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  
  // Store the next matchday number
  const [nextMatchday, setNextMatchday] = useState<number | null>(null);
  
  // AI Optimization states
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [aiOptimizationError, setAiOptimizationError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiRecommendations, setAiRecommendations] = useState<{
    overallReasoning: string;
    playerReasons: { [playerId: string]: string };
    captainReason: string;
    viceCaptainReason: string;
  } | null>(null);

  // Load saved team on mount
  useEffect(() => {
    const loadTeam = async () => {
      if (!authContext?.isLoggedIn || !authContext?.profile?.sub || !authContext?.idToken) {
        setTeamLoading(false);
        return;
      }

      try {
        setTeamError(null);
        const teamData = await fetchUserTeam(authContext.profile.sub, authContext.idToken);
        
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
  }, [authContext?.isLoggedIn, authContext?.profile?.sub, authContext?.idToken]);

  // Load matches and set matchday
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    setMatchesLoading(true);
    setMatchesError(null);
    getMatchdays(today)
      .then((data) => {
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
      .catch((e) => {
        setMatchesError(e.message || "Errore durante il caricamento delle partite.");
      })
      .finally(() => setMatchesLoading(false));
  }, [players.length]); // Depend on players.length to update when team is loaded

  // AI Optimization function - fetches probable lineups and runs AI optimization
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

      const result = await optimizeLineup(request, authContext?.idToken || undefined);
      
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

      // Update module if different
      if (result.formation && result.formation !== module) {
        console.log("🤖 Updating formation from", module, "to", result.formation);
        setModule(result.formation as Module);
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

  // Final recommendation: use AI result if available, otherwise empty
  const finalRec = useMemo(() => {
    if (aiResult) {
      console.log("🤖 Using AI recommendations");
      console.log("🤖 Available player IDs:", players.map(p => ({ id: p.id, name: p.name })));
      console.log("🤖 AI XI player IDs:", aiResult.xi.map((ai: any) => ai.playerId));
      console.log("🤖 Current captain ID:", captainId);
      console.log("🤖 Current vice-captain ID:", viceCaptainId);
      
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

  const onSave = () => {
    // TODO: persist lineup
    console.log("Saving lineup", {
      module,
      risk,
      preferDefMod,
      xiThreshold,
      captainId,
      viceCaptainId,
      xi: finalRec.xi.map((p: any) => p.id),
      bench: finalRec.bench.map((p: any) => p.id),
    });
  };

  const teamAvgXIprob = useMemo(() => (finalRec.xi.reduce((a: number, p: any) => a + p.xiProb, 0) / Math.max(1, finalRec.xi.length)) * 100, [finalRec.xi]);

  // Show team loading state
  if (teamLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-850 dark:to-slate-800">
        <div className="container mx-auto max-w-7xl p-6 md:p-8 space-y-8">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
            <div className="p-6 md:p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Lineup Coach</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300">Caricamento della squadra...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show team error
  if (teamError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-850 dark:to-slate-800">
        <div className="container mx-auto max-w-7xl p-6 md:p-8 space-y-8">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
            <div className="p-6 md:p-8">
              <Alert variant="destructive">
                <AlertTitle>Errore</AlertTitle>
                <AlertDescription>{teamError}</AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <Button onClick={() => setShowImportDialog(true)} className="gap-2">
                  Importa Squadra
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show import dialog if no team is loaded
  if (showImportDialog || players.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-850 dark:to-slate-800">
        <div className="container mx-auto max-w-7xl p-6 md:p-8 space-y-8">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
            <div className="p-6 md:p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Lineup Coach</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-6">Nessuna squadra trovata. Importa la tua squadra per iniziare.</p>
              <Button onClick={() => setShowImportDialog(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Importa Squadra
              </Button>
            </div>
          </div>
          
          <ImportTeamDialog
            open={showImportDialog}
            onClose={() => setShowImportDialog(false)}
            currentPlayers={[]}
            onImport={(arr: ImportedPlayer[]) => {
              const mapped = arr.map(mapImported);
              setPlayers(mapped);
              setShowImportDialog(false);
              console.log("Team imported:", mapped.length, "players");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-850 dark:to-slate-800">
      <div className="container mx-auto max-w-7xl p-6 md:p-8 space-y-8">
        {/* Controls Section */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Lineup Coach</h2>
                    <p className="text-slate-600 dark:text-slate-300">Optimize your XI + bench for each matchday</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Zap className="h-4 w-4 text-emerald-600" />
                Team xFP: <span className="font-semibold text-slate-900 dark:text-white">{finalRec.teamXfp?.toFixed(1) || '0.0'}</span>
                <Separator orientation="vertical" className="mx-2 h-4" />
                Avg XI prob: <span className="font-semibold text-slate-900 dark:text-white">{teamAvgXIprob.toFixed(0)}%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <Button variant="outline" onClick={() => exportTeamToCSV(players)} className="gap-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                Export Team CSV
              </Button>
              <Select value={module} onValueChange={(v: string) => setModule(v as Module)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(MODULE_SLOTS).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAIOptimization} 
                disabled={aiOptimizing || !nextMatchday || players.length === 0}
                className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="h-4 w-4" />
                {aiOptimizing ? "Optimizing..." : "🤖 AI Lineup Optimization"}
              </Button>
              <Button onClick={onSave} className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                <ShieldCheck className="h-4 w-4" />
                Save lineup
              </Button>
            </div>

            {/* Error Messages */}
            {aiOptimizationError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Errore AI Optimization</AlertTitle>
                <AlertDescription>{aiOptimizationError}</AlertDescription>
              </Alert>
            )}

            {/* AI Recommendations Display */}
            {aiRecommendations && (
              <div className="mb-6 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-200 dark:border-purple-700/50 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Wand2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">🤖 AI Recommendations</h3>
                      <p className="text-white/80 text-sm">Strategic insights from AI optimization</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Overall Strategy Reasoning */}
                  <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/30">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      Overall Strategy
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                      {aiRecommendations.overallReasoning}
                    </p>
                  </div>

                  {/* Captain & Vice-Captain Reasoning */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-yellow-200/50 dark:border-yellow-700/30">
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Captain Choice
                        {captainId && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full cursor-help">
                                  {players.find(p => p.id === captainId)?.name || 'Unknown'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Captain: {players.find(p => p.id === captainId)?.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {aiRecommendations.captainReason}
                      </p>
                    </div>
                    
                    <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/30">
                      <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">VC</span>
                        </div>
                        Vice-Captain Choice
                        {viceCaptainId && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full cursor-help">
                                  {players.find(p => p.id === viceCaptainId)?.name || 'Unknown'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Vice-Captain: {players.find(p => p.id === viceCaptainId)?.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {aiRecommendations.viceCaptainReason}
                      </p>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {Object.keys(aiRecommendations.playerReasons).filter(id => finalRec.xiIds?.has(id)).length}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">XI Players</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {Object.keys(aiRecommendations.playerReasons).filter(id => !finalRec.xiIds?.has(id)).length}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Bench Players</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {captainId ? '1' : '0'}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Captain Set</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {viceCaptainId ? '1' : '0'}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Vice Set</div>
                      </div>
                    </div>
                  </div>

                  {/* Player Insights */}
                  <div className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-slate-200/50 dark:border-slate-600/30">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                      Player Insights
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                      {Object.entries(aiRecommendations.playerReasons).map(([playerId, reason]) => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;
                        const isInXI = finalRec.xiIds?.has(playerId) || false;
                        return (
                          <div
                            key={playerId}
                            className={`p-3 rounded-lg border text-sm ${
                              isInXI 
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/50' 
                                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                isInXI 
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              }`}>
                                {isInXI ? '🏟️ XI' : '🪑 Bench'}
                              </span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {player.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {player.role}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              {reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Strategy Controls */}
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 rounded-3xl shadow-2xl border border-slate-200/30 dark:border-slate-700/30">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400/15 to-indigo-400/15 rounded-full -translate-y-20 translate-x-20 blur-xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-slate-400/15 to-slate-500/15 rounded-full translate-y-16 -translate-x-16 blur-xl"></div>
              
              <div className="relative p-6 sm:p-8 lg:p-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-8 lg:mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-white/20 dark:ring-slate-800/20">
                      <Wand2 className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Strategy Settings</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">Configure your lineup optimization preferences</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 sm:ml-auto">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Live Settings</span>
                  </div>
                </div>

                <div className="grid gap-6 sm:gap-8 xl:grid-cols-3">
                  {/* Risk Profile */}
                  <div className="space-y-6">
                    <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md ring-2 ring-blue-100 dark:ring-blue-900/50 transition-transform group-hover:scale-110">
                            <span className="text-white text-lg">⚡</span>
                          </div>
                          <div>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">Risk Profile</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Strategy approach</p>
                          </div>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`px-4 py-2 font-semibold rounded-full transition-all duration-300 w-32 flex items-center justify-center ${
                            risk <= 33 
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600" 
                              : risk >= 66 
                              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 shadow-blue-100/50 shadow-lg"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600"
                          }`}
                        >
                          {risk <= 33 ? "🛡️ Safe" : risk >= 66 ? "🚀 Upside" : "⚖️ Balanced"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Toggle Button Group for Risk Profile */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Button
                            variant={risk <= 33 ? "default" : "outline"}
                            size="lg"
                            onClick={() => setRisk(25)}
                            className={`h-14 w-full rounded-2xl transition-all duration-300 ${
                              risk <= 33 
                                ? "bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg shadow-slate-500/25 border-2 border-transparent" 
                                : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1 min-w-0">
                              <span className="w-3 h-3 bg-slate-500 rounded-full shadow-sm flex-shrink-0"></span>
                              <span className="font-semibold text-sm">Safe</span>
                            </div>
                          </Button>
                          <Button
                            variant={risk > 33 && risk < 66 ? "default" : "outline"}
                            size="lg"
                            onClick={() => setRisk(50)}
                            className={`h-14 w-full rounded-2xl transition-all duration-300 ${
                              risk > 33 && risk < 66
                                ? "bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white shadow-lg shadow-slate-500/25 border-2 border-transparent" 
                                : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1 min-w-0">
                              <span className="w-3 h-3 bg-slate-500 rounded-full shadow-sm flex-shrink-0"></span>
                              <span className="font-semibold text-sm">Balanced</span>
                            </div>
                          </Button>
                          <Button
                            variant={risk >= 66 ? "default" : "outline"}
                            size="lg"
                            onClick={() => setRisk(80)}
                            className={`h-14 w-full rounded-2xl transition-all duration-300 ${
                              risk >= 66
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 border-2 border-transparent" 
                                : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1 min-w-0">
                              <span className="w-3 h-3 bg-blue-500 rounded-full shadow-sm flex-shrink-0"></span>
                              <span className="font-semibold text-sm">Upside</span>
                            </div>
                          </Button>
                        </div>
                        
                        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {risk <= 33 
                              ? "🛡️ Conservative approach prioritizing consistent performers with proven track records" 
                              : risk >= 66 
                              ? "🚀 Aggressive strategy focusing on high-ceiling players with maximum upside potential"
                              : "⚖️ Balanced mix of safety and potential upside for optimal risk-reward ratio"
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* XI Probability Threshold */}
                  <div className="space-y-6">
                    <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md ring-2 ring-blue-100 dark:ring-blue-900/50 transition-transform group-hover:scale-110">
                            <span className="text-white text-lg">📊</span>
                          </div>
                          <div>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">XI Threshold</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Starting probability</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className="bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 px-4 py-2 font-bold rounded-full shadow-lg"
                        >
                          {Math.round(xiThreshold * 100)}%
                        </Badge>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Number Input with Increment/Decrement */}
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setXiThreshold(Math.max(0.3, xiThreshold - 0.05))}
                            disabled={xiThreshold <= 0.3}
                            className="w-14 h-14 p-0 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex-shrink-0"
                          >
                            <span className="text-lg font-bold">−</span>
                          </Button>
                          
                          <div className="flex-1 relative min-w-0">
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl border-2 border-blue-200 dark:border-blue-700 p-4 text-center shadow-inner">
                              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                {Math.round(xiThreshold * 100)}%
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setXiThreshold(Math.min(1, xiThreshold + 0.05))}
                            disabled={xiThreshold >= 1}
                            className="w-14 h-14 p-0 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex-shrink-0"
                          >
                            <span className="text-lg font-bold">+</span>
                          </Button>
                        </div>
                        
                        {/* Quick preset buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[0.5, 0.65, 0.75, 0.9].map((value) => (
                            <Button
                              key={value}
                              variant={Math.abs(xiThreshold - value) < 0.01 ? "default" : "outline"}
                              size="sm"
                              onClick={() => setXiThreshold(value)}
                              className={`h-12 w-full rounded-xl text-sm font-semibold transition-all duration-300 ${
                                Math.abs(xiThreshold - value) < 0.01
                                  ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 border-2 border-transparent"
                                  : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              {Math.round(value * 100)}%
                            </Button>
                          ))}
                        </div>
                        
                        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            📊 Minimum probability required for a player to be considered for starting XI selection
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Defensive Modifier */}
                  <div className="space-y-6">
                    <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md ring-2 ring-slate-200 dark:ring-slate-700 transition-transform group-hover:scale-110">
                            <span className="text-white text-lg">🛡️</span>
                          </div>
                          <div>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">Defensive Focus</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Position priority</p>
                          </div>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`px-4 py-2 font-semibold rounded-full transition-all duration-300 ${
                            preferDefMod 
                              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700 shadow-blue-100/50 shadow-lg"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600"
                          }`}
                        >
                          {preferDefMod ? "🟢 ON" : "⚪ OFF"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Toggle Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button
                            variant={!preferDefMod ? "default" : "outline"}
                            size="lg"
                            onClick={() => setPreferDefMod(false)}
                            className={`h-14 w-full rounded-2xl transition-all duration-300 ${
                              !preferDefMod
                                ? "bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white shadow-lg shadow-slate-500/25 border-2 border-transparent"
                                : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1 min-w-0">
                              <span className="w-3 h-3 bg-slate-500 rounded-full shadow-sm flex-shrink-0"></span>
                              <span className="font-semibold text-sm">Balanced</span>
                            </div>
                          </Button>
                          <Button
                            variant={preferDefMod ? "default" : "outline"}
                            size="lg"
                            onClick={() => setPreferDefMod(true)}
                            className={`h-14 w-full rounded-2xl transition-all duration-300 ${
                              preferDefMod
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 border-2 border-transparent"
                                : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1 min-w-0">
                              <span className="w-3 h-3 bg-blue-500 rounded-full shadow-sm flex-shrink-0"></span>
                              <span className="font-semibold text-sm">Defensive</span>
                            </div>
                          </Button>
                        </div>
                        
                        <div className={`rounded-2xl p-5 border transition-all duration-300 ${
                          preferDefMod 
                            ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700 shadow-lg shadow-blue-100/50' 
                            : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                        }`}>
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`w-3 h-3 rounded-full shadow-sm ${preferDefMod ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {preferDefMod ? '🛡️ Prioritizing Defenders' : '⚖️ Balanced Selection'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {preferDefMod 
                              ? 'Defenders receive bonus points for modifier eligibility and tactical advantage in formation building'
                              : 'All positions evaluated equally based on expected performance, value, and strategic importance'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="mt-8 sm:mt-10 pt-8 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl flex items-center justify-center">
                        <span className="text-white text-sm">⚡</span>
                      </div>
                      <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">Quick Presets</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setRisk(25);
                        setXiThreshold(0.8);
                        setPreferDefMod(true);
                      }}
                      className="h-16 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:from-slate-100 hover:to-slate-200/50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">🛡️</span>
                        <span className="font-bold">Conservative</span>
                        <span className="text-xs opacity-70">Safe • High Threshold • Defensive</span>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setRisk(50);
                        setXiThreshold(0.65);
                        setPreferDefMod(false);
                      }}
                      className="h-16 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:from-slate-100 hover:to-slate-200/50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">⚖️</span>
                        <span className="font-bold">Balanced</span>
                        <span className="text-xs opacity-70">Moderate • Medium Threshold • Balanced</span>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setRisk(80);
                        setXiThreshold(0.5);
                        setPreferDefMod(false);
                      }}
                      className="h-16 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:from-blue-100 hover:to-blue-200/50 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">🚀</span>
                        <span className="font-bold">Aggressive</span>
                        <span className="text-xs opacity-70">High Risk • Low Threshold • Upside</span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formation and Lineup Field Section */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 dark:border-slate-600/30 overflow-hidden">
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">{module}</span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white mb-1">Formation & Lineup</h3>
                  <p className="text-white/80 text-sm">Your starting XI on the pitch</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-white/80 text-sm">Formation</div>
                  <div className="text-white font-bold text-xl">{module}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {/* Formation Pitch */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-2xl p-8 border border-green-200 dark:border-green-700/50 shadow-inner mb-8">
              {/* Debug info */}
              <div className="mb-4 p-2 bg-blue-100 dark:bg-blue-900/20 rounded text-xs">
                <div>XI Players: {finalRec.xi.length}</div>
                <div>POR: {finalRec.xi.filter((p: any) => p.role === 'POR').length}, DIF: {finalRec.xi.filter((p: any) => p.role === 'DIF').length}, CEN: {finalRec.xi.filter((p: any) => p.role === 'CEN').length}, ATT: {finalRec.xi.filter((p: any) => p.role === 'ATT').length}</div>
                <div>Players: {finalRec.xi.map((p: any) => p.name).join(', ')}</div>
              </div>
              <FormationPitch
                orientation="landscape"
                module={module}
                players={finalRec.xi}
                xiIds={finalRec.xiIds || new Set<string>()}
                captainId={captainId}
                viceCaptainId={viceCaptainId}
                onCaptain={(id: string) => setCaptainId(id === captainId ? null : id)}
                onViceCaptain={(id: string) => setViceCaptainId(id === viceCaptainId ? null : id)}
                onLock={() => {}} // Disabled
                onExclude={() => {}} // Disabled
                onAddToXI={() => {}} // Disabled
                onSendToBench={() => {}} // Disabled
                locked={new Set<string>()}
                excluded={new Set<string>()}
              />
            </div>
            
            {/* Enhanced Bench section */}
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 border border-slate-200 dark:border-slate-600 shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-slate-400 to-slate-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-bold">B</span>
                  </div>
                  <div>
                    <h5 className="text-lg font-bold text-slate-900 dark:text-white">Bench</h5>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Reserve players</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                  {finalRec.bench.length} players
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {finalRec.bench.slice(0, 7).map((b: any) => {
                  const aiReason = aiRecommendations?.playerReasons[b.id];
                  return (
                    <TooltipProvider key={b.id} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="group relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-600 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-500 transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold shadow-sm">
                                {b.role}
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-slate-900 dark:text-white text-sm truncate max-w-[80px]" title={b.name}>
                                  {b.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {Math.round(b.xiProb * 100)}% XI
                                </div>
                                {aiReason && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                      🤖 AI
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"></div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="max-w-[300px] p-4 bg-black/95 border-white/20 backdrop-blur-xl">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{b.name}</span>
                              <Badge variant="outline" className="text-xs text-white border-white/30">{b.role}</Badge>
                            </div>
                            <div className="text-white/80 text-sm">
                              {b.team} {b.opponent} · XI {Math.round(b.xiProb * 100)}%
                            </div>
                            {aiReason && (
                              <div className="mt-3 rounded-lg border border-purple-300/40 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 p-3">
                                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold bg-gradient-to-r from-purple-400 to-indigo-500 text-white border border-purple-300/50">
                                  🤖 AI Insight
                                </div>
                                <div className="text-[12px] leading-relaxed text-white/95">
                                  {aiReason}
                                </div>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {finalRec.bench.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                    {aiResult ? "Nessun giocatore in panchina" : "Esegui l'ottimizzazione AI per vedere i giocatori in panchina"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Serie A Matches Section */}
        <Collapsible open={isMatchesOpen} onOpenChange={setIsMatchesOpen}>
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 rounded-3xl shadow-2xl">
            <div className="absolute inset-0 bg-black/20"></div>
            <CollapsibleTrigger className="w-full">
              <div className="relative p-8 md:p-12 hover:bg-black/10 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
                      Serie A
                      {nextMatchday && (
                        <span className="block text-2xl md:text-3xl font-medium text-emerald-200 mt-1">
                          Giornata {nextMatchday}
                        </span>
                      )}
                    </h1>
                    <p className="text-xl text-white/90">Prossime partite</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Zap className="h-8 w-8 text-white" />
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      {isMatchesOpen ? (
                        <ChevronUp className="h-6 w-6 text-white" />
                      ) : (
                        <ChevronDown className="h-6 w-6 text-white" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              {/* Matches Grid */}
              <div className="relative px-8 pb-8 md:px-12 md:pb-12">
                {matchesLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    <span className="ml-3 text-white">Caricamento partite...</span>
                  </div>
                )}
                {matchesError && (
                  <Alert variant="destructive" className="bg-red-500/20 border-red-400 text-white">
                    <AlertTitle>Errore</AlertTitle>
                    <AlertDescription>{matchesError}</AlertDescription>
                  </Alert>
                )}
                {!matchesLoading && !matchesError && matches.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.map((m, i) => (
                      <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
                        <div className="font-bold text-white text-lg">
                          {m.home_team} vs {m.away_team}
                        </div>
                        <div className="text-white/70 text-sm mt-1">
                          {m.date || m.data}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!matchesLoading && !matchesError && matches.length === 0 && (
                  <div className="text-center py-8 text-white/80">
                    Nessuna partita trovata.
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Your Squad Section with Collapsible Role Rows */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 dark:border-slate-600/30 overflow-hidden">
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">{module}</span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white mb-1">Your Squad</h3>
                  <p className="text-white/80 text-sm">Manage your team formation and lineup</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-white/80 text-sm">Total Players</div>
                  <div className="text-white font-bold text-xl">{players.length}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {/* Role rows: collapsible player cards by role */}
            <div className="space-y-6">
              {([
                { role: "POR", title: "Portieri", color: "yellow", icon: "🥅" },
                { role: "DIF", title: "Difensori", color: "blue", icon: "🛡️" },
                { role: "CEN", title: "Centrocampisti", color: "green", icon: "⚽" },
                { role: "ATT", title: "Attaccanti", color: "red", icon: "🎯" },
              ] as const).map(({ role, title, color, icon }) => {
                const rolePlayers = players.filter(p => p.role === role);
                const inXI = rolePlayers.filter(p => finalRec.xiIds?.has(p.id) || false).length;
                const isOpen = isRoleRowsOpen[role];
                
                // Enhanced color classes for role headers
                const colorClasses = {
                  yellow: "bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 border-yellow-400/50",
                  blue: "bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 border-blue-400/50",
                  green: "bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 border-green-400/50",
                  red: "bg-gradient-to-br from-red-500 via-rose-500 to-pink-500 border-red-400/50",
                };

                return (
                  <Collapsible key={role} open={isOpen} onOpenChange={(open) => 
                    setIsRoleRowsOpen(prev => ({ ...prev, [role]: open }))
                  }>
                    <div className="bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-700/50 rounded-2xl border border-slate-200/50 dark:border-slate-600/50 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                      {/* Enhanced Role Header */}
                      <CollapsibleTrigger className="w-full">
                        <div className={`${colorClasses[color]} px-8 py-6 border-b border-white/20 hover:bg-black/10 transition-colors`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-2xl">{icon}</span>
                              </div>
                              <div>
                                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                  {title}
                                  <span className="text-sm bg-white/20 px-2 py-1 rounded-full font-medium">
                                    {role}
                                  </span>
                                </h4>
                                <p className="text-white/80 text-sm mt-1">
                                  {rolePlayers.length} players • {inXI} in XI
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-white/70 text-xs uppercase tracking-wide">Squad</div>
                                <div className="text-white font-bold text-lg">{rolePlayers.length}</div>
                              </div>
                              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">{inXI}</span>
                              </div>
                              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4 text-white" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        {/* Players Container */}
                        <div className="p-6 bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-700/80">
                          {rolePlayers.length > 0 ? (
                            <RoleRow
                              title={title}
                              players={rolePlayers}
                              xiIds={finalRec.xiIds || new Set<string>()}
                              captainId={captainId}
                              aiRecommendations={aiRecommendations}
                            />
                          ) : (
                            <div className="flex items-center justify-center py-12 px-6">
                              <div className="text-center">
                                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                  <span className="text-2xl opacity-50">{icon}</span>
                                </div>
                                <h5 className="text-slate-600 dark:text-slate-400 font-medium mb-2">No {title}</h5>
                                <p className="text-slate-500 dark:text-slate-500 text-sm">Import players to get started</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </div>

        {/* Import Dialog */}
        <ImportTeamDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          currentPlayers={players.map(p => ({ id: p.id, role: p.role }))}
          onImport={(arr: ImportedPlayer[], mode: ImportMode) => {
            const mapped = arr.map(mapImported);
            setPlayers(prev => (mode === "replace" ? mapped : mergePlayers(prev, mapped)));
            setImportOpen(false);
          }}
        />
      </div>
    </div>
  );
}

