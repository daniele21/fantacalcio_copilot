import { useState, useMemo } from "react";
import { useAuth } from "@/services/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FormationPitch from "./components/FormationPitch";
import RoleRow from "./components/RoleRow";
import ImportTeamDialog, { ImportedPlayer, ImportMode } from "@/components/ImportTeamDialog";
import { Wand2, ShieldCheck, Upload, Zap, ChevronDown } from "lucide-react";

// Types and utilities
import { Module, MODULE_SLOTS } from "./types";
import { exportTeamToCSV, mapImported, mergePlayers } from "./utils";
import { saveUserTeam, fetchUserTeam } from "../services/teamService";

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

export default function LineupCoachPage() {
  // Auth context for user info
  const authContext = useAuth();
  
  // Debug auth context
  console.log("🔐 Auth context:", {
    isLoggedIn: authContext?.isLoggedIn,
    profileSub: authContext?.profile?.sub?.substring(0, 10) + "...", // Truncate for privacy
    hasIdToken: !!authContext?.idToken
  });
  
  // Team management hook
  const {
    players,
    setPlayers,
    teamLoading,
    teamError,
    showImportDialog,
    setShowImportDialog,
    nextMatchday
  } = useTeamManagement({
    isLoggedIn: authContext?.isLoggedIn,
    profileSub: authContext?.profile?.sub,
    idToken: authContext?.idToken || undefined
  });

  // UI State
  const [importOpen, setImportOpen] = useState(false);
  const [isRoleRowsOpen, setIsRoleRowsOpen] = useState<{ [role: string]: boolean }>({
    POR: true,
    DIF: true,
    CEN: true,
    ATT: true,
  });
  
  // Strategy settings - interactive for AI optimization
  const [module, setModule] = useState<Module>("4-3-3");
  const [risk, setRisk] = useState<number>(35);
  const [preferDefMod, setPreferDefMod] = useState<boolean>(false);
  const [xiThreshold, setXiThreshold] = useState<number>(0.7);

  // AI Optimization hook
  const {
    aiOptimizing,
    aiOptimizationError,
    aiResult,
    aiRecommendations,
    handleAIOptimization,
    setCaptainId,
    setViceCaptainId,
    captainId,
    viceCaptainId
  } = useAIOptimization({
    players,
    setPlayers,
    nextMatchday,
    risk,
    xiThreshold,
    preferDefMod,
    module,
    idToken: authContext?.idToken || undefined
  });

  // Final recommendation hook
  const finalRec = useLineupRecommendation({ aiResult, players });

  // Debug team state and rendering conditions
  console.log("� Team state:", {
    playersLength: players.length,
    teamLoading,
    teamError,
    showImportDialog,
    firstPlayerData: players[0] ? {
      id: players[0].id,
      name: players[0].name,
      team: players[0].team,
      opponent: players[0].opponent,
      kickoff: players[0].kickoff
    } : null
  });  // Debug: Check render conditions
  console.log("🎯 Render conditions:", {
    willShowLoading: teamLoading,
    willShowError: !!teamError,
    willShowImportDialog: (showImportDialog || players.length === 0) && !teamLoading,
    willShowMainPage: !teamLoading && !teamError && !((showImportDialog || players.length === 0) && !teamLoading)
  });

  // Role change handler with API save
  const handleRoleChange = async (playerId: string, newRole: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      console.log(`🔄 Role changed: ${player.name} from ${player.role} to ${newRole}`);
    }
    
    // Update local state immediately
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, role: newRole as any } : p
    ));

    // Save to backend API
    if (authContext?.profile?.sub && authContext?.idToken) {
      try {
        const updatedPlayers = players.map(p => 
          p.id === playerId ? { ...p, role: newRole as any } : p
        );
        
        const teamPlayersForAPI = updatedPlayers.map(p => ({
          player_id: p.id,
          player_name: p.name,
          team: p.team,
          role: p.role,
        }));

        await saveUserTeam(authContext.profile.sub, teamPlayersForAPI, authContext.idToken);
        console.log(`✅ Role change saved to API: ${player?.name} -> ${newRole}`);
      } catch (error) {
        console.error('❌ Failed to save role change to API:', error);
        // Could show a toast notification here
      }
    }
  };

  // Manual team reload for debugging
  const handleManualReload = async () => {
    if (!authContext?.profile?.sub || !authContext?.idToken) {
      console.log("❌ Cannot reload: missing auth context");
      return;
    }

    try {
      console.log("🔄 Manual team reload starting...");
      const teamData = await fetchUserTeam(authContext.profile.sub, authContext.idToken);
      console.log("🏆 Manual reload - raw team data:", teamData);
      
      if (teamData && typeof teamData === 'object' && Object.keys(teamData).length > 0) {
        const playerEntries = Object.entries(teamData);
        const mapped = playerEntries.map(([playerName, playerInfo]: [string, any]) => {
          const stats = playerInfo.stats || {};
          const playerId = playerInfo.player_id || playerName;
          
          return {
            id: playerId,
            name: playerName,
            role: playerInfo.role,
            team: playerInfo.team,
            opponent: '',
            kickoff: '',
            xiProb: 0.0,
            expMinutes: typeof stats.minutes_played_total === 'number' ? stats.minutes_played_total : 90,
            ciLow: 3,
            ciHigh: 8,
            stats: stats,
          };
        });
        setPlayers(mapped);
        console.log("✅ Manual reload successful:", mapped.length, "players");
      } else {
        console.log("❌ Manual reload: no team data found");
      }
    } catch (error) {
      console.error("❌ Manual reload failed:", error);
    }
  };

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

  // Show import dialog if no team is loaded (but not while loading)
  if ((showImportDialog || players.length === 0) && !teamLoading) {
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
          <div className="p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Lineup Coach</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Optimize your XI + bench</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-slate-900 dark:text-white">{finalRec.teamXfp?.toFixed(1) || '0.0'}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <span className="font-semibold text-slate-900 dark:text-white">{teamAvgXIprob.toFixed(0)}% XI prob</span>
              </div>
            </div>

            {/* Compact Action Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={module} onValueChange={(v: string) => setModule(v as Module)}>
                <SelectTrigger className="w-[100px] h-8">
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
                size="sm"
                className="gap-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white disabled:opacity-50"
              >
                <Wand2 className="h-3 w-3" />
                {aiOptimizing ? "Optimizing..." : "AI Optimize"}
              </Button>
              
              <Button onClick={onSave} size="sm" variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Save
              </Button>
              
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1">
                <Upload className="h-3 w-3" />
                Edit
              </Button>
              
              <Button variant="outline" size="sm" onClick={() => exportTeamToCSV(players)} className="gap-1">
                Export CSV
              </Button>
              
              {/* Debug: Manual reload button */}
              <Button variant="outline" size="sm" onClick={handleManualReload} className="gap-1 text-blue-600 border-blue-300">
                🔄 Reload
              </Button>
              
              {/* Debug: Force import dialog */}
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className="gap-1 text-green-600 border-green-300">
                💾 Import
              </Button>
              
              {/* Debug: Show team loading status */}
              {teamLoading ? (
                <Badge variant="secondary" className="text-xs">Loading team...</Badge>
              ) : teamError ? (
                <Badge variant="destructive" className="text-xs">Team error</Badge>
              ) : (
                <Badge variant="default" className="text-xs">{players.length} players</Badge>
              )}
            </div>

            {/* Error Messages */}
            {aiOptimizationError && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Errore AI Optimization</AlertTitle>
                <AlertDescription>{aiOptimizationError}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

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

        {/* Formation and Lineup Field Section */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 dark:border-slate-600/30 overflow-hidden">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">{module}</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-0">Formation & Lineup</h3>
                  <p className="text-white/80 text-sm">Starting XI on the pitch</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-sm">Formation</div>
                <div className="text-white font-bold text-lg">{module}</div>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {/* Formation Pitch */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-2xl p-4 border border-green-200 dark:border-green-700/50 shadow-inner mb-6">
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
            
            {/* Enhanced Bench Section - Positioned before Your Squad */}
            <div className="bg-gradient-to-br from-slate-100/90 via-blue-50/50 to-slate-50/80 dark:from-slate-800/90 dark:via-slate-700/80 dark:to-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-white/30 dark:border-slate-600/30 shadow-lg mb-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-sm font-bold">B</span>
                  </div>
                  <div>
                    <h5 className="text-lg font-bold text-slate-900 dark:text-white">Bench</h5>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Reserve players for matchday</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                  {finalRec.bench.length} players
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {finalRec.bench.slice(0, 7).map((b: any) => (
                  <div key={b.id} className="bg-gradient-to-br from-white/90 to-slate-50/70 dark:from-slate-800/90 dark:to-slate-700/70 backdrop-blur-sm rounded-xl p-4 border border-white/30 dark:border-slate-600/30 text-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                    <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">{b.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{b.role} • {b.team}</div>
                    {b.opponent && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-2 py-1">
                        {b.opponent}
                      </div>
                    )}
                  </div>
                ))}
                {finalRec.bench.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                    <div className="text-center">
                      <div className="text-lg mb-2">🔄</div>
                      <div>{aiResult ? "Nessun giocatore in panchina" : "Esegui l'ottimizzazione AI per vedere i giocatori in panchina"}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Your Squad Section with Collapsible Role Rows */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  Your Squad
                </h2>
                <Button
                  onClick={() => setImportOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900/20"
                >
                  <Upload className="h-4 w-4" />
                  Edit Team
                </Button>
              </div>

              <div className="space-y-3">
                {/* Role rows: collapsible player cards by role */}
                {[
                  { role: "POR", title: "Portieri", icon: "🥅" },
                  { role: "DIF", title: "Difensori", icon: "🛡️" },
                  { role: "CEN", title: "Centrocampisti", icon: "⚽" },
                  { role: "ATT", title: "Attaccanti", icon: "🎯" },
                ].map(({ role, title, icon }) => {
                  const rolePlayers = players.filter((p) => p.role === role);
                  const roleStartersCount = rolePlayers.filter((p) => finalRec.xiIds?.has(p.id)).length;
                  const roleBenchCount = rolePlayers.length - roleStartersCount;
                  const isOpen = isRoleRowsOpen[role] ?? true;

                  // Debug: Log role filtering
                  console.log(`🏃 Role ${role} (${title}):`, {
                    totalPlayers: players.length,
                    rolePlayers: rolePlayers.length,
                    rolePlayersNames: rolePlayers.map(p => p.name),
                    isOpen
                  });

                  // Role-specific colors
                  const roleColors = {
                    POR: "text-yellow-700 dark:text-yellow-300",
                    DIF: "text-blue-700 dark:text-blue-300", 
                    CEN: "text-green-700 dark:text-green-300",
                    ATT: "text-red-700 dark:text-red-300"
                  };

                  return (
                    <div key={role} className="rounded-xl border border-white/20 bg-gradient-to-br from-white/90 via-slate-50/80 to-white/70 dark:from-slate-800/90 dark:via-slate-700/80 dark:to-slate-800/70 backdrop-blur-sm shadow-lg">
                      <Collapsible key={role} open={isOpen} onOpenChange={(open) => 
                        setIsRoleRowsOpen(prev => ({ ...prev, [role]: open }))
                      }>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex w-full items-center justify-between p-5 hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-white/90 dark:hover:from-slate-700/50 dark:hover:to-slate-800/70 transition-all duration-200 rounded-xl">
                              <div className="flex items-center gap-4">
                                <div className="text-2xl">{icon}</div>
                                <div className="text-left">
                                  <h3 className={`text-lg font-semibold ${roleColors[role as keyof typeof roleColors]}`}>{title}</h3>
                                  <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                    <span>{rolePlayers.length} totali</span>
                                    <Separator orientation="vertical" className="h-4" />
                                    <span className="text-emerald-600">{roleStartersCount} titolari</span>
                                    <Separator orientation="vertical" className="h-4" />
                                    <span className="text-amber-600">{roleBenchCount} riserve</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {rolePlayers.length}
                                </Badge>
                                <ChevronDown className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="border-t border-white/20 dark:border-slate-600/30 px-5 pb-5 bg-gradient-to-br from-slate-50/30 via-white/20 to-slate-100/40 dark:from-slate-800/30 dark:via-slate-700/20 dark:to-slate-800/40 backdrop-blur-sm">
                              <div className="pt-4">
                                <RoleRow
                                  title={title}
                                  players={rolePlayers.map(p => ({
                                    ...p,
                                    risk: p.xiProb > 0.7 ? 'Safe' : p.xiProb > 0.4 ? 'Upside' : 'Rotation'
                                  }))}
                                  xiIds={finalRec.xiIds || new Set<string>()}
                                  onAddToXI={() => {}} // Disabled - only AI optimization
                                  onSendToBench={() => {}} // Disabled - only AI optimization
                                  onLock={() => {}} // Disabled
                                  onExclude={() => {}} // Disabled
                                  captainId={captainId}
                                  onCaptain={(id: string) => setCaptainId(id === captainId ? null : id)}
                                  onRoleChange={handleRoleChange}
                                  aiRecommendations={aiRecommendations}
                                />
                              </div>
                            </div>
                          </CollapsibleContent>

                      </Collapsible>
                    </div>
                  );
                })}
              </div>
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
