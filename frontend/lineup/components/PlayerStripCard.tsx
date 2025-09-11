"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, AlertTriangle, Lock, ArrowUpCircle, ArrowDownCircle, Newspaper, Wand2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Role = "POR" | "DIF" | "CEN" | "ATT";
type RiskTag = "Safe" | "Upside" | "Rotation";
type Sentiment = "positive" | "neutral" | "negative";

export type StripPlayer = {
  id: string;
  name: string;
  role: Role;
  team: string;
  opponent: string;
  kickoff: string;
  xiProb: number;
  risk?: RiskTag; // Optional until we have probable lineup data
  lastRating?: number;
  avg3?: number;
  avg5?: number;
  seasonGoals?: number;
  seasonAssists?: number;
  seasonApps?: number;
  avgMalus?: number;
  news?: string;
  sentiment?: Sentiment;
  stats?: any; // Add stats property
  // Probable lineup data
  titolare?: boolean;
  prob_titolare?: number;
  prob_subentro?: number;
  ballottaggio?: string | null;
  lineupNews?: string;
  // AI reasoning
  aiReasoning?: string;
};

function riskPillClasses(risk: RiskTag) {
  return risk === "Safe"
    ? "bg-brand-primary/15 text-brand-primary border border-brand-primary/30"
    : risk === "Upside"
    ? "bg-secondary/15 text-secondary border border-secondary/30"
    : "bg-rose-500/15 text-rose-400 border border-rose-400/30";
}

function truncate(s: string, n = 16) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function getProbabilityLevel(prob: number) {
  if (prob >= 0.7) return { level: "High", color: "bg-green-500", textColor: "text-green-700" };
  if (prob >= 0.4) return { level: "Mid", color: "bg-yellow-500", textColor: "text-yellow-700" };
  return { level: "Low", color: "bg-red-500", textColor: "text-red-700" };
}
export default function PlayerStripCard({
  p,
  isInXI,
  onAddToXI,
  onSendToBench,
  onLock,
  onExclude,
  captainId,
  onCaptain,
  onRoleChange,
}: {
  p: StripPlayer;
  isInXI: boolean;
  onAddToXI?: (id: string) => void;
  onSendToBench?: (id: string) => void;
  onLock?: (id: string) => void;
  onExclude?: (id: string) => void;
  captainId: string | null;
  onCaptain?: (id: string) => void;
  onRoleChange?: (playerId: string, newRole: string) => void;
}) {
  // Collapsed by default for statistics
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    const ref = detailsRef.current;
    if (!ref) return;
    const stopBubble = (event: Event) => {
      event.stopPropagation();
    };
    ref.addEventListener('toggle', stopBubble, true);
    return () => {
      ref.removeEventListener('toggle', stopBubble, true);
    };
  }, []);
  const isCaptain = captainId === p.id;

  // Match PlayerCard color logic
  const getRoleBgClass = (role: Role) => {
    switch (role) {
      case "POR":
        return "bg-yellow-100/40 dark:bg-yellow-900/40";
      case "DIF":
        return "bg-blue-100/40 dark:bg-blue-900/40";
      case "CEN":
        return "bg-green-100/40 dark:bg-green-900/40";
      case "ATT":
        return "bg-red-100/40 dark:bg-red-900/40";
      default:
        return "bg-base-200/40 dark:bg-base-800/40";
    }
  };
  const roleBgClass = getRoleBgClass(p.role);

  return (
    <Card
      className={`snap-start w-[280px] sm:w-[300px] shrink-0 rounded-3xl border p-4 transition-all duration-300
        shadow-lg hover:shadow-2xl hover:scale-[1.02]
        bg-gradient-to-br from-white via-slate-50 to-slate-100 
        dark:from-slate-800 dark:via-slate-850 dark:to-slate-900
        ${roleBgClass} 
        ${isInXI 
          ? "ring-2 ring-emerald-400 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-slate-50 dark:from-emerald-900/20 dark:via-slate-800 dark:to-slate-900" 
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
      title={`${p.name} • ${p.team} ${p.opponent} • ${p.kickoff}`}
    >
      {/* HEADER */}
      <div className="flex flex-col gap-3">
        {/* Player Name and Role */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {truncate(p.name, 20)}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {onRoleChange ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select value={p.role} onValueChange={(newRole) => onRoleChange(p.id, newRole)}>
                          <SelectTrigger className={`w-[60px] h-6 text-xs border-2 transition-all duration-200 font-semibold ${
                            p.role === 'POR' ? 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-500 dark:bg-yellow-900/20 dark:text-yellow-300' :
                            p.role === 'DIF' ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300' :
                            p.role === 'CEN' ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/20 dark:text-green-300' :
                            'border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-300'
                          } hover:scale-105 hover:shadow-md`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="POR" className="text-yellow-700 dark:text-yellow-300">🥅 POR</SelectItem>
                            <SelectItem value="DIF" className="text-blue-700 dark:text-blue-300">🛡️ DIF</SelectItem>
                            <SelectItem value="CEN" className="text-green-700 dark:text-green-300">⚽ CEN</SelectItem>
                            <SelectItem value="ATT" className="text-red-700 dark:text-red-300">🎯 ATT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to change player role</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge 
                  variant="outline" 
                  className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                >
                  {p.role}
                </Badge>
              )}
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {p.team}
              </span>
            </div>
          </div>
          
          {/* Captain Badge */}
          {isCaptain && (
            <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <Crown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          )}
        </div>

        {/* Match Info and Status */}
        <div className="space-y-2">
          {/* Match Details */}
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-slate-600 dark:text-slate-400">{p.kickoff}</span>
            </div>
            {/* Opponent team - make it more prominent */}
            <div className="flex items-center justify-center bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-750 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p.opponent}</span>
            </div>
          </div>
          
          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Risk tag - only show when we have probable lineup data */}
            {p.risk && (
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${riskPillClasses(p.risk)}`}>
                {p.risk}
              </span>
            )}
            
            {/* Titolare flag */}
            {p.titolare !== undefined && (
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                p.titolare 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {p.titolare ? "✓ Starter" : "• Bench"}
              </span>
            )}

            {/* News indicator */}
            {(p.news || p.lineupNews) && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                      <Newspaper className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end" className="max-w-[360px] whitespace-pre-wrap leading-snug text-sm p-4">
                    {p.lineupNews && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-semibold text-blue-700 dark:text-blue-300">Probable Lineup</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mb-2">{p.lineupNews}</p>
                        {p.ballottaggio && (
                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-2">
                            <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                              ⚖️ Ballottaggio: {p.ballottaggio}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {p.news && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">General News</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{p.news}</p>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Probability Section - Only show when probable lineup data is available */}
      {p.prob_titolare !== undefined && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Starting Probability</span>
            {(() => {
              const probLevel = getProbabilityLevel(p.prob_titolare);
              return (
                <Badge 
                  variant="secondary" 
                  className={`px-2 py-1 text-xs font-semibold ${probLevel.textColor} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700`}
                >
                  {probLevel.level}
                </Badge>
              );
            })()}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              {(() => {
                const probLevel = getProbabilityLevel(p.prob_titolare);
                return (
                  <div
                    className={`h-full transition-all duration-500 ${probLevel.color} rounded-full`}
                    style={{ width: `${p.prob_titolare * 100}%` }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* AI Reasoning Section - Only show when AI reasoning is available */}
      {p.aiReasoning && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-3 mb-4 border border-purple-200/50 dark:border-purple-700/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Wand2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">🤖 AI Insight</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {p.aiReasoning}
          </p>
        </div>
      )}

      {/* STATS SECTION */}
      <details
        className="group"
        open={detailsOpen}
        ref={detailsRef}
        onToggle={e => setDetailsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300 py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 select-none transition-colors flex items-center justify-between">
          <span>📊 Statistics</span>
          <div className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </summary>
        
        <div className="mt-3 space-y-4">
          {/* Beginner Stats */}
          <div>
            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              Beginner Level
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Goals</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.beginner?.goals_total ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Assists</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.beginner?.assists_total ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Rating</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.beginner?.rating_average?.toFixed(1) ?? "-"}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Apps/Lineups</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.appearances_total ?? 0}/{p.stats?.lineups_total ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Minutes</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.minutes_played_total ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Clean Sheets</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.beginner?.cleansheets_total ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Intermediate Stats */}
          <details className="group/intermediate">
            <summary className="cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide py-2 px-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 select-none transition-colors flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Intermediate Level
              </span>
              <div className="w-3 h-3 text-blue-400 group-open/intermediate:rotate-180 transition-transform">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Shots/90</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.intermediate?.shots_per90?.toFixed(1) ?? "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Key Pass/90</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.intermediate?.key_passes_per90?.toFixed(1) ?? "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Dribble %</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.intermediate?.dribble_success_rate ? `${p.stats.intermediate.dribble_success_rate.toFixed(0)}%` : "-"}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Tackles/90</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.intermediate?.tackles_per90?.toFixed(1) ?? "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Aerials/90</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.intermediate?.aerials_won_per90?.toFixed(1) ?? "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Pass %</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.intermediate?.accurate_passes_percentage_total ? `${p.stats.intermediate.accurate_passes_percentage_total.toFixed(0)}%` : "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* Expert Stats */}
          <details className="group/expert">
            <summary className="cursor-pointer text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide py-2 px-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 select-none transition-colors flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Expert Level
              </span>
              <div className="w-3 h-3 text-purple-400 group-open/expert:rotate-180 transition-transform">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Starter %</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.expert?.starter_prob ? `${(p.stats.expert.starter_prob * 100).toFixed(0)}%` : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Win Rate</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.expert?.team_win_rate ? `${(p.stats.expert.team_win_rate * 100).toFixed(0)}%` : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Danger Idx</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.expert?.danger_creation_index?.toFixed(1) ?? "-"}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Sub Rate</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.expert?.sub_in_rate ? `${(p.stats.expert.sub_in_rate * 100).toFixed(0)}%` : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Avg FP</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.expert?.average_points_per_game_average?.toFixed(1) ?? "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Prog Idx</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.stats?.expert?.progression_index?.toFixed(1) ?? "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </details>

      {/* ACTION BUTTONS */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <Badge 
            variant={isInXI ? "default" : "outline"} 
            className={`px-3 py-1 font-semibold ${
              isInXI 
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" 
                : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400"
            }`}
          >
            {isInXI ? "✓ In XI" : "On Bench"}
          </Badge>
          
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCaptain?.(p.id)}
              disabled={!onCaptain}
              className={`h-8 w-8 p-0 border-slate-300 dark:border-slate-600 ${
                isCaptain 
                  ? "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400" 
                  : "hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              title={isCaptain ? "Remove as captain" : "Set as captain"}
            >
              <Crown className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLock?.(p.id)}
              disabled={!onLock}
              className="h-8 w-8 p-0 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Lock in XI"
            >
              <Lock className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExclude?.(p.id)}
              disabled={!onExclude}
              className="h-8 w-8 p-0 border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400"
              title="Exclude this week"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isInXI ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 text-sm font-medium border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400"
              onClick={() => onSendToBench?.(p.id)}
              disabled={!onSendToBench}
            >
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Send to Bench
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 h-9 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              onClick={() => onAddToXI?.(p.id)}
              disabled={!onAddToXI}
            >
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Add to XI
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
