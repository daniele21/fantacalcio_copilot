"use client";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PlayerStripCard, { StripPlayer } from "./PlayerStripCard";

export default function RoleRow({
  players,
  xiIds,
  onAddToXI,
  onSendToBench,
  onLock,
  onExclude,
  captainId,
  onCaptain,
  onRoleChange,
  aiRecommendations,
}: {
  title: string;
  players: StripPlayer[];
  xiIds: Set<string>;
  onAddToXI?: (id: string) => void;
  onSendToBench?: (id: string) => void;
  onLock?: (id: string) => void;
  onExclude?: (id: string) => void;
  captainId: string | null;
  onCaptain?: (id: string) => void;
  onRoleChange?: (playerId: string, newRole: string) => void;
  aiRecommendations?: { playerReasons: { [playerId: string]: string } } | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Debug opponent data
  console.log("🚀 RoleRow players data:", players.map(p => ({
    id: p.id,
    name: p.name,
    team: p.team,
    opponent: p.opponent,
    kickoff: p.kickoff
  })));

  // Initialize scroll state
  useEffect(() => {
    if (scrollerRef.current) {
      onScroll();
    }
  }, [players]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  const nudge = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    // Mobile: scroll by card width + gap, Desktop: scroll by viewport percentage
    const isMobile = window.innerWidth < 640; // sm breakpoint
    const amount = isMobile ? 240 : Math.max(260, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      {/* Navigation Buttons - Hidden on mobile, visible on desktop */}
      <Button
        variant="ghost"
        size="sm"
        className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg border border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 ${atStart ? 'pointer-events-none opacity-0' : ''}`}
        onClick={() => nudge("left")}
        disabled={atStart}
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-300" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-lg border border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 ${atEnd ? 'pointer-events-none opacity-0' : ''}`}
        onClick={() => nudge("right")}
        disabled={atEnd}
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-300" />
      </Button>

      {/* Gradient Overlays - Smaller on mobile */}
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-6 sm:w-12 bg-gradient-to-r from-slate-50 via-slate-50/70 to-transparent dark:from-slate-700/50 dark:via-slate-700/30 z-10 transition-opacity duration-200 ${atStart ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-6 sm:w-12 bg-gradient-to-l from-slate-50 via-slate-50/70 to-transparent dark:from-slate-700/50 dark:via-slate-700/30 z-10 transition-opacity duration-200 ${atEnd ? 'opacity-0' : 'opacity-100'}`} />

      {/* Scrollable Container - Mobile optimized */}
      <div 
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-2 sm:gap-4 overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1 sm:px-1"
      >
        {players.map((p) => (
          <div key={p.id} className="snap-start">
            <PlayerStripCard
              p={{
                ...p,
                aiReasoning: aiRecommendations?.playerReasons[p.id]
              }}
              isInXI={xiIds.has(p.id)}
              onAddToXI={onAddToXI}
              onSendToBench={onSendToBench}
              onLock={onLock}
              onExclude={onExclude}
              captainId={captainId}
              onCaptain={onCaptain}
              onRoleChange={onRoleChange}
            />
          </div>
        ))}
        {players.length === 0 && (
          <div className="flex items-center justify-center py-6 sm:py-8 px-4 sm:px-6 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-700/30 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 w-full min-w-[250px] sm:min-w-[300px]">
            <span className="text-xs sm:text-sm font-medium text-center">No players in this role</span>
          </div>
        )}
      </div>
    </div>
  );
}
