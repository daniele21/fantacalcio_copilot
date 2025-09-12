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
  // Enhanced minimum distance for better mobile touch targets
  const isMobileDevice = typeof window !== 'undefined' && (
    window.innerWidth < 768 || 
    'ontouchstart' in window || 
    navigator.maxTouchPoints > 0
  );
  const MIN_DIST = isMobileDevice 
    ? (orientation === "landscape" ? 8 : 7) // Increased mobile spacing
    : (orientation === "landscape" ? 6 : 5); // Desktop spacing
  
  for (const { p, spot } of items) {
    let x = spot.x,
      y = spot.y,
      tries = 0;
    
    // Define field boundaries based on orientation
    const maxX = orientation === "landscape" ? 100 : 66;
    const maxY = orientation === "landscape" ? 66 : 100;
    
    while (placed.some((q) => Math.hypot(q.x - x, q.y - y) < MIN_DIST) && tries < 8) {
      const dir = tries % 2 ? -1 : 1;
      y = clamp(y + dir * 2, 2, maxY - 2);
      x = clamp(x + dir * 1.5, 2, maxX - 2);
      tries++;
    }
    placed.push({ p, x, y });
  }
  return placed;
}

// portrait (top->bottom) - coordinates for 66x100 field
function layoutPortrait(m: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 33, y: 90 }]; // Goalkeeper moved up slightly
  if (m === "4-3-3")
    return {
      POR,
      DIF: [10, 25, 40, 55].map((x) => ({ x, y: 70 })), // Defense line moved up
      CEN: [15, 33, 51].map((x) => ({ x, y: 50 })), // Midfield line moved up
      ATT: [17, 33, 49].map((x) => ({ x, y: 22 })), // Attack line moved up
    };
  if (m === "3-4-3")
    return {
      POR,
      DIF: [17, 33, 49].map((x) => ({ x, y: 70 })), // 3 defenders moved up
      CEN: [8, 23, 43, 58].map((x) => ({ x, y: 50 })), // 4 midfielders moved up
      ATT: [15, 33, 51].map((x) => ({ x, y: 22 })), // 3 attackers moved up
    };
  if (m === "4-4-2")
    return {
      POR,
      DIF: [10, 25, 40, 55].map((x) => ({ x, y: 70 })), // 4 defenders moved up
      CEN: [12, 24, 42, 54].map((x) => ({ x, y: 50 })), // 4 midfielders moved up
      ATT: [23, 43].map((x) => ({ x, y: 25 })), // 2 attackers moved up
    };
  // 3-5-2
  return {
    POR,
    DIF: [17, 33, 49].map((x) => ({ x, y: 70 })), // 3 defenders moved up
    CEN: [6, 19, 33, 47, 60].map((x) => ({ x, y: 50 })), // 5 midfielders moved up
    ATT: [23, 43].map((x) => ({ x, y: 25 })), // 2 attackers moved up
  };
}

// landscape (left->right) - coordinates for 100x66 field
function layoutLandscape(m: Module): ModuleLayout {
  const POR: PitchSpot[] = [{ x: 6, y: 33 }]; // Goalkeeper moved up slightly
  if (m === "4-3-3")
    return {
      POR,
      DIF: [18, 18, 18, 18].map((x, i) => ({ x, y: [10, 20, 46, 56][i] })), // Defense line moved up
      CEN: [43, 43, 43].map((x, i) => ({ x, y: [15, 33, 51][i] })), // Midfield line moved up
      ATT: [78, 78, 78].map((x, i) => ({ x, y: [17, 33, 49][i] })), // Attack line moved up
    };
  if (m === "3-4-3")
    return {
      POR,
      DIF: [18, 18, 18].map((x, i) => ({ x, y: [17, 33, 49][i] })), // 3 defenders moved up
      CEN: [43, 43, 43, 43].map((x, i) => ({ x, y: [8, 23, 43, 58][i] })), // 4 midfielders moved up
      ATT: [78, 78, 78].map((x, i) => ({ x, y: [15, 33, 51][i] })), // 3 attackers moved up
    };
  if (m === "4-4-2")
    return {
      POR,
      DIF: [18, 18, 18, 18].map((x, i) => ({ x, y: [10, 20, 46, 56][i] })), // 4 defenders moved up
      CEN: [43, 43, 43, 43].map((x, i) => ({ x, y: [12, 24, 42, 54][i] })), // 4 midfielders moved up
      ATT: [75, 75].map((x, i) => ({ x, y: [23, 43][i] })), // 2 attackers moved up
    };
  // 3-5-2
  return {
    POR,
    DIF: [18, 18, 18].map((x, i) => ({ x, y: [17, 33, 49][i] })), // 3 defenders moved up
    CEN: [43, 43, 43, 43, 43].map((x, i) => ({ x, y: [6, 19, 33, 47, 60][i] })), // 5 midfielders moved up
    ATT: [75, 75].map((x, i) => ({ x, y: [23, 43][i] })), // 2 attackers moved up
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

  // Enhanced mobile detection with viewport and touch support
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth < 768 || 
    'ontouchstart' in window || 
    navigator.maxTouchPoints > 0
  );
  const isSmallMobile = typeof window !== 'undefined' && window.innerWidth < 400;
  // Use portrait for mobile, landscape for desktop by default
  const actualOrientation = isMobile ? "portrait" : (orientation === "portrait" ? "portrait" : "landscape");
  
  const layout = actualOrientation === "landscape" ? layoutLandscape(module) : layoutPortrait(module);

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

  const spots = resolveCollisions(spotsRaw, actualOrientation);

  // Convert field coordinates to percentage positions for display
  const convertToPercentage = (coord: { x: number; y: number }) => {
    if (actualOrientation === "landscape") {
      // For landscape: 100 x 66 field
      return {
        x: (coord.x / 100) * 100,
        y: (coord.y / 66) * 100
      };
    } else {
      // For portrait: 66 x 100 field
      return {
        x: (coord.x / 66) * 100,
        y: (coord.y / 100) * 100
      };
    }
  };

  // --- Placeholders for empty slots (ghost pins) ---
  // Use the same layout logic as the main spots
  const moduleLayout = actualOrientation === "landscape" ? layoutLandscape : layoutPortrait;
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
        "relative block w-full rounded-2xl md:rounded-3xl border-2 border-white/20 overflow-hidden",
        // Enhanced mobile-friendly container
        "bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800",
        "shadow-xl md:shadow-2xl shadow-green-900/40",
        "before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/10 before:to-transparent",
        // Enhanced aspect ratio with mobile optimization
        actualOrientation === "landscape" ? "aspect-[3/2]" : "aspect-[2/3]",
        // Mobile-specific improvements
        isMobile && "touch-pan-y select-none rounded-xl border border-white/30 shadow-lg shadow-green-900/30",
        // Small mobile optimizations
        isSmallMobile && "rounded-lg border-white/40",
        className
      )}
    >
      {/* Enhanced pitch texture with mobile optimization */}
      <div className={cx(
        "absolute inset-0",
        // Responsive opacity
        "opacity-20 sm:opacity-30",
        // Mobile-specific opacity
        isMobile && "opacity-25",
        isSmallMobile && "opacity-20"
      )}>
        <div
          className={
            actualOrientation === "landscape"
              ? "h-full w-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_6%,transparent_6%,transparent_12%)]"
              : "h-full w-full bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_6%,transparent_6%,transparent_12%)]"
          }
        />
      </div>

      {/* Enhanced subtle noise texture with mobile optimization */}
      <div className={cx(
        "absolute inset-0",
        // Responsive opacity
        "opacity-15 sm:opacity-20",
        // Mobile-specific opacity
        isMobile && "opacity-18",
        isSmallMobile && "opacity-15"
      )}>
        <div className="w-full h-full bg-gradient-to-br from-white/5 via-transparent to-black/5" />
      </div>

      {/* Enhanced realistic field lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={actualOrientation === "landscape" ? "0 0 100 66" : "0 0 66 100"}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="fieldGlow">
            <feGaussianBlur stdDeviation={isMobile ? "0.25" : "0.5"} result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="50%" stopColor={isMobile ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.95)"} />
            <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
          </linearGradient>
          {/* Mobile-optimized glow filter */}
          {isMobile && (
            <filter id="mobileGlow">
              <feGaussianBlur stdDeviation="0.2" result="mobileBlur"/>
              <feMerge> 
                <feMergeNode in="mobileBlur"/>
                <feMergeNode in="SourceGraphic"/> 
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Enhanced field markings with mobile optimization */}
        <g fill="none" stroke="url(#lineGradient)" 
           strokeWidth={isMobile ? (isSmallMobile ? "0.35" : "0.4") : "0.6"} 
           strokeLinecap="round" strokeLinejoin="round" 
           filter={isMobile ? "url(#mobileGlow)" : "url(#fieldGlow)"}>
          {actualOrientation === "landscape" ? (
            // ===== Landscape (100 x 66) =====
            <>
              {/* Outer boundary covering full field */}
              <rect x="0" y="0" width="100" height="66" opacity="0.9" />

              {/* Halfway line */}
              <line x1="50" y1="0" x2="50" y2="66" opacity="0.85" />

              {/* Centre circle */}
              <circle cx="50" cy="33" r="8.5" opacity="0.8" fill="none" />
              {/* Centre spot */}
              <circle cx="50" cy="33" r="0.3" fill="white" stroke="none" opacity="0.9" />

              {/* Penalty areas (18-yard box) */}
              <rect x="0" y={33 - 19} width="15.5" height="38" opacity="0.85" />
              <rect x="84.5" y={33 - 19} width="15.5" height="38" opacity="0.85" />

              {/* Goal areas (6-yard box) */}
              <rect x="0" y={33 - 8.5} width="5" height="17" opacity="0.85" />
              <rect x="95" y={33 - 8.5} width="5" height="17" opacity="0.85" />

              {/* Goals */}
              <rect x="-1" y={33 - 3.5} width="1" height="7" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="0.2" />
              <rect x="100" y={33 - 3.5} width="1" height="7" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="0.2" />

              {/* Penalty spots */}
              <circle cx="10.5" cy="33" r="0.3" fill="white" stroke="none" opacity="0.9" />
              <circle cx="89.5" cy="33" r="0.3" fill="white" stroke="none" opacity="0.9" />

              {/* Penalty arcs */}
              <path d={`M 15.5 ${33 - 7} A 8.5 8.5 0 0 1 15.5 ${33 + 7}`} opacity="0.8" />
              <path d={`M 84.5 ${33 - 7} A 8.5 8.5 0 0 0 84.5 ${33 + 7}`} opacity="0.8" />

              {/* Corner arcs */}
              <path d="M 1 0 A 1 1 0 0 1 0 1" opacity="0.7" />
              <path d="M 99 0 A 1 1 0 0 0 100 1" opacity="0.7" />
              <path d="M 0 65 A 1 1 0 0 0 1 66" opacity="0.7" />
              <path d="M 100 65 A 1 1 0 0 1 99 66" opacity="0.7" />
            </>
          ) : (
            // ===== Portrait (66 x 100) - Full field coverage =====
            <>
              {/* Outer boundary covering full field */}
              <rect x="0" y="0" width="66" height="100" opacity="0.9" />

              {/* Halfway line with center circle */}
              <line x1="0" y1="50" x2="66" y2="50" opacity="0.85" strokeWidth={isMobile ? "0.5" : "0.6"} />

              {/* Centre circle */}
              <circle cx="33" cy="50" r="8.5" opacity="0.8" fill="none" />
              {/* Centre spot */}
              <circle cx="33" cy="50" r={isMobile ? "0.25" : "0.3"} fill="white" stroke="none" opacity="0.9" />

              {/* Penalty areas (18-yard box) - Top goal */}
              <rect x={33 - 19} y="0" width="38" height="15.5" opacity="0.85" />
              {/* Penalty areas (18-yard box) - Bottom goal */}
              <rect x={33 - 19} y="84.5" width="38" height="15.5" opacity="0.85" />

              {/* Goal areas (6-yard box) - Top goal */}
              <rect x={33 - 8.5} y="0" width="17" height="5" opacity="0.85" />
              {/* Goal areas (6-yard box) - Bottom goal */}
              <rect x={33 - 8.5} y="95" width="17" height="5" opacity="0.85" />

              {/* Goals */}
              <rect x={33 - 3.5} y="-1" width="7" height="1" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="0.2" />
              <rect x={33 - 3.5} y="100" width="7" height="1" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="0.2" />

              {/* Penalty spots */}
              <circle cx="33" cy="10.5" r={isMobile ? "0.25" : "0.3"} fill="white" stroke="none" opacity="0.9" />
              <circle cx="33" cy="89.5" r={isMobile ? "0.25" : "0.3"} fill="white" stroke="none" opacity="0.9" />

              {/* Penalty arcs */}
              <path d={`M ${33 - 7} 15.5 A 8.5 8.5 0 0 0 ${33 + 7} 15.5`} opacity="0.8" />
              <path d={`M ${33 - 7} 84.5 A 8.5 8.5 0 0 1 ${33 + 7} 84.5`} opacity="0.8" />

              {/* Corner arcs - optimized for mobile */}
              <path d="M 0 1 A 1 1 0 0 1 1 0" opacity={isMobile ? "0.6" : "0.7"} />
              <path d="M 65 0 A 1 1 0 0 1 66 1" opacity={isMobile ? "0.6" : "0.7"} />
              <path d="M 0 99 A 1 1 0 0 0 1 100" opacity={isMobile ? "0.6" : "0.7"} />
              <path d="M 66 99 A 1 1 0 0 0 65 100" opacity={isMobile ? "0.6" : "0.7"} />

              {/* Additional mobile optimizations */}
              {isMobile && (
                <>
                  {/* Simplified corner markings for mobile */}
                  <circle cx="0" cy="0" r="0.3" fill="rgba(255,255,255,0.5)" />
                  <circle cx="66" cy="0" r="0.3" fill="rgba(255,255,255,0.5)" />
                  <circle cx="0" cy="100" r="0.3" fill="rgba(255,255,255,0.5)" />
                  <circle cx="66" cy="100" r="0.3" fill="rgba(255,255,255,0.5)" />
                  
                  {/* Subtle goal line emphasis */}
                  <line x1="14" y1="0" x2="52" y2="0" strokeWidth="0.6" opacity="0.9" />
                  <line x1="14" y1="100" x2="52" y2="100" strokeWidth="0.6" opacity="0.9" />
                </>
              )}
            </>
          )}
        </g>
      </svg>


      {/* Enhanced placeholders for empty slots with mobile optimization */}
      {placeholders.map(({ role, x, y, idx }) => (
        <div
          key={`${role}-ghost-${idx}`}
          className={cx(
            "absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
            "opacity-50 sm:opacity-60 hover:opacity-80 hover:scale-105",
            // Mobile touch improvements
            isMobile && "opacity-40 active:opacity-70 active:scale-110"
          )}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className={cx(
            "rounded-full backdrop-blur-sm transition-all duration-300",
            "p-[1px] sm:p-[2px] bg-gradient-to-br from-white/30 to-white/10",
            // Enhanced mobile styling
            isMobile && "p-[1.5px] bg-gradient-to-br from-white/40 to-white/15"
          )}>
            <div className={cx(
              "grid place-items-center rounded-full border-2 border-dashed text-white/80 backdrop-blur-sm",
              "border-white/60 bg-white/10",
              // Responsive sizing with mobile optimization
              "h-8 w-8 text-[9px] font-black",
              "sm:h-10 sm:w-10 sm:text-[10px]",
              "md:h-12 md:w-12 md:text-xs",
              "lg:h-14 lg:w-14 lg:text-sm",
              // Mobile-specific enhancements
              isMobile && "h-9 w-9 text-[10px] border-white/70 bg-white/15 shadow-sm",
              isSmallMobile && "h-8 w-8 text-[9px]"
            )}>
              <span className="tracking-wide drop-shadow-lg">{role}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Enhanced pins + tooltips + popovers with mobile optimization */}
      <TooltipProvider delayDuration={isMobile ? 0 : 120}>
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
              className={cx(
                "absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
                // Enhanced mobile interactions
                "hover:scale-110 hover:z-10",
                isMobile && "active:scale-125 touch-manipulation",
                // Add tap highlight prevention
                "tap-highlight-transparent"
              )}
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
                            "pointer-events-none absolute -inset-2 sm:-inset-3 rounded-full blur-md sm:blur-lg opacity-50 sm:opacity-70",
                            "transition-all duration-300 group-hover:opacity-90 group-hover:blur-xl group-hover:-inset-3 sm:group-hover:-inset-4",
                            roleGlow(p.role)
                          )}
                          aria-hidden
                        />
                        {/* Enhanced clickable pin with mobile-optimized touch targets */}
                        <button
                          type="button"
                          className={cx(
                            "relative rounded-full transition-all duration-300",
                            "bg-gradient-to-br from-white/90 via-white/70 to-white/50",
                            // Enhanced shadows with mobile optimization
                            "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]",
                            "sm:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]",
                            "hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)]",
                            "sm:hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
                            // Mobile-specific touch improvements
                            isMobile && [
                              "active:shadow-[0_6px_20px_-2px_rgba(0,0,0,0.7)]",
                              "touch-manipulation",
                              "select-none",
                              "p-[3px]" // Larger touch target
                            ].filter(Boolean).join(" "),
                            !isMobile && "p-[2px] sm:p-[3px]",
                            // Enhanced interactions
                            "group-hover:scale-105 active:scale-95"
                          )}
                          aria-label={`${p.name} ${p.role}`}
                        >
                          <span className={cx(
                            "grid place-items-center rounded-full transition-all duration-300",
                            "bg-gradient-to-br", roleColors(p.role),
                            "text-white backdrop-blur-md shadow-inner",
                            "ring-1 sm:ring-2 ring-white/30 group-hover:ring-white/50",
                            // Enhanced responsive sizing with mobile optimization
                            "h-9 w-9 text-[9px]", // Base mobile size
                            "xs:h-10 xs:w-10 xs:text-[10px]", // Small mobile
                            "sm:h-12 sm:w-12 sm:text-xs", // Tablet
                            "md:h-14 md:w-14 md:text-sm", // Desktop
                            "lg:h-16 lg:w-16 lg:text-base", // Large desktop
                            // Mobile-specific enhancements
                            isMobile && "h-10 w-10 text-[10px] ring-2 ring-white/40",
                            isSmallMobile && "h-9 w-9 text-[9px] ring-1"
                          )}>
                            <span className="font-extrabold tracking-wide drop-shadow-lg">{p.role}</span>
                            {/* Enhanced risk dot with mobile-optimized sizing */}
                            <span className={cx(
                              "absolute rounded-full shadow-lg transition-all duration-300",
                              "group-hover:scale-110",
                              // Responsive positioning and sizing
                              "-top-0.5 -left-0.5 h-2.5 w-2.5",
                              "sm:-top-1 sm:-left-1 sm:h-3 sm:w-3",
                              // Mobile-specific improvements
                              isMobile && "-top-1 -left-1 h-3 w-3 shadow-xl",
                              isSmallMobile && "-top-0.5 -left-0.5 h-2.5 w-2.5",
                              riskDot(p.risk)
                            )} />
                            
                            {/* Enhanced C/VC badges with mobile optimization */}
                            {captainId === p.id && (
                              <span className={cx(
                                "absolute rounded-full bg-gradient-to-r from-amber-400 to-yellow-500",
                                "font-black text-white shadow-lg transition-all duration-300 group-hover:scale-110",
                                // Responsive sizing and positioning
                                "-top-0.5 -right-0.5 px-1 py-0.5 text-[8px]",
                                "sm:-top-1 sm:-right-1 sm:px-1.5 sm:py-0.5 sm:text-[10px]",
                                // Mobile-specific improvements
                                isMobile && "-top-1 -right-1 px-1.5 py-0.5 text-[9px] shadow-xl",
                                isSmallMobile && "-top-0.5 -right-0.5 px-1 py-0.5 text-[8px]"
                              )}>
                                <Crown className={cx(
                                  "h-2.5 w-2.5 sm:h-3 sm:w-3",
                                  isMobile && "h-3 w-3",
                                  isSmallMobile && "h-2.5 w-2.5"
                                )} />
                              </span>
                            )}
                            {captainId !== p.id && viceCaptainId === p.id && (
                              <span className={cx(
                                "absolute rounded-full bg-gradient-to-r from-sky-400 to-blue-500",
                                "font-black text-white shadow-lg transition-all duration-300 group-hover:scale-110",
                                // Responsive sizing and positioning
                                "-top-0.5 -right-0.5 px-1 py-0.5 text-[8px]",
                                "sm:-top-1 sm:-right-1 sm:px-1.5 sm:py-0.5 sm:text-[10px]",
                                // Mobile-specific improvements
                                isMobile && "-top-1 -right-1 px-1.5 py-0.5 text-[9px] shadow-xl",
                                isSmallMobile && "-top-0.5 -right-0.5 px-1 py-0.5 text-[8px]"
                              )}>
                                <Medal className={cx(
                                  "h-2.5 w-2.5 sm:h-3 sm:w-3",
                                  isMobile && "h-3 w-3",
                                  isSmallMobile && "h-2.5 w-2.5"
                                )} />
                              </span>
                            )}
                            {/* Enhanced probability indicator with mobile optimization */}
                            {typeof p.xiProb === "number" && p.xiProb > 0 && (
                              <div className={cx(
                                "absolute left-1/2 -translate-x-1/2",
                                // Responsive positioning
                                "-bottom-0.5 sm:-bottom-1",
                                // Mobile-specific positioning
                                isMobile && "-bottom-1",
                                isSmallMobile && "-bottom-0.5"
                              )}>
                                <div className={cx(
                                  "bg-black/20 rounded-full overflow-hidden",
                                  // Responsive sizing
                                  "h-0.5 w-6 sm:h-1 sm:w-8",
                                  // Mobile-specific sizing
                                  isMobile && "h-1 w-7",
                                  isSmallMobile && "h-0.5 w-6"
                                )}>
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

                  {/* Enhanced hover tooltip with mobile-optimized content */}
                  <TooltipContent 
                    side={isMobile ? "top" : "top"} 
                    align="center" 
                    className={cx(
                      "text-xs bg-black/90 border-white/20 backdrop-blur-xl",
                      // Enhanced mobile sizing and positioning
                      isMobile ? "max-w-[260px] p-3" : "max-w-[320px]",
                      isSmallMobile && "max-w-[240px] p-2"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white text-xs sm:text-sm">{p.name}</span>
                      <Badge variant="outline" className={cx("text-white border-white/30 text-[10px] sm:text-xs", `bg-gradient-to-r ${roleColors(p.role)}`)}>{p.role}</Badge>
                    </div>
                    <div className="text-white/80 mb-2 text-[10px] sm:text-xs">
                      {(p.team ? p.team + " " : "") + (p.opponent ?? "")}
                      {p.kickoff ? ` · ${p.kickoff}` : ""}
                    </div>
                    <div className="flex gap-3 sm:gap-4 mb-3">
                      {typeof p.xiProb === "number" && (
                        <div className="flex items-center gap-1">
                          <Target className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-400" />
                          <span className="text-green-400 font-semibold text-[10px] sm:text-xs">XI {Math.round(p.xiProb * 100)}%</span>
                        </div>
                      )}
                      {typeof p.xFP === "number" && (
                        <div className="flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-400" />
                          <span className="text-yellow-400 font-semibold text-[10px] sm:text-xs">xFP {p.xFP.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {p.news && !isMobile && (
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
                    {p.aiReasoning && !isMobile && (
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
                <PopoverContent side="top" align="center" className={cx(
                  "bg-black/90 border-white/20 backdrop-blur-xl p-3 sm:p-4",
                  isMobile ? "w-56" : "w-64"
                )}>
                  <div className="mb-3">
                    <div className="text-sm font-semibold leading-none text-white mb-1">{p.name}</div>
                    <div className="text-xs text-white/70">
                      {(p.team ? p.team + " " : "") + (p.opponent ?? "")}
                      {p.kickoff ? ` · ${p.kickoff}` : ""}
                    </div>
                  </div>
                  
                  {/* Mobile-optimized action buttons */}
                  <div className={cx(
                    "grid gap-1.5 sm:gap-2",
                    isMobile ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    {onCaptain && (
                      <Button 
                        size="sm" 
                        variant={isC ? "default" : "secondary"} 
                        onClick={() => onCaptain(p.id)} 
                        className={cx(
                          "gap-2 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-auto",
                          isC ? "bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700" : ""
                        )}
                      >
                        <Crown className="h-3 w-3 sm:h-4 sm:w-4" /> {isC ? "Unset C" : "Set C"}
                      </Button>
                    )}
                    {onViceCaptain && (
                      <Button 
                        size="sm" 
                        variant={isV ? "default" : "secondary"} 
                        onClick={() => onViceCaptain(p.id)} 
                        className={cx(
                          "gap-2 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-auto",
                          isV ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700" : ""
                        )}
                      >
                        <Medal className="h-3 w-3 sm:h-4 sm:w-4" /> {isV ? "Unset VC" : "Set VC"}
                      </Button>
                    )}
                    {onLock && (
                      <Button 
                        size="sm" 
                        variant={isLocked ? "destructive" : "secondary"} 
                        onClick={() => onLock(p.id)} 
                        className="gap-2 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-auto"
                      >
                        {isLocked ? <Unlock className="h-3 w-3 sm:h-4 sm:w-4" /> : <Lock className="h-3 w-3 sm:h-4 sm:w-4" />}
                        {isLocked ? "Unlock" : "Lock"}
                      </Button>
                    )}
                    {onExclude && (
                      <Button 
                        size="sm" 
                        variant={isExcluded ? "destructive" : "secondary"} 
                        onClick={() => onExclude(p.id)} 
                        className="gap-2 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-auto"
                      >
                        <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" /> {isExcluded ? "Include" : "Exclude"}
                      </Button>
                    )}
                    {onSendToBench && inXI && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onSendToBench(p.id)} 
                        className={cx(
                          "gap-2 border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-auto",
                          isMobile ? "col-span-1" : "col-span-2"
                        )}
                      >
                        <ArrowDownCircle className="h-3 w-3 sm:h-4 sm:w-4" /> Send to bench
                      </Button>
                    )}
                    {onAddToXI && !inXI && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onAddToXI(p.id)} 
                        className={cx(
                          "gap-2 border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-auto",
                          isMobile ? "col-span-1" : "col-span-2"
                        )}
                      >
                        <ArrowUpCircle className="h-3 w-3 sm:h-4 sm:w-4" /> Add to XI
                      </Button>
                    )}
                  </div>
                  
                  {/* Mobile-specific additional info */}
                  {isMobile && (p.news || p.aiReasoning) && (
                    <div className="mt-3 pt-3 border-t border-white/20">
                      {p.news && (
                        <div className="mb-2">
                          <div className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${sentimentChip(p.sentiment)}`}>
                            <Newspaper className="h-2.5 w-2.5" />
                            News
                          </div>
                          <div className="text-[10px] leading-relaxed text-white/80 line-clamp-3">
                            {p.news}
                          </div>
                        </div>
                      )}
                      {p.aiReasoning && (
                        <div>
                          <div className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold bg-gradient-to-r from-purple-400 to-indigo-500 text-white">
                            🤖 AI
                          </div>
                          <div className="text-[10px] leading-relaxed text-white/80 line-clamp-3">
                            {p.aiReasoning}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Enhanced label under pin with mobile optimization */}
              <div className={cx(
                "flex items-center justify-center",
                // Responsive spacing
                "mt-2 sm:mt-3",
                // Mobile-specific spacing
                isMobile && "mt-2.5",
                isSmallMobile && "mt-2"
              )}>
                <div className={cx(
                  "rounded-full bg-gradient-to-r from-black/90 via-black/95 to-black/90",
                  "text-white backdrop-blur-md border transition-all duration-300",
                  "group-hover:scale-105 group-hover:border-white/50 group-hover:shadow-2xl",
                  // Responsive sizing and styling
                  "px-2 py-1 text-[9px] font-bold shadow-lg border-white/20",
                  "sm:px-3 sm:py-1.5 sm:text-[10px] sm:shadow-xl sm:border-white/30",
                  "md:text-[11px]",
                  // Mobile-specific enhancements
                  isMobile && [
                    "px-2.5 py-1 text-[10px] font-extrabold",
                    "shadow-xl border-white/40",
                    "active:scale-110 active:shadow-2xl"
                  ].filter(Boolean).join(" "),
                  isSmallMobile && "px-2 py-1 text-[9px] shadow-lg"
                )}>
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
