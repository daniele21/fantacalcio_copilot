import { Button } from "@/components/ui/button";
import { Crown, Lock, Unlock, AlertTriangle } from "lucide-react";
import { Player } from "./types";

export type MiniActionsProps = {
  p: Player;
  onCaptain: (id: string) => void;
  captainId: string | null;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  locked: Set<string>;
  excluded: Set<string>;
};

export default function MiniActions({ p, onCaptain, captainId, onLock, onExclude, locked, excluded }: MiniActionsProps) {
  const isCaptain = captainId === p.id;
  const isLocked = locked.has(p.id);
  const isExcluded = excluded.has(p.id);
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant={isCaptain ? "secondary" : "ghost"}
        className={
          isCaptain
            ? "bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition"
            : "hover:bg-base-200 transition"
        }
        onClick={() => onCaptain(p.id)}
        title={isCaptain ? "Unset captain" : "Set captain"}
      >
        <Crown className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={isLocked ? "secondary" : "ghost"}
        className={
          isLocked
            ? "bg-base-300 text-content-100 hover:bg-base-300/90 focus-visible:ring-2 focus-visible:ring-base-300/50 transition"
            : "hover:bg-base-200 transition"
        }
        onClick={() => onLock(p.id)}
        title={isLocked ? "Unlock" : "Lock in XI"}
      >
        {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant={isExcluded ? "secondary" : "ghost"}
        className={
          isExcluded
            ? "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-destructive/50 transition"
            : "hover:bg-base-200 transition"
        }
        onClick={() => onExclude(p.id)}
        title={isExcluded ? "Include again" : "Exclude this week"}
      >
        <AlertTriangle className="h-4 w-4" />
      </Button>
    </div>
  );
}
export { MiniActions };
