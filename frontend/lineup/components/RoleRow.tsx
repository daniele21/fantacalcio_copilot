"use client";
import React, { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PlayerStripCard, { StripPlayer } from "./PlayerStripCard";

export default function RoleRow({
  title,
  players,
  xiIds,
  onAddToXI,
  onSendToBench,
  onLock,
  onExclude,
  captainId,
  onCaptain,
}: {
  title: string;
  players: StripPlayer[];
  xiIds: Set<string>;
  onAddToXI: (id: string) => void;
  onSendToBench: (id: string) => void;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  captainId: string | null;
  onCaptain: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const inXI = useMemo(() => players.reduce((n, p) => n + (xiIds.has(p.id) ? 1 : 0), 0), [players, xiIds]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  const nudge = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(260, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-2">
      {/* title + count */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold tracking-wide text-brand-primary">{title}</div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {inXI}/{players.length} in XI
        </Badge>
      </div>

      <div className="relative">
        {/* gradient fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent rounded-l-md" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent rounded-r-md" />

        {/* horizontal scroller; `grid` prevents flex-wrap overlap */}
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className={[
            "grid auto-cols-[minmax(260px,268px)] grid-flow-col gap-3",
            "overflow-x-auto pb-2 snap-x snap-mandatory",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ].join(" ")}
        >
          {players.map((p) => (
            <PlayerStripCard
              key={p.id}
              p={p}
              isInXI={xiIds.has(p.id)}
              onAddToXI={onAddToXI}
              onSendToBench={onSendToBench}
              onLock={onLock}
              onExclude={onExclude}
              captainId={captainId}
              onCaptain={onCaptain}
            />
          ))}
        </div>

        {/* nudge buttons */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-1">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-7 w-7 rounded-full border bg-background/90 backdrop-blur-sm transition disabled:opacity-40"
            onClick={() => nudge("left")}
            disabled={atStart}
            aria-label="Scroll left"
            title="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-7 w-7 rounded-full border bg-background/90 backdrop-blur-sm transition disabled:opacity-40"
            onClick={() => nudge("right")}
            disabled={atEnd}
            aria-label="Scroll right"
            title="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
