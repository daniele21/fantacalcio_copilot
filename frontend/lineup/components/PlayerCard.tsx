import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Crown, Medal, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Player } from "./types";
import { riskPillClasses } from "./riskPillClasses";
import MiniActions from "./MiniActions";

export type PlayerCardProps = {
  p: Player;
  isInXI?: boolean;
  onCaptain: (id: string) => void;
  onViceCaptain: (id: string) => void;
  captainId: string | null;
  viceCaptainId: string | null;
  onLock: (id: string) => void;
  onExclude: (id: string) => void;
  onAddToXI: (id: string) => void;
  onSendToBench: (id: string) => void;
  locked: Set<string>;
  excluded: Set<string>;
};


// Role-based background color, matching preparation view, with light/dark and solid color
const getRoleBgClass = (role: string) => {
  switch (role) {
    case 'POR':
    return 'dark:bg-yellow-900 dark:text-yellow-300';
    case 'DIF':
    return 'dark:bg-blue-900 dark:text-blue-300';
    case 'CEN':
    return 'dark:bg-green-900 dark:text-green-300';
    case 'ATT':
    return 'dark:bg-red-900 dark:text-red-300';
  }
};



export default function PlayerCard({ p, isInXI, onCaptain, onViceCaptain, captainId, viceCaptainId, onLock, onExclude, onAddToXI, onSendToBench, locked, excluded }: PlayerCardProps) {
  const tag = riskPillClasses(p.risk);
  const isC = captainId === p.id;
  const isVC = viceCaptainId === p.id;
  const roleBg = getRoleBgClass(p.role);
  return (
    <Card
      className={`relative border border-base-300 rounded-2xl shadow-lg transition-shadow hover:shadow-2xl overflow-hidden ${roleBg} ${isInXI ? "ring-2 ring-brand-primary/40" : ""} px-3 py-2 sm:px-5 sm:py-4 flex flex-col min-w-0 w-full max-w-md mx-auto`}
    >
      <CardHeader className="pb-2 px-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base sm:text-lg font-semibold leading-none truncate max-w-[120px] sm:max-w-[180px] text-white">{p.name}</span>
              <Badge variant="outline" className="uppercase tracking-wide px-2 py-0.5 text-xs sm:text-sm font-bold border-2 border-base-300">{p.role}</Badge>
              {isC && <span className="rounded-md bg-brand-primary px-1.5 py-0.5 text-[10px] font-semibold text-brand-secondary">C</span>}
              {isVC && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-content-100">VC</span>}
              <span className={`px-2 py-0.5 text-[10px] rounded-full ${tag}`}>{p.risk}</span>
            </div>
            <div className="text-xs text-content-100 truncate max-w-[180px] sm:max-w-none">{p.team} {p.opponent} · {p.kickoff}</div>
          </div>
          <div className="flex items-center gap-1 mt-2 sm:mt-0">
            <Button size="icon" variant={isC ? "default" : "ghost"} className={isC ? "bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition" : "hover:bg-base-200 transition"} onClick={() => onCaptain(p.id)} title={isC ? "Unset captain" : "Set captain"}>
              <Crown className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={isVC ? "default" : "ghost"} className={isVC ? "bg-secondary text-content-100 hover:bg-secondary/90 focus-visible:ring-2 focus-visible:ring-secondary/50 transition" : "hover:bg-base-200 transition"} onClick={() => onViceCaptain(p.id)} title={isVC ? "Unset vice-captain" : "Set vice-captain"}>
              <Medal className="h-4 w-4" />
            </Button>
            <MiniActions p={p} onCaptain={onCaptain} captainId={captainId} onLock={onLock} onExclude={onExclude} locked={locked} excluded={excluded} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-0">
        <div className="flex flex-col sm:flex-row items-center justify-between text-sm gap-1 w-full">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> xFP <span className="font-semibold">{p.xFP.toFixed(1)}</span> <span className="text-xs text-content-100">({p.ciLow.toFixed(1)}–{p.ciHigh.toFixed(1)})</span></div>
          <div className="text-xs">XI {Math.round(p.xiProb * 100)}%</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
          <div className="h-full bg-brand-primary transition-all duration-500" style={{ width: `${p.xiProb * 100}%` }} />
        </div>
        <ul className="list-disc pl-5 text-sm text-content-100 space-y-1">
          <li>Form: {p.risk === "Safe" ? "stable" : p.risk === "Upside" ? "high ceiling" : "rotation risk"}</li>
          <li>Minutes: ~{p.expMinutes}' expected</li>
          <li>{p.setPieces?.pens ? "Takes pens" : p.setPieces?.fks || p.setPieces?.corners ? "Set-pieces share" : "Open-play"}</li>
        </ul>
        <div className="flex justify-end pt-1 w-full">
          {isInXI ? (
            <Button variant="secondary" size="sm" className="gap-2 bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition" onClick={() => onSendToBench(p.id)}>
              <ArrowDownCircle className="h-4 w-4" /> <span className="hidden xs:inline">Bench</span>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="gap-2 bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition" onClick={() => onAddToXI(p.id)}>
              <ArrowUpCircle className="h-4 w-4" /> <span className="hidden xs:inline">Add to XI</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
