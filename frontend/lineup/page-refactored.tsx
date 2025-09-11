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

export default function LineupCoachPage() {
  // Auth context for user info
  const authContext = useAuth();
  
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
  
  // Strategy settings - only used for AI optimization
  const [module, setModule] = useState<Module>("4-3-3");
  const [risk] = useState<number>(35);
  const [preferDefMod] = useState<boolean>(false);
  const [xiThreshold] = useState<number>(0.7);

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
                </div>
              </div>
            )}
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
                {finalRec.bench.slice(0, 7).map((b: any) => (
                  <div key={b.id} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-600 text-center">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{b.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{b.role} • {b.team}</div>
                  </div>
                ))}
                {finalRec.bench.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                    {aiResult ? "Nessun giocatore in panchina" : "Esegui l'ottimizzazione AI per vedere i giocatori in panchina"}
                  </div>
                )}
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
