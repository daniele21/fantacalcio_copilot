import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle } from "lucide-react";
import { MiniActions } from "./MiniActions";
import { Player } from "./types";

export type PlayerRowProps = {
  p: Player;
  index: number;
  onCaptain: (id: string) => void;
  captainId: string | null;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  onAddToXI: (id: string) => void;
  locked: Set<string>;
  excluded: Set<string>;
};


export default function PlayerRow({ p, index, onCaptain, captainId, onLock, onExclude, onAddToXI, locked, excluded }: PlayerRowProps) {
  const isC = captainId === p.id;
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-100 dark:bg-base-900 p-3 sm:p-4 shadow-sm transition-shadow hover:shadow-md ${isC ? "ring-2 ring-brand-primary/40" : ""}`}
    >
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-brand-primary/30 border-2 font-bold text-xs px-2 py-1 min-w-7 flex justify-center items-center">{index}</Badge>
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-semibold text-content-100 flex flex-wrap items-center gap-2">
            <span className="truncate max-w-[120px] sm:max-w-[180px]">{p.name}</span>
            <span className="text-xs sm:text-sm text-content-200 font-bold uppercase tracking-wide">{p.role}</span>
            {isC && <span className="rounded-md bg-brand-primary px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary">C</span>}
          </div>
          <div className="text-xs sm:text-sm text-content-200 flex flex-wrap gap-1">
            <span>{p.team}</span>
            <span>{p.opponent}</span>
            <span>· XI {Math.round(p.xiProb * 100)}%</span>
            <span>· xFP {p.xFP.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <Button
          size="icon"
          variant="secondary"
          className="bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition"
          title="Add to XI"
          onClick={() => onAddToXI(p.id)}
        >
          <ArrowUpCircle className="h-4 w-4" />
        </Button>
        <MiniActions p={p} onCaptain={onCaptain} captainId={captainId} onLock={onLock} onExclude={onExclude} locked={locked} excluded={excluded} />
      </div>
    </div>
  );
}
