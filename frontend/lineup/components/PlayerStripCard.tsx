"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, AlertTriangle, Lock, ArrowUpCircle, ArrowDownCircle, Newspaper } from "lucide-react";
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
  risk: RiskTag;
  lastRating?: number;
  avg3?: number;
  avg5?: number;
  seasonGoals?: number;
  seasonAssists?: number;
  seasonApps?: number;
  avgMalus?: number;
  news?: string;
  sentiment?: Sentiment;
};

function riskPillClasses(risk: RiskTag) {
  return risk === "Safe"
    ? "bg-brand-primary/15 text-brand-primary border border-brand-primary/30"
    : risk === "Upside"
    ? "bg-secondary/15 text-secondary border border-secondary/30"
    : "bg-rose-500/15 text-rose-400 border border-rose-400/30";
}
function sentimentClasses(s: Sentiment = "neutral") {
  switch (s) {
    case "positive":
      return "bg-green-500/90 text-white border border-green-700/70 shadow-sm";
    case "negative":
      return "bg-rose-600/90 text-white border border-rose-900/70 shadow-sm";
    default:
      return "bg-base-200 text-content-100 border border-base-300";
  }
}
function truncate(s: string, n = 16) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
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
}: {
  p: StripPlayer;
  isInXI: boolean;
  onAddToXI: (id: string) => void;
  onSendToBench: (id: string) => void;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  captainId: string | null;
  onCaptain: (id: string) => void;
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
  const tag = riskPillClasses(p.risk);
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
      className={`snap-start w-[236px] sm:w-[256px] shrink-0 rounded-2xl border-2 p-2 transition-all
        shadow-[0_6px_32px_0_rgba(0,0,0,0.16)] hover:shadow-[0_8px_40px_0_rgba(0,0,0,0.22)]
        hover:border-brand-primary/60 hover:bg-base-100/90
        bg-gradient-to-br from-white/80 via-base-100/80 to-base-200/60 dark:from-base-900/80 dark:via-base-800/80 dark:to-base-700/60
        backdrop-blur-md
        ${roleBgClass} ${isInXI ? "ring-2 ring-brand-primary/60" : "border-base-300"}`}
      title={`${p.name} • ${p.team} ${p.opponent} • ${p.kickoff}`}
    >
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        {/* ACTIONS: News tooltip + icons */}
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={!p.news}
                  title={p.news ? "Mostra news" : "Nessuna news"}
                >
                  <Newspaper
                    className={`h-3.5 w-3.5 ${
                      p.sentiment === "positive"
                        ? "text-brand-primary"
                        : p.sentiment === "negative"
                        ? "text-destructive"
                        : "text-content-100/70"
                    }`}
                  />
                </Button>
              </TooltipTrigger>
              {p.news && (
                <TooltipContent side="top" align="end" className="max-w-[360px] whitespace-pre-wrap leading-snug text-[12px]">
                  <div className={`mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium
                    ${
                      p.sentiment === "positive"
                        ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30"
                        : p.sentiment === "negative"
                        ? "bg-destructive/10 text-destructive border border-destructive/30"
                        : "bg-base-200 text-content-100 border border-base-300"
                    }`}>
                    <Newspaper className="h-3 w-3" /> News
                  </div>
                  <div className="text-[12px] text-content-100">{p.news}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <Button size="icon" variant={isCaptain ? "default" : "ghost"} className="h-6 w-6" onClick={() => onCaptain(p.id)} title={isCaptain ? "Unset captain" : "Set captain"}>
            <Crown className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onLock(p.id)} title="Lock in XI">
            <Lock className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onExclude(p.id)} title="Exclude this week">
            <AlertTriangle className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* NAME, ROLE, RISK ROW */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate text-[13px] font-semibold leading-none max-w-[132px] text-content-100">
              {truncate(p.name, 18)}
            </span>
            <Badge variant="outline" className="px-1 py-0 text-[10px] border-brand-primary/40 text-brand-primary bg-base-100/80">
              {p.role}
            </Badge>
          </div>
          <div className="mt-1">
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${tag}`}>{p.risk}</span>
          </div>
          <div className="text-[11px] text-content-200 truncate mb-0.5">
            {p.team} {p.opponent} · {p.kickoff}
          </div>
        </div>
      </div>

      {/* XI probability BAR + label (stronger, gradient) */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
          <div
            className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-[width] duration-300"
            style={{ width: `${p.xiProb * 100}%` }}
          />
        </div>
        <Badge variant="secondary" className="ml-2 shrink-0 bg-brand-primary/10 text-brand-primary border-brand-primary/30">
          {Math.round(p.xiProb * 100)}%
        </Badge>
      </div>

      {/* COLLAPSIBLE STATS SECTION */}
      <details
        className="mt-2"
        open={detailsOpen}
        ref={detailsRef}
        onToggle={e => setDetailsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary
          className="cursor-pointer text-xs font-semibold text-content-100 py-1 px-2 rounded hover:bg-base-200/60 select-none"
          onClick={e => e.stopPropagation()}
        >
          Statistiche
        </summary>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] leading-tight mt-2">
          <div className="rounded-md border border-base-300 bg-base-100/70 p-1.5">
            <div className="text-[10px] uppercase tracking-wide text-content-100/70">Ratings</div>
            <div className="flex justify-between"><span>L</span><span className="font-medium">{p.lastRating ?? "-"}</span></div>
            <div className="flex justify-between"><span>3</span><span className="font-medium">{p.avg3 ?? "-"}</span></div>
            <div className="flex justify-between"><span>5</span><span className="font-medium">{p.avg5 ?? "-"}</span></div>
          </div>
          <div className="rounded-md border border-base-300 bg-base-100/70 p-1.5">
            <div className="text-[10px] uppercase tracking-wide text-content-100/70">Season</div>
            <div className="flex justify-between"><span>G/A</span><span className="font-medium">{p.seasonGoals ?? 0}/{p.seasonAssists ?? 0}</span></div>
            <div className="flex justify-between"><span>Apps</span><span className="font-medium">{p.seasonApps ?? 0}</span></div>
            <div className="flex justify-between"><span>Malus</span><span className="font-medium">{p.avgMalus ?? 0}</span></div>
          </div>
        </div>
        {/* FOOTER */}
        <div className="mt-3 flex items-center justify-between">
          <Badge variant={isInXI ? "secondary" : "outline"} className={isInXI ? "bg-brand-primary/10 text-brand-primary border-brand-primary/30" : ""}>
            {isInXI ? "XI" : "Bench"}
          </Badge>
          {isInXI ? (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1 h-7 px-2 bg-brand-primary/90 text-white hover:bg-brand-primary"
              onClick={() => onSendToBench(p.id)}
              title="Send to bench"
            >
              <ArrowDownCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1 h-7 px-2 bg-base-300 text-brand-primary hover:bg-brand-primary/10"
              onClick={() => onAddToXI(p.id)}
              title="Add to XI"
            >
              <ArrowUpCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </details>
    </Card>
  );
}
