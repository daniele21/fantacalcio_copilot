import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Zap, Crown, Medal, Lock, Unlock, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Player, Module, RiskTag, Role } from "./types";
import { riskPillClasses } from "./riskPillClasses";

// --- Pitch layout helpers ---
type PitchSpot = { x: number; y: number };
type ModuleLayout = { POR: PitchSpot[]; DIF: PitchSpot[]; CEN: PitchSpot[]; ATT: PitchSpot[] };

function moduleLayout(module: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 50, y: 92 }];
  switch (module) {
    case "4-3-3":
      return {
        POR,
        DIF: [10, 32.5, 67.5, 90].map((x) => ({ x, y: 72 })),
        CEN: [18, 50, 82].map((x) => ({ x, y: 52 })),
        ATT: [33, 50, 67].map((x) => ({ x, y: 30 })),
      };
    case "3-4-3":
      return {
        POR,
        DIF: [20, 50, 80].map((x) => ({ x, y: 72 })),
        CEN: [10, 35, 65, 90].map((x) => ({ x, y: 52 })),
        ATT: [25, 50, 75].map((x) => ({ x, y: 30 })),
      };
    case "4-4-2":
      return {
        POR,
        DIF: [10, 32.5, 67.5, 90].map((x) => ({ x, y: 72 })),
        CEN: [12, 38, 62, 88].map((x) => ({ x, y: 52 })),
        ATT: [40, 60].map((x) => ({ x, y: 32 })),
      };
    case "3-5-2":
      return {
        POR,
        DIF: [20, 50, 80].map((x) => ({ x, y: 72 })),
        CEN: [8, 30, 50, 70, 92].map((x) => ({ x, y: 52 })),
        ATT: [40, 60].map((x) => ({ x, y: 32 })),
      };
    default:
      return { POR, DIF: [], CEN: [], ATT: [] } as ModuleLayout;
  }
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function resolveCollisions(items: Array<{ p: Player; spot: PitchSpot }>) {
  const placed: Array<{ p: Player; x: number; y: number }> = [];
  const MIN_DIST = 8;
  items.forEach(({ p, spot }) => {
    let x = spot.x; let y = spot.y; let tries = 0;
    while (
      placed.some((q) => Math.hypot(q.x - x, q.y - y) < MIN_DIST) && tries < 8
    ) {
      const dir = tries % 2 === 0 ? 1 : -1;
      y += dir * 4;
      x += dir * 1.5;
      x = clamp(x, 6, 94); y = clamp(y, 6, 94);
      tries++;
    }
    placed.push({ p, x, y });
  });
  return placed;
}

function roleRing(role: Role) {
  switch (role) {
    case "POR": return "ring-sky-400";
    case "DIF": return "ring-emerald-400";
    case "CEN": return "ring-indigo-400";
    case "ATT": return "ring-rose-400";
  }
}

function riskDot(risk: RiskTag) {
  switch (risk) {
    case "Safe": return "bg-emerald-500";
    case "Upside": return "bg-violet-500";
    default: return "bg-rose-500";
  }
}

function shortName(full: string) {
  const parts = full.split(" ").filter(Boolean);
  const last = parts[parts.length - 1] || full;
  return last.length > 9 ? last.slice(0, 9) + "…" : last;
}

export type FormationPitchProps = {
  module: Module;
  players: Player[];
  xiIds: Set<string>;
  captainId: string | null;
  viceCaptainId: string | null;
  onCaptain: (id: string) => void;
  onViceCaptain: (id: string) => void;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  onAddToXI: (id: string) => void;
  onSendToBench: (id: string) => void;
  locked: Set<string>;
  excluded: Set<string>;
};


import { useCallback } from "react";

export default function FormationPitch({ module, players, xiIds, captainId, viceCaptainId, onCaptain, onViceCaptain, onLock, onExclude, onAddToXI, onSendToBench, locked, excluded }: FormationPitchProps) {
  const layout = moduleLayout(module);
  // For each spot, fill with player if present, else placeholder
  const roleOrder: Role[] = ["POR", "DIF", "CEN", "ATT"];
  // Map role to players (in order)
  const playersByRole: Record<Role, Player[]> = {
    POR: players.filter((p) => p.role === "POR"),
    DIF: players.filter((p) => p.role === "DIF"),
    CEN: players.filter((p) => p.role === "CEN"),
    ATT: players.filter((p) => p.role === "ATT"),
  };
  // Build a list of {role, spot, player|null}
  const allSpots: Array<{ role: Role; spot: PitchSpot; player: Player | null }> = [];
  roleOrder.forEach((role) => {
    const coords = (layout as any)[role] as PitchSpot[];
    const rolePlayers = playersByRole[role];
    coords.forEach((spot, i) => {
      allSpots.push({ role, spot, player: rolePlayers[i] || null });
    });
  });

  // Clean all handler: send all XI players to bench
  const handleCleanAll = useCallback(() => {
    players.forEach((p) => {
      if (xiIds.has(p.id)) onSendToBench(p.id);
    });
  }, [players, xiIds, onSendToBench]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col gap-2 w-full max-w-xl mx-auto">
        <div className="flex justify-end mb-1">
          <Button
            variant="destructive"
            size="sm"
            className="rounded-lg px-3 py-1 text-xs font-semibold shadow-md border border-destructive/30"
            onClick={handleCleanAll}
            title="Remove all players from XI"
          >
            Clean All
          </Button>
        </div>
        <div className="relative z-50 w-full aspect-[3/4] overflow-hidden rounded-2xl border bg-gradient-to-b from-green-900 via-green-700 to-green-950">
        {/* Subtle pitch stripes overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full grid grid-cols-8 opacity-25">
            <div className="bg-white/10" />
            <div className="bg-white/0" />
            <div className="bg-white/10" />
            <div className="bg-white/0" />
            <div className="bg-white/10" />
            <div className="bg-white/0" />
            <div className="bg-white/10" />
            <div className="bg-white/0" />
          </div>
        </div>
        {/* White lines via SVG */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <rect x="3" y="-10" width="94" height="120" fill="none" stroke="white" strokeWidth="0.8" />
          <line x1="3" y1="50" x2="97" y2="50" stroke="white" strokeWidth="0.6" />
          {/* Center circle: ensure perfect circle by using correct aspect ratio */}
          <circle cx="50" cy="50" r="8" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="20" y="83" width="60" height="27" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="32" y="92" width="36" height="18" fill="none" stroke="white" strokeWidth="0.6" />
          <circle cx="50" cy="96" r="0.9" fill="white" />
          <rect x="20" y="-10" width="60" height="27" fill="none" stroke="white" strokeWidth="0.6" />
          <rect x="32" y="-10" width="36" height="18" fill="none" stroke="white" strokeWidth="0.6" />
          <circle cx="50" cy="4" r="0.9" fill="white" />
        </svg>
        {/* Players and placeholders */}
        {allSpots.map(({ role, spot, player }, idx) =>
          player ? (
            <PlayerPin
              key={player.id}
              p={player}
              x={spot.x}
              y={spot.y}
              isInXI={xiIds.has(player.id)}
              captainId={captainId}
              viceCaptainId={viceCaptainId}
              onCaptain={onCaptain}
              onViceCaptain={onViceCaptain}
              onLock={onLock}
              onExclude={onExclude}
              onAddToXI={onAddToXI}
              onSendToBench={onSendToBench}
              locked={locked}
              excluded={excluded}
            />
          ) : (
            <div
              key={`placeholder-${role}-${idx}`}
              className="absolute flex flex-col items-center gap-1"
              style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-dashed border-base-200 bg-base-100/60 flex items-center justify-center opacity-60`}>
                <span className="text-2xl text-base-300 font-bold select-none">?</span>
              </div>
              <span className="rounded-md bg-base-100/80 px-2 py-0.5 text-xs leading-none text-content-200 font-semibold border border-base-200 mt-1 opacity-60 select-none">
                {role}
              </span>
            </div>
          )
        )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function PlayerPin({ p, x, y, isInXI, captainId, viceCaptainId, onCaptain, onViceCaptain, onLock, onExclude, onAddToXI, onSendToBench, locked, excluded }: {
  p: Player;
  x: number; y: number;
  isInXI: boolean;
  captainId: string | null;
  viceCaptainId: string | null;
  onCaptain: (id: string) => void;
  onViceCaptain: (id: string) => void;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  onAddToXI: (id: string) => void;
  onSendToBench: (id: string) => void;
  locked: Set<string>;
  excluded: Set<string>;
}) {
  const tag = riskPillClasses(p.risk);
  const isCaptain = captainId === p.id;
  const isVice = viceCaptainId === p.id;
  const isLocked = locked.has(p.id);
  const isExcluded = excluded.has(p.id);
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`group relative flex flex-col items-center gap-1 focus:outline-none`} aria-label={`${p.name}, ${p.role}`}>
            {/* Jersey circle */}
            <div className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-b from-brand-primary to-brand-secondary text-content-100 grid place-items-center ring-4 ${roleRing(p.role)} shadow-2xl transition-transform group-active:scale-95 border-2 border-base-100/80`}>
              {/* Risk dot */}
              <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${riskDot(p.risk)} ring-2 ring-background`} />
              {/* Captain badge */}
              {isCaptain && (
                <span className="absolute -top-2 -left-2 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-[10px] font-bold text-amber-950 ring-2 ring-background">C</span>
              )}
              {isVice && !isCaptain && (
                <span className="absolute -top-2 -left-2 grid h-5 w-5 place-items-center rounded-full bg-sky-500 text-[10px] font-bold text-sky-950 ring-2 ring-background">VC</span>
              )}
              {/* Role letters */}
              <span className="text-[11px] font-bold">{p.role}</span>
            </div>
            {/* Tiny name label */}
            <span className="rounded-md bg-base-100/95 px-2 py-0.5 text-xs leading-none text-content-100 font-semibold shadow-lg border border-base-300 mt-1">
              {shortName(p.name)}
            </span>
          </button>
        </PopoverTrigger>
  <PopoverContent side="top" align="center" className="w-72 p-5 rounded-xl border border-base-300 shadow-lg bg-base-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-content-100">{p.name} <span className="text-xs text-content-200">{p.role}</span></div>
              <div className="text-xs text-content-200">{p.team} {p.opponent} · {p.kickoff}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant={isCaptain ? "secondary" : "ghost"}
                className={
                  isCaptain
                    ? "h-7 w-7 bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition"
                    : "h-7 w-7 hover:bg-base-200 transition"
                }
                onClick={() => onCaptain(p.id)}
                title={isCaptain ? "Unset captain" : "Set captain"}
              >
                <Crown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant={isVice ? "secondary" : "ghost"}
                className={
                  isVice
                    ? "h-7 w-7 bg-secondary text-content-100 hover:bg-secondary/90 focus-visible:ring-2 focus-visible:ring-secondary/50 transition"
                    : "h-7 w-7 hover:bg-base-200 transition"
                }
                onClick={() => onViceCaptain(p.id)}
                title={isVice ? "Unset vice-captain" : "Set vice-captain"}
              >
                <Medal className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant={isLocked ? "secondary" : "ghost"}
                className={
                  isLocked
                    ? "h-7 w-7 bg-brand-primary text-brand-secondary border-2 border-brand-primary ring-2 ring-brand-primary/40 hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/60 transition shadow-lg"
                    : "h-7 w-7 hover:bg-base-200 transition"
                }
                onClick={() => onLock(p.id)}
                title={isLocked ? "Unlock" : "Lock in XI"}
              >
                {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant={isExcluded ? "secondary" : "ghost"}
                className={
                  isExcluded
                    ? "h-7 w-7 bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-destructive/50 transition"
                    : "h-7 w-7 hover:bg-base-200 transition"
                }
                onClick={() => onExclude(p.id)}
                title={isExcluded ? "Include again" : "Exclude this week"}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-brand-primary" /> xFP <span className="font-semibold">{p.xFP.toFixed(1)}</span> <span className="text-xs text-content-200">({p.ciLow.toFixed(1)}–{p.ciHigh.toFixed(1)})</span></div>
            <div className="text-xs">XI {Math.round(p.xiProb * 100)}%</div>
          </div>
          <div className="mt-2 text-xs text-content-200">
            <span className={`px-2 py-0.5 mr-2 rounded-full ${tag}`}>{p.risk}</span>
            {p.setPieces?.pens ? "Takes pens" : p.setPieces?.fks || p.setPieces?.corners ? "Set-pieces share" : "Open-play"} · ~{p.expMinutes}'
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {!isInXI ? (
              <Button variant="secondary" className="gap-2" onClick={() => onAddToXI(p.id)}><ArrowUpCircle className="h-4 w-4" /> Add to XI</Button>
            ) : (
              <Button variant="secondary" className="gap-2" onClick={() => onSendToBench(p.id)}><ArrowDownCircle className="h-4 w-4" /> Send to bench</Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {/* Quick hover tooltip (read-only) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="sr-only">info</span>
        </TooltipTrigger>
        <TooltipContent className="bg-brand-primary/90 border-2 border-brand-secondary text-brand-secondary px-4 py-3 shadow-2xl rounded-xl">
          <div className="text-xs font-semibold">
            <span className="text-base-100">xFP</span> <span className="text-lg font-bold text-white">{p.xFP.toFixed(1)}</span> <span className="text-base-100">({p.ciLow.toFixed(1)}–{p.ciHigh.toFixed(1)})</span> <span className="mx-1 text-base-100">•</span> <span className="text-base-100">XI</span> <span className="text-lg font-bold text-secondary">{Math.round(p.xiProb * 100)}%</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
