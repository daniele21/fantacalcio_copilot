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
// REPLACE the old sentimentClasses with this brand-aware version
function sentimentClasses(s: Sentiment = "neutral") {
  // Stronger color contrast for positive and negative, matching pitch style
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
  const tag = riskPillClasses(p.risk);
  const newsTone = sentimentClasses(p.sentiment);
  const isCaptain = captainId === p.id;

  return (
    <Card
      className={[
        "snap-start shrink-0 rounded-xl border border-base-300 bg-base-200/95",
        "w-[260px] sm:w-[268px] p-3 shadow-sm ring-2 ring-brand-primary/20",
        "hover:shadow-lg transition-shadow"
      ].join(" ")}
      aria-label={`${p.name} • ${p.team} ${p.opponent} • ${p.kickoff}`}
    >
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        {/* BUTTON ROW: News, Captain, Lock, Exclude */}
        <div className="flex items-center gap-1 mb-1">
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
                    className={
                      "h-3.5 w-3.5 " +
                      (p.sentiment === "positive"
                        ? "text-brand-primary"
                        : p.sentiment === "negative"
                        ? "text-destructive"
                        : "text-muted-foreground")
                    }
                  />
                </Button>
              </TooltipTrigger>
              {p.news && (
                <TooltipContent
                  side="top"
                  align="end"
                  className="max-w-sm whitespace-pre-wrap leading-snug text-[12px]"
                >
                  <div className={`mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${newsTone}`}>
                    <Newspaper className="h-3 w-3" />
                    News
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
          <div className="mt-1 text-[11px] text-content-200 truncate">
            {p.team} {p.opponent} · {p.kickoff}
          </div>
          {/* Always-visible XI% pill (moved below team/opponent/kickoff) */}
          <Badge
            variant="secondary"
            className="mt-1 h-5 px-2 text-[10px] leading-none bg-brand-primary/15 text-brand-primary border-brand-primary/30"
            title="Probability to start"
          >
            XI {Math.round(p.xiProb * 100)}%
          </Badge>
        </div>
      </div>

      {/* XI probability BAR + label (always readable) */}
      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-300 ring-1 ring-base-200/60">
          <div
            className="h-full bg-brand-primary"
            style={{ width: `${p.xiProb * 100}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-content-100">
          XI: <span className="font-semibold text-brand-primary">{Math.round(p.xiProb * 100)}%</span>
        </div>
      </div>

      {/* COMPACT STATS (2 columns, no News) */}
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] leading-tight">
        <div className="rounded-md border p-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ratings</div>
          <div className="flex justify-between"><span>L</span><span className="font-medium">{p.lastRating ?? "-"}</span></div>
          <div className="flex justify-between"><span>3</span><span className="font-medium">{p.avg3 ?? "-"}</span></div>
          <div className="flex justify-between"><span>5</span><span className="font-medium">{p.avg5 ?? "-"}</span></div>
        </div>
        <div className="rounded-md border p-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Season</div>
          <div className="flex justify-between"><span>G/A</span><span className="font-medium">{p.seasonGoals ?? 0}/{p.seasonAssists ?? 0}</span></div>
          <div className="flex justify-between"><span>Apps</span><span className="font-medium">{p.seasonApps ?? 0}</span></div>
          <div className="flex justify-between"><span>Malus</span><span className="font-medium">{p.avgMalus ?? 0}</span></div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-3 flex items-center justify-between">
        <Badge variant={isInXI ? "secondary" : "outline"} className={isInXI ? "text-[10px] bg-brand-primary/15 text-brand-primary border-brand-primary/30" : "text-[10px] border-base-300 text-content-200"}>
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
    </Card>
  );
}
