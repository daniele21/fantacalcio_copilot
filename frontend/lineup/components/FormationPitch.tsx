function roleGlow(role: Role) {
  return role === "POR"
    ? "bg-sky-400/35"
    : role === "DIF"
    ? "bg-emerald-400/35"
    : role === "CEN"
    ? "bg-indigo-400/35"
    : "bg-rose-400/35";
}
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Crown,
  Medal,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Newspaper,
} from "lucide-react";

// --- types ------------------------------------------------------------------

type Role = "POR" | "DIF" | "CEN" | "ATT";
type RiskTag = "Safe" | "Upside" | "Rotation";
export type Module = "3-4-3" | "4-3-3" | "4-4-2" | "3-5-2";

export type PitchPlayer = {
  id: string;
  name: string;
  role: Role;
  team?: string;
  opponent?: string;   // e.g. "vs LEC" / "@ ROM"
  kickoff?: string;    // "Sun 20:45"
  xiProb?: number;     // 0..1
  xFP?: number;        // expected fantasy points
  risk?: RiskTag;
  news?: string;
  sentiment?: "positive" | "neutral" | "negative";
};
// Helper for sentiment chip style
function sentimentChip(s: "positive" | "neutral" | "negative" = "neutral") {
  // Stronger color contrast for positive and negative
  switch (s) {
    case "positive":
      return "bg-green-500/90 text-white border border-green-700/70 shadow-sm";
    case "negative":
      return "bg-rose-600/90 text-white border border-rose-900/70 shadow-sm";
    default:
      return "bg-base-200 text-content-100 border border-base-300";
  }
}

type PitchSpot = { x: number; y: number };
type ModuleLayout = { POR: PitchSpot[]; DIF: PitchSpot[]; CEN: PitchSpot[]; ATT: PitchSpot[] };

// --- helpers ----------------------------------------------------------------

const cx = (...s: Array<string | false | undefined>) => s.filter(Boolean).join(" ");


// For placeholder logic
const ROLE_ORDER: Role[] = ["POR", "DIF", "CEN", "ATT"];
function riskDot(risk?: RiskTag) {
  return risk === "Safe" ? "bg-emerald-500" : risk === "Upside" ? "bg-violet-500" : "bg-rose-500";
}
function shortName(n: string) {
  const parts = n.split(" ").filter(Boolean);
  const last = parts[parts.length - 1] || n;
  return last.length > 9 ? last.slice(0, 9) + "…" : last;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function resolveCollisions(items: Array<{ p: PitchPlayer; spot: PitchSpot }>) {
  const placed: Array<{ p: PitchPlayer; x: number; y: number }> = [];
  const MIN_DIST = 10;
  for (const { p, spot } of items) {
    let x = spot.x,
      y = spot.y,
      tries = 0;
    while (placed.some((q) => Math.hypot(q.x - x, q.y - y) < MIN_DIST) && tries < 8) {
      const dir = tries % 2 ? -1 : 1;
      y = clamp(y + dir * 4, 6, 94);
      x = clamp(x + dir * 1.8, 6, 94);
      tries++;
    }
    placed.push({ p, x, y });
  }
  return placed;
}

// portrait (top->bottom)
function layoutPortrait(m: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 50, y: 92 }];
  if (m === "4-3-3")
    return {
      POR,
      DIF: [10, 32.5, 67.5, 90].map((x) => ({ x, y: 72 })),
      CEN: [18, 50, 82].map((x) => ({ x, y: 52 })),
      ATT: [33, 50, 67].map((x) => ({ x, y: 30 })),
    };
  if (m === "3-4-3")
    return {
      POR,
      DIF: [20, 50, 80].map((x) => ({ x, y: 72 })),
      CEN: [10, 35, 65, 90].map((x) => ({ x, y: 52 })),
      ATT: [25, 50, 75].map((x) => ({ x, y: 30 })),
    };
  if (m === "4-4-2")
    return {
      POR,
      DIF: [10, 32.5, 67.5, 90].map((x) => ({ x, y: 72 })),
      CEN: [12, 38, 62, 88].map((x) => ({ x, y: 52 })),
      ATT: [40, 60].map((x) => ({ x, y: 32 })),
    };
  // 3-5-2
  return {
    POR,
    DIF: [20, 50, 80].map((x) => ({ x, y: 72 })),
    CEN: [8, 30, 50, 70, 92].map((x) => ({ x, y: 52 })),
    ATT: [40, 60].map((x) => ({ x, y: 32 })),
  };
}

// landscape (left->right)
function layoutLandscape(m: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 8, y: 50 }];
  if (m === "4-3-3")
    return {
      POR,
      DIF: [26, 26, 26, 26].map((x, i) => ({ x, y: [10, 32.5, 67.5, 90][i] })),
      CEN: [50, 50, 50].map((x, i) => ({ x, y: [18, 50, 82][i] })),
      ATT: [74, 74, 74].map((x, i) => ({ x, y: [33, 50, 67][i] })),
    };
  if (m === "3-4-3")
    return {
      POR,
      DIF: [26, 26, 26].map((x, i) => ({ x, y: [20, 50, 80][i] })),
      CEN: [50, 50, 50, 50].map((x, i) => ({ x, y: [10, 35, 65, 90][i] })),
      ATT: [74, 74, 74].map((x, i) => ({ x, y: [25, 50, 75][i] })),
    };
  if (m === "4-4-2")
    return {
      POR,
      DIF: [26, 26, 26, 26].map((x, i) => ({ x, y: [10, 32.5, 67.5, 90][i] })),
      CEN: [50, 50, 50, 50].map((x, i) => ({ x, y: [12, 38, 62, 88][i] })),
      ATT: [74, 74].map((x, i) => ({ x, y: [40, 60][i] })),
    };
  // 3-5-2
  return {
    POR,
    DIF: [26, 26, 26].map((x, i) => ({ x, y: [20, 50, 80][i] })),
    CEN: [50, 50, 50, 50, 50].map((x, i) => ({ x, y: [8, 30, 50, 70, 92][i] })),
    ATT: [74, 74].map((x, i) => ({ x, y: [40, 60][i] })),
  };
}

// --- component --------------------------------------------------------------

export default function FormationPitch({
  orientation = "portrait",
  module,
  players,
  xiIds,
  captainId,
  viceCaptainId,
  className,
  // interactive state flags
  locked,
  excluded,
  // actions (all optional; buttons are hidden when handler is not provided)
  onCaptain,
  onViceCaptain,
  onLock,
  onExclude,
  onAddToXI,
  onSendToBench,
}: {
  orientation?: "portrait" | "landscape";
  module: Module;
  players: PitchPlayer[];
  xiIds: Set<string>;
  captainId: string | null;
  viceCaptainId: string | null;
  className?: string;
  locked?: Set<string>;
  excluded?: Set<string>;
  onCaptain?: (id: string) => void;
  onViceCaptain?: (id: string) => void;
  onLock?: (id: string) => void;
  onExclude?: (id: string) => void;
  onAddToXI?: (id: string) => void;
  onSendToBench?: (id: string) => void;
}) {

  const layout = orientation === "landscape" ? layoutLandscape(module) : layoutPortrait(module);

  // For each role, any unused layout coordinate becomes a placeholder.
  const placeholderSpots: Array<{ role: Role; spot: PitchSpot }> = [];
  (["POR", "DIF", "CEN", "ATT"] as Role[]).forEach((r) => {
    const coords = (layout as any)[r] as PitchSpot[];
    const present = players.filter(p => p.role === r).length;
    if (coords && coords.length > present) {
      coords.slice(present).forEach((spot) => placeholderSpots.push({ role: r, spot }));
    }
  });

  const spotsRaw: Array<{ p: PitchPlayer; spot: PitchSpot }> = [];
  (["POR", "DIF", "CEN", "ATT"] as Role[]).forEach((r) => {
    const coords = (layout as any)[r] as PitchSpot[];
    players
      .filter((p) => p.role === r)
      .forEach((p, i) => {
        if (coords[i]) spotsRaw.push({ p, spot: coords[i] });
      });
  });

  const spots = resolveCollisions(spotsRaw);

  // --- Placeholders for empty slots (ghost pins) ---
  // Use the same layout logic as the main spots
  const moduleLayout = orientation === "landscape" ? layoutLandscape : layoutPortrait;
  const layoutObj = moduleLayout(module);
  const usedMap = new Map<string, number>(); // role -> count used
  spots.forEach(s => usedMap.set(s.p.role, (usedMap.get(s.p.role) ?? 0) + 1));

  const placeholders: Array<{ role: Role; x: number; y: number; idx: number }> = [];
  ROLE_ORDER.forEach((r) => {
    const coords = (layoutObj as any)[r] as { x: number; y: number }[];
    const used = usedMap.get(r) ?? 0;
    for (let i = used; i < coords.length; i++) {
      const c = coords[i];
      placeholders.push({ role: r, x: c.x, y: c.y, idx: i });
    }
  });


  // --- Modern pitch container and SVG ---
  return (
    <div
      className={cx(
        "relative block w-full rounded-2xl border border-base-300 overflow-hidden",
        "bg-[radial-gradient(120%_120%_at_50%_-10%,_oklch(0.68_0.16_145)_0%,_oklch(0.58_0.14_145)_45%,_oklch(0.52_0.12_145)_100%)]",
        orientation === "landscape" ? "aspect-[20/9]" : "aspect-[3/4]",
        className
      )}
    >
      {/* soft pitch stripes */}
      <div className="absolute inset-0 opacity-20">
        <div
          className={
            orientation === "landscape"
              ? "h-full w-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_7%,transparent_7%,transparent_14%)]"
              : "h-full w-full bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_7%,transparent_7%,transparent_14%)]"
          }
        />
      </div>

      {/* field lines */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <rect x="3" y="3" width="94" height="94" fill="none" stroke="white" strokeWidth="0.8" />
        {orientation === "landscape" ? (
          <line x1="50" y1="3" x2="50" y2="97" stroke="white" strokeWidth="0.6" />
        ) : (
          <line x1="3" y1="50" x2="97" y2="50" stroke="white" strokeWidth="0.6" />
        )}
        <circle cx="50" cy="50" r="8" fill="none" stroke="white" strokeWidth="0.6" />
        {orientation === "landscape" ? (
          <>
            <rect x="3" y="20" width="27" height="60" fill="none" stroke="white" strokeWidth="0.6" />
            <rect x="3" y="32" width="18" height="36" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="17" cy="50" r="1" fill="white" />
            <rect x="70" y="20" width="27" height="60" fill="none" stroke="white" strokeWidth="0.6" />
            <rect x="79" y="32" width="18" height="36" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="83" cy="50" r="1" fill="white" />
          </>
        ) : (
          <>
            <rect x="20" y="70" width="60" height="27" fill="none" stroke="white" strokeWidth="0.6" />
            <rect x="32" y="79" width="36" height="18" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="50" cy="83" r="1" fill="white" />
            <rect x="20" y="3" width="60" height="27" fill="none" stroke="white" strokeWidth="0.6" />
            <rect x="32" y="3" width="36" height="18" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="50" cy="17" r="1" fill="white" />
          </>
        )}
      </svg>


      {/* placeholders for empty slots */}
      {placeholders.map(({ role, x, y, idx }) => (
        <div
          key={`${role}-ghost-${idx}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="rounded-full p-[2px] bg-gradient-to-br from-base-100/40 to-base-100/10">
            <div className="grid h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 place-items-center rounded-full border-2 border-dashed border-white/50 text-white/70">
              <span className="text-xs sm:text-sm md:text-base font-black tracking-wide">{role}</span>
            </div>
          </div>
        </div>
      ))}

      {/* pins + tooltips + popovers */}
      <TooltipProvider delayDuration={120}>
        {spots.map(({ p, x, y }) => {
          const isC = captainId === p.id;
          const isV = viceCaptainId === p.id;
          const isLocked = locked?.has(p.id);
          const isExcluded = excluded?.has(p.id);
          const inXI = xiIds.has(p.id);

          return (
            <div
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <Popover>
                <Tooltip>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        {/* soft colored glow behind the pin */}
                        <span
                          className={cx(
                            "pointer-events-none absolute -inset-2 rounded-full blur-md opacity-70",
                            roleGlow(p.role)
                          )}
                          aria-hidden
                        />
                        {/* clickable pin */}
                        <button
                          type="button"
                          className={cx(
                            "relative rounded-full p-[2px]",
                            "bg-gradient-to-br from-brand-primary via-brand-primary/70 to-brand-secondary",
                            "shadow-[0_6px_16px_-6px_rgba(0,0,0,0.4)]"
                          )}
                          aria-label={`${p.name} ${p.role}`}
                        >
                          <span className="grid h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 place-items-center rounded-full bg-background/90 text-foreground ring-2 ring-white/20 backdrop-blur-md">
                            <span className="text-xs sm:text-sm md:text-base font-extrabold tracking-wide">{p.role}</span>
                            {/* risk dot */}
                            <span className={cx("absolute -top-1 -left-1 rounded-full", "h-2.5 w-2.5", riskDot(p.risk))} />
                            {/* C/VC */}
                            {captainId === p.id && (
                              <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1 text-[10px] font-black shadow">C</span>
                            )}
                            {captainId !== p.id && viceCaptainId === p.id && (
                              <span className="absolute -top-1 -right-1 rounded-full bg-sky-400 px-1 text-[10px] font-black shadow">VC</span>
                            )}
                          </span>
                        </button>
                      </div>
                    </TooltipTrigger>
                  </PopoverTrigger>

                  {/* Hover tooltip with quick info */}
                  <TooltipContent side="top" align="center" className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <Badge variant="outline">{p.role}</Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {(p.team ? p.team + " " : "") + (p.opponent ?? "")}
                      {p.kickoff ? ` · ${p.kickoff}` : ""}
                    </div>
                    <div className="mt-1 flex gap-3">
                      {typeof p.xiProb === "number" && (
                        <div>XI {Math.round(p.xiProb * 100)}%</div>
                      )}
                      {typeof p.xFP === "number" && <div>xFP {p.xFP.toFixed(1)}</div>}
                    </div>
                    {p.news && (
                      <div className="mt-2 max-w-[260px] rounded-md border bg-base-100 p-2">
                        <div className={`mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${sentimentChip(p.sentiment)}`}>
                          <Newspaper className="h-3 w-3" />
                          News
                        </div>
                        <div className="text-[12px] leading-snug whitespace-pre-wrap text-content-100">
                          {p.news}
                        </div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>

                {/* Click popover with actions */}
                <PopoverContent side="top" align="center" className="w-56 p-3">
                  <div className="mb-2">
                    <div className="text-sm font-semibold leading-none">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(p.team ? p.team + " " : "") + (p.opponent ?? "")}
                      {p.kickoff ? ` · ${p.kickoff}` : ""}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {onCaptain && (
                      <Button size="sm" variant="secondary" onClick={() => onCaptain(p.id)} className="gap-2">
                        <Crown className="h-4 w-4" /> {isC ? "Unset C" : "Set C"}
                      </Button>
                    )}
                    {onViceCaptain && (
                      <Button size="sm" variant="secondary" onClick={() => onViceCaptain(p.id)} className="gap-2">
                        <Medal className="h-4 w-4" /> {isV ? "Unset VC" : "Set VC"}
                      </Button>
                    )}
                    {onLock && (
                      <Button size="sm" variant="secondary" onClick={() => onLock(p.id)} className="gap-2">
                        {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {isLocked ? "Unlock" : "Lock"}
                      </Button>
                    )}
                    {onExclude && (
                      <Button size="sm" variant="secondary" onClick={() => onExclude(p.id)} className="gap-2">
                        <AlertTriangle className="h-4 w-4" /> {isExcluded ? "Include" : "Exclude"}
                      </Button>
                    )}
                    {onSendToBench && inXI && (
                      <Button size="sm" variant="secondary" onClick={() => onSendToBench(p.id)} className="gap-2 col-span-2">
                        <ArrowDownCircle className="h-4 w-4" /> Send to bench
                      </Button>
                    )}
                    {onAddToXI && !inXI && (
                      <Button size="sm" variant="secondary" onClick={() => onAddToXI(p.id)} className="gap-2 col-span-2">
                        <ArrowUpCircle className="h-4 w-4" /> Add to XI
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* label under pin (more legible) */}
              <div className="mt-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white shadow">
                {shortName(p.name)}
              </div>
            </div>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
