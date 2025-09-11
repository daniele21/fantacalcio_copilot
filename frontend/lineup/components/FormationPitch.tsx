"use client";

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
  Zap,
  Target,
} from "lucide-react";

// --- types ------------------------------------------------------------------

type Role = "POR" | "DIF" | "CEN" | "ATT";

function roleGlow(role: Role) {
  return role === "POR"
    ? "bg-gradient-to-br from-yellow-400/40 via-amber-400/30 to-orange-400/40"
    : role === "DIF"
    ? "bg-gradient-to-br from-blue-400/40 via-sky-400/30 to-cyan-400/40"
    : role === "CEN"
    ? "bg-gradient-to-br from-green-400/40 via-emerald-400/30 to-teal-400/40"
    : "bg-gradient-to-br from-red-400/40 via-rose-400/30 to-pink-400/40";
}

function roleColors(role: Role) {
  return role === "POR"
    ? "from-yellow-500 to-amber-600"
    : role === "DIF"
    ? "from-blue-500 to-sky-600"
    : role === "CEN"
    ? "from-green-500 to-emerald-600"
    : "from-red-500 to-rose-600";
}

// --- types ------------------------------------------------------------------

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
  aiReasoning?: string;  // AI reasoning for the player selection
};
// Helper for sentiment chip style
function sentimentChip(s: "positive" | "neutral" | "negative" = "neutral") {
  // Stronger color contrast for positive and negative
  switch (s) {
    case "positive":
      return "bg-gradient-to-r from-green-500 to-emerald-600 text-white border border-green-700/70 shadow-lg";
    case "negative":
      return "bg-gradient-to-r from-rose-500 to-red-600 text-white border border-rose-700/70 shadow-lg";
    default:
      return "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 border border-slate-300/70 shadow-sm";
  }
}

function riskDot(risk?: RiskTag) {
  return risk === "Safe" 
    ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-400/50" 
    : risk === "Upside" 
    ? "bg-gradient-to-br from-violet-400 to-purple-600 shadow-violet-400/50" 
    : "bg-gradient-to-br from-rose-400 to-red-600 shadow-rose-400/50";
}

type PitchSpot = { x: number; y: number };
type ModuleLayout = { POR: PitchSpot[]; DIF: PitchSpot[]; CEN: PitchSpot[]; ATT: PitchSpot[] };

// --- helpers ----------------------------------------------------------------

const cx = (...s: Array<string | false | undefined>) => s.filter(Boolean).join(" ");


// For placeholder logic
const ROLE_ORDER: Role[] = ["POR", "DIF", "CEN", "ATT"];

function shortName(n: string) {
  const parts = n.split(" ").filter(Boolean);
  
  // If only one word, truncate if too long
  if (parts.length === 1) {
    return parts[0].length > 8 ? parts[0].slice(0, 8) + "…" : parts[0];
  }
  
  // For multiple words, prefer last name
  const lastName = parts[parts.length - 1];
  
  // If last name is short enough, use it
  if (lastName.length <= 10) {
    return lastName;
  }
  
  // If last name is too long, try first name + last initial
  const firstName = parts[0];
  if (firstName.length <= 6) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }
  
  // Fallback: truncate last name
  return lastName.length > 8 ? lastName.slice(0, 8) + "…" : lastName;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function resolveCollisions(items: Array<{ p: PitchPlayer; spot: PitchSpot }>, orientation: "portrait" | "landscape" = "portrait") {
  const placed: Array<{ p: PitchPlayer; x: number; y: number }> = [];
  // Adjust minimum distance based on field orientation and size
  const MIN_DIST = orientation === "landscape" ? 8 : 6; // meters
  
  for (const { p, spot } of items) {
    let x = spot.x,
      y = spot.y,
      tries = 0;
    
    // Define field boundaries based on orientation
    const maxX = orientation === "landscape" ? 105 : 68;
    const maxY = orientation === "landscape" ? 68 : 105;
    
    while (placed.some((q) => Math.hypot(q.x - x, q.y - y) < MIN_DIST) && tries < 8) {
      const dir = tries % 2 ? -1 : 1;
      y = clamp(y + dir * 3, 3, maxY - 3);
      x = clamp(x + dir * 2, 3, maxX - 3);
      tries++;
    }
    placed.push({ p, x, y });
  }
  return placed;
}

// portrait (top->bottom) - coordinates in meters for 68x105 field
function layoutPortrait(m: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 34, y: 95 }]; // Goalkeeper near goal
  if (m === "4-3-3")
    return {
      POR,
      DIF: [10, 22, 46, 58].map((x) => ({ x, y: 78 })), // Defense line
      CEN: [14, 34, 54].map((x) => ({ x, y: 58 })), // Midfield line
      ATT: [20, 34, 48].map((x) => ({ x, y: 30 })), // Attack line
    };
  if (m === "3-4-3")
    return {
      POR,
      DIF: [17, 34, 51].map((x) => ({ x, y: 78 })), // 3 defenders
      CEN: [10, 25, 43, 58].map((x) => ({ x, y: 58 })), // 4 midfielders
      ATT: [19, 34, 49].map((x) => ({ x, y: 30 })), // 3 attackers
    };
  if (m === "4-4-2")
    return {
      POR,
      DIF: [10, 22, 46, 58].map((x) => ({ x, y: 78 })), // 4 defenders
      CEN: [12, 26, 42, 56].map((x) => ({ x, y: 58 })), // 4 midfielders
      ATT: [26, 42].map((x) => ({ x, y: 32 })), // 2 attackers
    };
  // 3-5-2
  return {
    POR,
    DIF: [17, 34, 51].map((x) => ({ x, y: 78 })), // 3 defenders
    CEN: [8, 21, 34, 47, 60].map((x) => ({ x, y: 58 })), // 5 midfielders
    ATT: [26, 42].map((x) => ({ x, y: 32 })), // 2 attackers
  };
}

// landscape (left->right) - coordinates in meters for 105x68 field
function layoutLandscape(m: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 10, y: 34 }]; // Goalkeeper near goal
  if (m === "4-3-3")
    return {
      POR,
      DIF: [27, 27, 27, 27].map((x, i) => ({ x, y: [10, 22, 46, 58][i] })), // Defense line
      CEN: [47, 47, 47].map((x, i) => ({ x, y: [14, 34, 54][i] })), // Midfield line
      ATT: [75, 75, 75].map((x, i) => ({ x, y: [20, 34, 48][i] })), // Attack line
    };
  if (m === "3-4-3")
    return {
      POR,
      DIF: [27, 27, 27].map((x, i) => ({ x, y: [17, 34, 51][i] })), // 3 defenders
      CEN: [47, 47, 47, 47].map((x, i) => ({ x, y: [10, 25, 43, 58][i] })), // 4 midfielders
      ATT: [75, 75, 75].map((x, i) => ({ x, y: [19, 34, 49][i] })), // 3 attackers
    };
  if (m === "4-4-2")
    return {
      POR,
      DIF: [27, 27, 27, 27].map((x, i) => ({ x, y: [10, 22, 46, 58][i] })), // 4 defenders
      CEN: [47, 47, 47, 47].map((x, i) => ({ x, y: [12, 26, 42, 56][i] })), // 4 midfielders
      ATT: [75, 75].map((x, i) => ({ x, y: [26, 42][i] })), // 2 attackers
    };
  // 3-5-2
  return {
    POR,
    DIF: [27, 27, 27].map((x, i) => ({ x, y: [17, 34, 51][i] })), // 3 defenders
    CEN: [47, 47, 47, 47, 47].map((x, i) => ({ x, y: [8, 21, 34, 47, 60][i] })), // 5 midfielders
    ATT: [75, 75].map((x, i) => ({ x, y: [26, 42][i] })), // 2 attackers
  };
}

// --- component --------------------------------------------------------------

function FormationPitch({
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

  const spots = resolveCollisions(spotsRaw, orientation);

  // Convert field coordinates to percentage positions for display
  const convertToPercentage = (coord: { x: number; y: number }) => {
    if (orientation === "landscape") {
      // For landscape: 105m x 68m field
      return {
        x: (coord.x / 105) * 100,
        y: (coord.y / 68) * 100
      };
    } else {
      // For portrait: 68m x 105m field
      return {
        x: (coord.x / 68) * 100,
        y: (coord.y / 105) * 100
      };
    }
  };

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
      const percentageCoords = convertToPercentage(c);
      placeholders.push({ role: r, x: percentageCoords.x, y: percentageCoords.y, idx: i });
    }
  });


  // --- Modern pitch container and SVG ---
  return (
    <div
      className={cx(
        "relative block w-full rounded-3xl border-2 border-white/20 overflow-hidden",
        "bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800",
        "shadow-2xl shadow-green-900/40",
        "before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/10 before:to-transparent",
        orientation === "landscape" ? "aspect-[105/68]" : "aspect-[68/105]",
        className
      )}
    >
      {/* Enhanced pitch texture */}
      <div className="absolute inset-0 opacity-30">
        <div
          className={
            orientation === "landscape"
              ? "h-full w-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_6%,transparent_6%,transparent_12%)]"
              : "h-full w-full bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_6%,transparent_6%,transparent_12%)]"
          }
        />
      </div>

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full bg-gradient-to-br from-white/5 via-transparent to-black/5" />
      </div>

      {/* Enhanced field lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={orientation === "landscape" ? "0 0 105 68" : "0 0 68 105"}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Common stroke style */}
        <g fill="none" stroke="white" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)">
          {orientation === "landscape" ? (
            // ===== Landscape (105 x 68) =====
            <>
              {/* Outer boundary */}
              <rect x="0" y="0" width="105" height="68" opacity="0.95" />

              {/* Halfway line */}
              <line x1="52.5" y1="0" x2="52.5" y2="68" opacity="0.95" />

              {/* Centre circle + spot */}
              <circle cx="52.5" cy="34" r="9.15" opacity="0.95" />
              <circle cx="52.5" cy="34" r="0.4" fill="white" stroke="none" />

              {/* Penalty areas (16.5m deep, 40.32m wide) */}
              <rect x="0" y={34 - 20.16} width="16.5" height="40.32" />
              <rect x={105 - 16.5} y={34 - 20.16} width="16.5" height="40.32" />

              {/* Goal areas (5.5m deep, 18.32m wide) */}
              <rect x="0" y={34 - 9.16} width="5.5" height="18.32" />
              <rect x={105 - 5.5} y={34 - 9.16} width="5.5" height="18.32" />

              {/* Penalty spots (11m) */}
              <circle cx="11" cy="34" r="0.4" fill="white" stroke="none" />
              <circle cx={105 - 11} cy="34" r="0.4" fill="white" stroke="none" />

              {/* Penalty arcs (radius 9.15m, outside the box) */}
              <path d={`M 16.5 ${34 - 7.31} A 9.15 9.15 0 0 1 16.5 ${34 + 7.31}`} />
              <path d={`M ${105 - 16.5} ${34 - 7.31} A 9.15 9.15 0 0 0 ${105 - 16.5} ${34 + 7.31}`} />

              {/* Corner arcs (1m) */}
              <path d="M 1 0 A 1 1 0 0 1 0 1" />
              <path d="M 104 0 A 1 1 0 0 0 105 1" />
              <path d="M 0 67 A 1 1 0 0 0 1 68" />
              <path d="M 105 67 A 1 1 0 0 1 104 68" />
            </>
          ) : (
            // ===== Portrait (68 x 105) =====
            <>
              {/* Outer boundary */}
              <rect x="0" y="0" width="68" height="105" opacity="0.95" />

              {/* Halfway line */}
              <line x1="0" y1="52.5" x2="68" y2="52.5" opacity="0.95" />

              {/* Centre circle + spot */}
              <circle cx="34" cy="52.5" r="9.15" opacity="0.95" />
              <circle cx="34" cy="52.5" r="0.4" fill="white" stroke="none" />

              {/* Penalty areas */}
              <rect x={34 - 20.16} y="0" width="40.32" height="16.5" />
              <rect x={34 - 20.16} y={105 - 16.5} width="40.32" height="16.5" />

              {/* Goal areas */}
              <rect x={34 - 9.16} y="0" width="18.32" height="5.5" />
              <rect x={34 - 9.16} y={105 - 5.5} width="18.32" height="5.5" />

              {/* Penalty spots */}
              <circle cx="34" cy="11" r="0.4" fill="white" stroke="none" />
              <circle cx="34" cy={105 - 11} r="0.4" fill="white" stroke="none" />

              {/* Penalty arcs (outside the box) */}
              <path d={`M ${34 - 7.31} 16.5 A 9.15 9.15 0 0 0 ${34 + 7.31} 16.5`} />
              <path d={`M ${34 - 7.31} ${105 - 16.5} A 9.15 9.15 0 0 1 ${34 + 7.31} ${105 - 16.5}`} />

              {/* Corner arcs (1m) */}
              <path d="M 0 1 A 1 1 0 0 1 1 0" />
              <path d="M 67 0 A 1 1 0 0 1 68 1" />
              <path d="M 0 104 A 1 1 0 0 0 1 105" />
              <path d="M 67 105 A 1 1 0 0 0 68 104" />
            </>
          )}
        </g>
      </svg>


      {/* placeholders for empty slots */}
      {placeholders.map(({ role, x, y, idx }) => (
        <div
          key={`${role}-ghost-${idx}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 opacity-60 transition-all duration-300 hover:opacity-80 hover:scale-105"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="rounded-full p-[2px] bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm">
            <div className="grid h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 place-items-center rounded-full border-2 border-dashed border-white/60 bg-white/10 text-white/80 backdrop-blur-sm">
              <span className="text-xs sm:text-sm md:text-base font-black tracking-wide drop-shadow-lg">{role}</span>
            </div>
          </div>
        </div>
      ))}

      {/* pins + tooltips + popovers */}
      <TooltipProvider delayDuration={120}>
        {spots.map(({ p, x, y }) => {
          const percentageCoords = convertToPercentage({ x, y });
          const isC = captainId === p.id;
          const isV = viceCaptainId === p.id;
          const isLocked = locked?.has(p.id);
          const isExcluded = excluded?.has(p.id);
          const inXI = xiIds.has(p.id);

          return (
            <div
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 hover:z-10"
              style={{ left: `${percentageCoords.x}%`, top: `${percentageCoords.y}%` }}
            >
              <Popover>
                <Tooltip>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <div className="relative group">
                        {/* Enhanced glow behind the pin */}
                        <span
                          className={cx(
                            "pointer-events-none absolute -inset-3 rounded-full blur-lg opacity-70",
                            "transition-all duration-300 group-hover:opacity-90 group-hover:blur-xl group-hover:-inset-4",
                            roleGlow(p.role)
                          )}
                          aria-hidden
                        />
                        {/* clickable pin with enhanced styling */}
                        <button
                          type="button"
                          className={cx(
                            "relative rounded-full p-[3px] transition-all duration-300",
                            "bg-gradient-to-br from-white/90 via-white/70 to-white/50",
                            "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
                            "group-hover:scale-105 active:scale-95"
                          )}
                          aria-label={`${p.name} ${p.role}`}
                        >
                          <span className={cx(
                            "grid h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 place-items-center rounded-full",
                            "bg-gradient-to-br", roleColors(p.role),
                            "text-white ring-2 ring-white/30 backdrop-blur-md",
                            "shadow-inner transition-all duration-300 group-hover:ring-white/50"
                          )}>
                            <span className="text-xs sm:text-sm md:text-base font-extrabold tracking-wide drop-shadow-lg">{p.role}</span>
                            {/* Enhanced risk dot with shadow */}
                            <span className={cx(
                              "absolute -top-1 -left-1 rounded-full shadow-lg",
                              "h-3 w-3 transition-all duration-300 group-hover:scale-110",
                              riskDot(p.risk)
                            )} />
                            {/* Enhanced C/VC badges */}
                            {captainId === p.id && (
                              <span className="absolute -top-1 -right-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                                <Crown className="h-3 w-3" />
                              </span>
                            )}
                            {captainId !== p.id && viceCaptainId === p.id && (
                              <span className="absolute -top-1 -right-1 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                                <Medal className="h-3 w-3" />
                              </span>
                            )}
                            {/* Probability indicator */}
                            {typeof p.xiProb === "number" && p.xiProb > 0 && (
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                                <div className="h-1 w-8 bg-black/20 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${p.xiProb * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </span>
                        </button>
                      </div>
                    </TooltipTrigger>
                  </PopoverTrigger>

                  {/* Enhanced hover tooltip with quick info */}
                  <TooltipContent side="top" align="center" className="text-xs bg-black/90 border-white/20 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">{p.name}</span>
                      <Badge variant="outline" className={cx("text-white border-white/30", `bg-gradient-to-r ${roleColors(p.role)}`)}>{p.role}</Badge>
                    </div>
                    <div className="text-white/80 mb-2">
                      {(p.team ? p.team + " " : "") + (p.opponent ?? "")}
                      {p.kickoff ? ` · ${p.kickoff}` : ""}
                    </div>
                    <div className="flex gap-4 mb-3">
                      {typeof p.xiProb === "number" && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-green-400" />
                          <span className="text-green-400 font-semibold">XI {Math.round(p.xiProb * 100)}%</span>
                        </div>
                      )}
                      {typeof p.xFP === "number" && (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-400" />
                          <span className="text-yellow-400 font-semibold">xFP {p.xFP.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {p.news && (
                      <div className="mt-3 max-w-[280px] rounded-lg border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                        <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${sentimentChip(p.sentiment)}`}>
                          <Newspaper className="h-3 w-3" />
                          News
                        </div>
                        <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-white/90">
                          {p.news}
                        </div>
                      </div>
                    )}
                    {p.aiReasoning && (
                      <div className="mt-3 max-w-[320px] rounded-lg border border-purple-300/40 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 p-3 backdrop-blur-sm">
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold bg-gradient-to-r from-purple-400 to-indigo-500 text-white border border-purple-300/50">
                          🤖 AI Insight
                        </div>
                        <div className="text-[12px] leading-relaxed text-white/95">
                          {p.aiReasoning}
                        </div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>

                {/* Enhanced click popover with actions */}
                <PopoverContent side="top" align="center" className="w-64 p-4 bg-black/90 border-white/20 backdrop-blur-xl">
                  <div className="mb-3">
                    <div className="text-sm font-semibold leading-none text-white mb-1">{p.name}</div>
                    <div className="text-xs text-white/70">
                      {(p.team ? p.team + " " : "") + (p.opponent ?? "")}
                      {p.kickoff ? ` · ${p.kickoff}` : ""}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {onCaptain && (
                      <Button 
                        size="sm" 
                        variant={isC ? "default" : "secondary"} 
                        onClick={() => onCaptain(p.id)} 
                        className={cx(
                          "gap-2 transition-all duration-200",
                          isC ? "bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700" : ""
                        )}
                      >
                        <Crown className="h-4 w-4" /> {isC ? "Unset C" : "Set C"}
                      </Button>
                    )}
                    {onViceCaptain && (
                      <Button 
                        size="sm" 
                        variant={isV ? "default" : "secondary"} 
                        onClick={() => onViceCaptain(p.id)} 
                        className={cx(
                          "gap-2 transition-all duration-200",
                          isV ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700" : ""
                        )}
                      >
                        <Medal className="h-4 w-4" /> {isV ? "Unset VC" : "Set VC"}
                      </Button>
                    )}
                    {onLock && (
                      <Button 
                        size="sm" 
                        variant={isLocked ? "destructive" : "secondary"} 
                        onClick={() => onLock(p.id)} 
                        className="gap-2 transition-all duration-200"
                      >
                        {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {isLocked ? "Unlock" : "Lock"}
                      </Button>
                    )}
                    {onExclude && (
                      <Button 
                        size="sm" 
                        variant={isExcluded ? "destructive" : "secondary"} 
                        onClick={() => onExclude(p.id)} 
                        className="gap-2 transition-all duration-200"
                      >
                        <AlertTriangle className="h-4 w-4" /> {isExcluded ? "Include" : "Exclude"}
                      </Button>
                    )}
                    {onSendToBench && inXI && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onSendToBench(p.id)} 
                        className="gap-2 col-span-2 border-white/20 hover:bg-white/10 transition-all duration-200"
                      >
                        <ArrowDownCircle className="h-4 w-4" /> Send to bench
                      </Button>
                    )}
                    {onAddToXI && !inXI && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onAddToXI(p.id)} 
                        className="gap-2 col-span-2 border-white/20 hover:bg-white/10 transition-all duration-200"
                      >
                        <ArrowUpCircle className="h-4 w-4" /> Add to XI
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Enhanced label under pin */}
              <div className="mt-3 flex items-center justify-center">
                <div className="rounded-full bg-gradient-to-r from-black/90 via-black/95 to-black/90 px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-white shadow-xl backdrop-blur-md border border-white/30 transition-all duration-300 group-hover:scale-105 group-hover:border-white/50 group-hover:shadow-2xl">
                  <span className="block text-center leading-none tracking-wide drop-shadow-sm">
                    {shortName(p.name)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </TooltipProvider>
    </div>
  );
}

export default FormationPitch;
