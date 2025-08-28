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
    <div className="space-y-1.5">
      {/* <div className="sticky top-0 z-10 flex items-center gap-2 bg-base-100/80 backdrop-blur-sm py-1"> */}
        {/* <div className="text-xs font-semibold tracking-wide text-brand-primary">{title}</div> */}
      {/* </div> */}

      <div className="relative">
        {/* edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-base-100 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-base-100 to-transparent" />

        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </div>
    </div>
  );
}
