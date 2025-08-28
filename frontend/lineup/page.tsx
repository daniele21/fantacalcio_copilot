import { useMemo, useState } from "react";
import ImportTeamDialog from "@/components/ImportTeamDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, ShieldCheck, Zap, AlertTriangle, Crown, Medal, Lock, Unlock, Wand2, RefreshCw, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import SectionTitle from "./components/SectionTitle";
import PlayerRow from "./components/PlayerRow";
import PlayerCard from "./components/PlayerCard";
// import MiniActions from "./components/MiniActions"; // Only import if used directly
import RoleRow from "./components/RoleRow";
import FormationPitch from "./components/FormationPitch";

/**
 * Lineup Coach – Matchday Optimizer UI (MVP)
 *
 * Repo style notes:
 * - Use brand accents via shadcn `primary`/`secondary` (no monochrome).
 * - Solid buttons for primary actions, tinted badges, subtle primary rings.
 * - Progress and highlights use `bg-primary` + `ring-primary/30`.
 *
 * Update: Starting XI now rendered on a **soccer pitch** with SVG lines + green stripes.
 * Update 2: Add/Remove between XI and Bench via Popover actions & bench rows.
 * Update 3: 3-4-3 always fills 3 forwards (fallback ignores xiThreshold if needed).
 * Update 4: **Captain & Vice-captain suggestions** with one-click apply + VC badge & action.
 */

// --- Types -----------------------------------------------------------------

type Role = "POR" | "DIF" | "CEN" | "ATT";

type RiskTag = "Safe" | "Upside" | "Rotation";

type Player = {
  id: string;
  name: string;
  role: Role;
  team: string;
  opponent: string; // e.g., "vs JUV" / "@ INT"
  kickoff: string; // ISO or readable "Sat 18:00"
  xiProb: number; // 0..1
  expMinutes: number; // expected minutes 0..90
  xFP: number; // expected fantasy points
  ciLow: number; // conservative bound
  ciHigh: number; // upside bound
  risk: RiskTag;
  status?: "ok" | "injured" | "suspended" | "doubtful";
  setPieces?: { pens?: boolean; fks?: boolean; corners?: boolean };
  news?: string;
  sentiment?: "positive" | "neutral" | "negative";
};

type Module = "3-4-3" | "4-3-3" | "4-4-2" | "3-5-2";

// --- Mock Data (replace with real) -----------------------------------------

const MOCK_PLAYERS: Player[] = [
  // POR
  {
    id: "p1",
    name: "Meret",
    role: "POR",
    team: "NAP",
    opponent: "vs LEC",
    kickoff: "Sat 18:00",
    xiProb: 0.94,
    expMinutes: 90,
    xFP: 6.2,
    ciLow: 4.0,
    ciHigh: 9.0,
    risk: "Safe",
    news: "Allenamento completo: confermato titolare.",
    sentiment: "positive",
  },
  {
    id: "p2",
    name: "Skorupski",
    role: "POR",
    team: "BOL",
    opponent: "@ ROM",
    kickoff: "Sun 20:45",
    xiProb: 0.82,
    expMinutes: 90,
    xFP: 4.9,
    ciLow: 2.8,
    ciHigh: 8.1,
    risk: "Rotation",
    news: "Ballottaggio con Ravaglia: 60/40. Ultima prestazione sottotono.",
    sentiment: "negative",
  },
  // DIF
  { id: "p3", name: "Di Lorenzo", role: "DIF", team: "NAP", opponent: "vs LEC", kickoff: "Sat 18:00", xiProb: 0.96, expMinutes: 90, xFP: 7.1, ciLow: 5.0, ciHigh: 9.8, risk: "Safe", news: "Ottima forma, nessun problema fisico.", sentiment: "positive" },
  { id: "p4", name: "Bastoni", role: "DIF", team: "INT", opponent: "@ FIO", kickoff: "Sun 18:00", xiProb: 0.85, expMinutes: 82, xFP: 6.4, ciLow: 4.6, ciHigh: 9.0, risk: "Safe", news: "Gestione minutaggio: possibile 70-75'.", sentiment: "neutral" },
  { id: "p5", name: "Carlos Augusto", role: "DIF", team: "INT", opponent: "@ FIO", kickoff: "Sun 18:00", xiProb: 0.7, expMinutes: 68, xFP: 6.0, ciLow: 3.2, ciHigh: 9.6, risk: "Upside", news: "Ballottaggio con Dimarco, entra anche a gara in corso. Non al meglio fisicamente.", sentiment: "negative" },
  { id: "p6", name: "Darmian", role: "DIF", team: "INT", opponent: "@ FIO", kickoff: "Sun 18:00", xiProb: 0.76, expMinutes: 75, xFP: 5.8, ciLow: 4.1, ciHigh: 8.0, risk: "Safe" },
  // CEN
  { id: "p7", name: "Calhanoglu", role: "CEN", team: "INT", opponent: "@ FIO", kickoff: "Sun 18:00", xiProb: 0.92, expMinutes: 86, xFP: 8.1, ciLow: 5.1, ciHigh: 11.0, risk: "Safe", setPieces: { pens: true, fks: true, corners: true }, news: "Batte piazzati: alto impatto fantacalcio.", sentiment: "positive" },
  { id: "p8", name: "Barella", role: "CEN", team: "INT", opponent: "@ FIO", kickoff: "Sun 18:00", xiProb: 0.88, expMinutes: 84, xFP: 7.0, ciLow: 4.5, ciHigh: 9.4, risk: "Safe", news: "Buon momento, nessuna gestione segnalata.", sentiment: "positive" },
  { id: "p9", name: "Politano", role: "CEN", team: "NAP", opponent: "vs LEC", kickoff: "Sat 18:00", xiProb: 0.83, expMinutes: 78, xFP: 7.6, ciLow: 4.2, ciHigh: 10.8, risk: "Upside", setPieces: { fks: true, corners: true } },
  { id: "p10", name: "Rabiot", role: "CEN", team: "JUV", opponent: "@ MON", kickoff: "Mon 20:45", xiProb: 0.74, expMinutes: 72, xFP: 6.1, ciLow: 3.4, ciHigh: 9.0, risk: "Rotation", news: "Condizione da monitorare alla rifinitura. Problemi muscolari in settimana.", sentiment: "negative" },
  // ATT
  { id: "p11", name: "Osimhen", role: "ATT", team: "NAP", opponent: "vs LEC", kickoff: "Sat 18:00", xiProb: 0.91, expMinutes: 82, xFP: 9.5, ciLow: 6.0, ciHigh: 13.8, risk: "Safe", news: "Matchup favorevole, probabile titolare.", sentiment: "positive" },
  { id: "p12", name: "Thuram", role: "ATT", team: "INT", opponent: "@ FIO", kickoff: "Sun 18:00", xiProb: 0.79, expMinutes: 76, xFP: 8.0, ciLow: 5.0, ciHigh: 12.0, risk: "Upside", news: "Spazio in contropiede: può colpire.", sentiment: "positive" },
  { id: "p13", name: "Chiesa", role: "ATT", team: "JUV", opponent: "@ MON", kickoff: "Mon 20:45", xiProb: 0.68, expMinutes: 60, xFP: 6.9, ciLow: 3.0, ciHigh: 11.4, risk: "Rotation", news: "Da valutare: possibile gestione minuti. Non al meglio dopo l'allenamento.", sentiment: "negative" },
];

// Formation slots map
const MODULE_SLOTS: Record<Module, { POR: number; DIF: number; CEN: number; ATT: number }> = {
  "3-4-3": { POR: 1, DIF: 3, CEN: 4, ATT: 3 },
  "4-3-3": { POR: 1, DIF: 4, CEN: 3, ATT: 3 },
  "4-4-2": { POR: 1, DIF: 4, CEN: 4, ATT: 2 },
  "3-5-2": { POR: 1, DIF: 3, CEN: 5, ATT: 2 },
};

// --- Helpers (simple, replace with your optimizer later) -------------------

function adjustedScore(p: Player, riskLevel: number, preferDefModifier: boolean): number {
  // riskLevel: 0 (safe) .. 100 (upside)
  const base = p.xFP;
  const upsideBoost = (p.ciHigh - p.xFP) * (riskLevel / 100);
  const safetyBoost = (p.xFP - p.ciLow) * ((100 - riskLevel) / 100);
  const roleBonus = preferDefModifier && p.role === "DIF" ? 0.35 : 0;
  const xiPenalty = p.xiProb < 0.75 ? -0.75 : 0; // favor starters
  return base + upsideBoost * 0.5 + safetyBoost * 0.15 + roleBonus + xiPenalty;
}

function countByRole(list: Player[], role: Role) {
  return list.reduce((acc, p) => acc + (p.role === role ? 1 : 0), 0);
}

function selectRolePlayers(
  players: Player[],
  role: Role,
  count: number,
  riskLevel: number,
  preferDefModifier: boolean,
  locked: Set<string>,
  excluded: Set<string>,
  xiThreshold: number,
  forcedXI: Set<string>,
  forcedBench: Set<string>
) {
  const healthy = players.filter((p) => p.role === role && p.status !== "injured" && p.status !== "suspended" && !excluded.has(p.id));

  // 1) Force-ins and locked first
  const mustStartIds = new Set<string>([...forcedXI, ...locked]);
  const mustStart = healthy.filter((p) => mustStartIds.has(p.id) && !forcedBench.has(p.id));

  // 2) Eligible pool respecting threshold
  const eligible = healthy.filter((p) => !mustStartIds.has(p.id) && !forcedBench.has(p.id) && p.xiProb >= xiThreshold);

  // 3) Score
  const scored = eligible
    .map((p) => ({ p, score: adjustedScore(p, riskLevel, preferDefModifier) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  // 4) Fill up with mustStart first
  let picked: Player[] = [...mustStart.slice(0, count)];
  for (const p of scored) {
    if (picked.length >= count) break;
    picked.push(p);
  }

  // 5) Fallback: if still missing slots, ignore xiThreshold but keep health/exclusions
  if (picked.length < count) {
    const backfill = healthy.filter((p) => !picked.some((x) => x.id === p.id) && !forcedBench.has(p.id));
    backfill
      .sort((a, b) => adjustedScore(b, riskLevel, preferDefModifier) - adjustedScore(a, riskLevel, preferDefModifier))
      .slice(0, count - picked.length)
      .forEach((p) => picked.push(p));
  }

  return picked;
}

function buildRecommendation(
  players: Player[],
  module: Module,
  riskLevel: number,
  preferDefModifier: boolean,
  locked: Set<string>,
  excluded: Set<string>,
  xiThreshold: number,
  forcedXI: Set<string>,
  forcedBench: Set<string>
) {
  const slots = MODULE_SLOTS[module];

  // NEW: holes = how many players you explicitly sent to bench for each role
  const holes = {
    POR: players.filter(p => p.role === "POR" && forcedBench.has(p.id)).length,
    DIF: players.filter(p => p.role === "DIF" && forcedBench.has(p.id)).length,
    CEN: players.filter(p => p.role === "CEN" && forcedBench.has(p.id)).length,
    ATT: players.filter(p => p.role === "ATT" && forcedBench.has(p.id)).length,
  };

  // clamp to never request negative slots
  const need = {
    POR: Math.max(0, slots.POR - holes.POR),
    DIF: Math.max(0, slots.DIF - holes.DIF),
    CEN: Math.max(0, slots.CEN - holes.CEN),
    ATT: Math.max(0, slots.ATT - holes.ATT),
  };

  // build XI with the reduced counts (so holes remain visible)
  const gk  = selectRolePlayers(players, "POR", need.POR, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const dif = selectRolePlayers(players, "DIF", need.DIF, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const cen = selectRolePlayers(players, "CEN", need.CEN, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const att = selectRolePlayers(players, "ATT", need.ATT, riskLevel, preferDefModifier, locked, excluded, xiThreshold, forcedXI, forcedBench);
  const xi = [...gk, ...dif, ...cen, ...att];
  const xiIds = new Set(xi.map((p) => p.id));

  // Bench ordering: forcedBench first (keep health and not excluded), then others by simple score
  const benchCandidates = players.filter((p) => !xiIds.has(p.id) && !excluded.has(p.id));
  const forcedFirst = benchCandidates.filter((p) => forcedBench.has(p.id));
  const rest = benchCandidates.filter((p) => !forcedBench.has(p.id));
  const restSorted = rest
    .map((p) => ({ p, score: p.xiProb * 2 + p.xFP * 0.5 + (p.role === "POR" ? 0.2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  const bench = [...forcedFirst, ...restSorted];
  const teamXfp = xi.reduce((acc, p) => acc + p.xFP, 0);
  return { xi, bench, teamXfp, xiIds };
}

// --- Captaincy suggestion ---------------------------------------------------

function captainScore(p: Player, riskLevel: number) {
  // Base projection
  let score = p.xFP;
  // Reward starters reliability
  score += p.xiProb * 2.2;
  // Upside lever influences captaincy preference
  score += (p.ciHigh - p.xFP) * (riskLevel / 100) * 0.8;
  // Role preference: attackers > mids > defs > gk
  const roleW = p.role === "ATT" ? 0.8 : p.role === "CEN" ? 0.4 : p.role === "DIF" ? 0.1 : -0.6;
  score += roleW;
  // Set pieces bonus
  if (p.setPieces?.pens) score += 0.6;
  if (p.setPieces?.fks) score += 0.25;
  if (p.setPieces?.corners) score += 0.15;
  return score;
}

function suggestCaptaincy(xi: Player[], riskLevel: number) {
  if (!xi.length) return { capId: null as string | null, viceId: null as string | null };
  const ranked = [...xi]
    .map((p) => ({ id: p.id, score: captainScore(p, riskLevel) }))
    .sort((a, b) => b.score - a.score);
  const capId = ranked[0]?.id ?? null;
  let viceId = ranked[1]?.id ?? null;
  // Safety: ensure vice != captain
  if (viceId === capId) viceId = ranked[2]?.id ?? null;
  return { capId, viceId };
}

// --- UI --------------------------------------------------------------------

export default function LineupCoachPage() {
  const [module, setModule] = useState<Module>("4-3-3");
  const [risk, setRisk] = useState<number>(35);
  const [preferDefMod, setPreferDefMod] = useState<boolean>(false);
  const [xiThreshold, setXiThreshold] = useState<number>(0.7);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [forcedXI, setForcedXI] = useState<Set<string>>(new Set());
  const [forcedBench, setForcedBench] = useState<Set<string>>(new Set());
  const [matchday, setMatchday] = useState<string>("MD 1");
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const players = MOCK_PLAYERS; // swap with user roster projections for `matchday`

  const rec = useMemo(
    () =>
      buildRecommendation(
        players,
        module,
        risk,
        preferDefMod,
        locked,
        excluded,
        xiThreshold,
        forcedXI,
        forcedBench
      ),
    [players, module, risk, preferDefMod, locked, excluded, xiThreshold, forcedXI, forcedBench]
  );

  const { capId: suggestedCapId, viceId: suggestedViceId } = useMemo(() => suggestCaptaincy(rec.xi, risk), [rec.xi, risk]);

  const onAutoPick = () => {
    // memo does it
  };

  const toggleLock = (id: string) => {
    const next = new Set(locked);
    next.has(id) ? next.delete(id) : next.add(id);
    // lock implies not forced bench
    if (next.has(id)) {
      const fb = new Set(forcedBench);
      fb.delete(id);
      setForcedBench(fb);
    }
    setLocked(next);
  };

  const toggleExclude = (id: string) => {
    const next = new Set(excluded);
    next.has(id) ? next.delete(id) : next.add(id);
    // exclusion removes any force
    const fx = new Set(forcedXI); fx.delete(id);
    const fb = new Set(forcedBench); fb.delete(id);
    setForcedXI(fx); setForcedBench(fb);
    setExcluded(next);
  };

  const setCaptain = (id: string) => {
    setCaptainId((cur) => {
      const next = cur === id ? null : id;
      // prevent VC duplicating captain
      setViceCaptainId((vc) => (vc === next ? null : vc));
      return next;
    });
  };

  const setVice = (id: string) => {
    setViceCaptainId((cur) => {
      if (id === captainId) return cur; // don't let VC equal captain
      return cur === id ? null : id;
    });
  };

  const forceIntoXI = (id: string) => {
    const fx = new Set(forcedXI); fx.add(id);
    const fb = new Set(forcedBench); fb.delete(id);
    setForcedXI(fx); setForcedBench(fb);
  };

  const moveToBench = (id: string) => {
    const fb = new Set(forcedBench); fb.add(id);
    const fx = new Set(forcedXI); fx.delete(id);
    setForcedBench(fb); setForcedXI(fx);
  };

  const applyCaptainSuggestions = () => {
    if (suggestedCapId) setCaptainId(suggestedCapId);
    if (suggestedViceId && suggestedViceId !== suggestedCapId) setViceCaptainId(suggestedViceId);
  };

  const onSave = () => {
    // TODO: persist lineup (rec.xi, bench, module, captainId, viceCaptainId, risk, preferDefMod, thresholds, forcedXI, forcedBench) to backend
    console.log("Saving lineup", {
      module,
      risk,
      preferDefMod,
      xiThreshold,
      captainId,
      viceCaptainId,
      xi: rec.xi.map((p) => p.id),
      bench: rec.bench.map((p) => p.id),
      forcedXI: Array.from(forcedXI),
      forcedBench: Array.from(forcedBench),
    });
  };

  const teamAvgXIprob = useMemo(() => (rec.xi.reduce((a, p) => a + p.xiProb, 0) / Math.max(1, rec.xi.length)) * 100, [rec.xi]);

  const capName = rec.xi.find((p) => p.id === suggestedCapId)?.name ?? "—";
  const viceName = rec.xi.find((p) => p.id === suggestedViceId)?.name ?? "—";

  return (
    <>
      <div className="container mx-auto max-w-7xl p-4 md:p-8 space-y-8 bg-base-100 min-h-screen">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-base-200 rounded-2xl shadow-sm px-4 py-3 border border-base-300">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-lg font-bold tracking-tight bg-brand-primary text-white border-brand-secondary px-4 py-2 rounded-xl shadow">Lineup Coach</Badge>
          <div className="flex items-center gap-2 text-base text-content-100"><Info className="h-5 w-5 text-primary" /> Optimize your XI + bench for each matchday.</div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" className="gap-2 bg-base-100 text-brand-primary border-brand-primary hover:bg-brand-primary/10 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition font-semibold px-4 shadow" onClick={() => setImportDialogOpen(true)}>
            <RefreshCw className="h-4 w-4" /> Import Team
          </Button>
      <ImportTeamDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={(selected) => {
          // TODO: handle imported team (selected: {P: Player[], D: Player[], C: Player[], A: Player[]})
          setImportDialogOpen(false);
        }}
      />
          {/* <Select value={matchday} onValueChange={setMatchday}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Matchday" /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 38 }).map((_, i) => (
                <SelectItem key={i} value={`MD ${i + 1}`}>{`Matchday ${i + 1}`}</SelectItem>
              ))}
            </SelectContent>
          </Select> */}

          <Select value={module} onValueChange={(v: string) => setModule(v as Module)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(MODULE_SLOTS).map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="secondary" onClick={onAutoPick} className="gap-2 bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition"><Wand2 className="h-4 w-4" /> Auto-pick</Button>
          <Button onClick={onSave} className="gap-2 bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition"><ShieldCheck className="h-4 w-4" /> Save lineup</Button>
        </div>
      </header>

  <Card className="ring-2 ring-brand-primary/50 bg-base-200/80 shadow-xl border-2 border-brand-primary rounded-2xl transition-shadow hover:shadow-2xl backdrop-blur-md">
    <CardHeader className="pb-4 bg-gradient-to-r from-brand-primary/90 to-brand-secondary/80 rounded-t-2xl border-b-2 border-brand-primary/30 shadow-sm">
      <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        <span className="flex items-center gap-2 text-xl font-bold tracking-tight text-brand-secondary drop-shadow-sm">
          <span className="pr-2 font-bold text-content-100 drop-shadow-sm">Suggested module:</span>
          <span className="inline-flex items-center px-4 py-1 rounded-xl border-2 border-brand-primary bg-base-100 text-brand-primary font-extrabold text-2xl shadow-md tracking-wider" style={{minWidth:'90px',justifyContent:'center'}}>
            {module}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-4 text-base text-content-100/90">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-base-100/80 border border-brand-primary/30 shadow-sm">
            <Zap className="h-5 w-5 text-brand-primary" />
            <span className="font-bold text-brand-primary">{rec.teamXfp.toFixed(1)}</span>
            <span className="text-xs font-medium text-content-100/70 ml-1">Team xFP</span>
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-base-100/80 border border-secondary/30 shadow-sm">
            <span className="font-bold text-secondary">{teamAvgXIprob.toFixed(0)}%</span>
            <span className="text-xs font-medium text-content-100/70 ml-1">Avg XI probability</span>
          </span>
        </div>
      </CardTitle>
    </CardHeader>
  <CardContent className="grid gap-8 md:grid-cols-5">
          {/* Controls */}
          <div className="md:col-span-2 space-y-6 bg-base-300 rounded-xl p-4 border border-base-200 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk profile</span>
                <Badge variant="secondary">{risk <= 33 ? "Safe" : risk >= 66 ? "Upside" : "Balanced"}</Badge>
              </div>
              <Select
                value={risk <= 33 ? "Safe" : risk >= 66 ? "Upside" : "Balanced"}
                onValueChange={(v: string) => {
                  if (v === "Safe") setRisk(0);
                  else if (v === "Balanced") setRisk(50);
                  else if (v === "Upside") setRisk(100);
                }}
              >
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Risk profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Safe">Safe</SelectItem>
                  <SelectItem value="Balanced">Balanced</SelectItem>
                  <SelectItem value="Upside">Upside</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Prefer defence modifier</div>
                <div className="text-xs text-content-100">Prioritize DEF consistency for *modificatore difesa* leagues.</div>
              </div>
              <Switch checked={preferDefMod} onCheckedChange={setPreferDefMod} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Minimum XI probability</span>
                <Badge variant="secondary">{Math.round(xiThreshold * 100)}%</Badge>
              </div>
              <Slider value={[Math.round(xiThreshold * 100)]} onValueChange={(v: number[]) => setXiThreshold((v[0] ?? 70) / 100)} min={50} max={100} step={1} className="mt-2" />
              <div className="text-xs text-content-100">Auto-bench players below this starting chance unless locked/forced in XI.</div>
            </div>

            <Alert className="bg-brand-secondary border-brand-primary">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle>Tip</AlertTitle>
              <AlertDescription>
                Use the up/down arrows to add to XI or send to bench. Lock keeps a player in XI even if projections drop.
              </AlertDescription>
            </Alert>

            {/* Captain suggestions */}
            <div className="rounded-2xl border-2 border-brand-primary bg-base-100 p-4 space-y-3 shadow-xl ring-2 ring-brand-primary/20">
              <div className="text-xs font-bold text-brand-primary tracking-wide uppercase mb-1">Captain suggestions</div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-primary/10 border-2 border-brand-primary text-brand-primary font-bold text-sm shadow-sm">
                  <span className="bg-brand-primary rounded-full p-1 mr-1 flex items-center justify-center"><Crown className="h-4 w-4 text-white drop-shadow" /></span> {capName}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/10 border-2 border-secondary text-secondary font-bold text-sm shadow-sm">
                  <span className="bg-secondary rounded-full p-1 mr-1 flex items-center justify-center"><Medal className="h-4 w-4 text-content-100 drop-shadow" /></span> {viceName}
                </span>
                <Button size="sm" variant="secondary" className="bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition font-semibold px-4 shadow" onClick={applyCaptainSuggestions}>Apply</Button>
              </div>
              <div className="text-xs text-content-100/90">Based on <span className="font-semibold text-brand-primary">xFP</span>, <span className="font-semibold text-brand-primary">XI%</span>, set-pieces & upside preference.</div>
            </div>

            {/* Legend */}
            <div className="rounded-xl border border-base-200 bg-base-200 p-3 space-y-2">
              <div className="text-xs font-semibold text-content-100">Legend</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2"><Crown className="h-4 w-4" /> Captain</div>
                <div className="flex items-center gap-2"><Medal className="h-4 w-4" /> Vice-captain</div>
                <div className="flex items-center gap-2"><Lock className="h-4 w-4" /> / <Unlock className="h-4 w-4" /> Lock/Unlock in XI</div>
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Exclude this week</div>
                <div className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4" /> Add to XI</div>
                <div className="flex items-center gap-2"><ArrowDownCircle className="h-4 w-4" /> Send to bench</div>
              </div>
            </div>
          </div>

          {/* Four horizontal, scrollable role rows */}
          <div className="md:col-span-3 space-y-6">
            <RoleRow
              title="Portieri"
              players={players.filter(p => p.role === "POR")}
              xiIds={rec.xiIds}
              onAddToXI={forceIntoXI}
              onSendToBench={moveToBench}
              onLock={toggleLock}
              onExclude={toggleExclude}
              captainId={captainId}
              onCaptain={setCaptain}
            />
            <RoleRow
              title="Difensori"
              players={players.filter(p => p.role === "DIF")}
              xiIds={rec.xiIds}
              onAddToXI={forceIntoXI}
              onSendToBench={moveToBench}
              onLock={toggleLock}
              onExclude={toggleExclude}
              captainId={captainId}
              onCaptain={setCaptain}
            />
            <RoleRow
              title="Centrocampisti"
              players={players.filter(p => p.role === "CEN")}
              xiIds={rec.xiIds}
              onAddToXI={forceIntoXI}
              onSendToBench={moveToBench}
              onLock={toggleLock}
              onExclude={toggleExclude}
              captainId={captainId}
              onCaptain={setCaptain}
            />
            <RoleRow
              title="Attaccanti"
              players={players.filter(p => p.role === "ATT")}
              xiIds={rec.xiIds}
              onAddToXI={forceIntoXI}
              onSendToBench={moveToBench}
              onLock={toggleLock}
              onExclude={toggleExclude}
              captainId={captainId}
              onCaptain={setCaptain}
            />
            {/* Bench order removed: now shown as compact strip below pitch */}
          </div>

        </CardContent>
      </Card>
      </div>

      <Card className="mt-4 w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Best XI — Horizontal pitch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FormationPitch
            orientation="landscape"
            module={module}
            players={rec.xi.map(p => ({
              id: p.id,
              name: p.name,
              role: p.role,
              team: p.team,
              opponent: p.opponent,
              kickoff: p.kickoff,
              xiProb: p.xiProb,
              xFP: p.xFP,
              risk: p.risk,
              news: p.news,
              sentiment: p.sentiment,
            }))}
            xiIds={rec.xiIds}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
            onCaptain={setCaptain}
            onViceCaptain={setVice}
            onLock={toggleLock}
            onExclude={toggleExclude}
            onAddToXI={forceIntoXI}
            onSendToBench={moveToBench}
            locked={locked}
            excluded={excluded}
          />

          {/* Bench strip (compact) */}
          <div className="pt-3 border-t">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                Bench (order)
              </span>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                {Math.min(7, rec.bench.length)} shown
              </Badge>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {rec.bench.slice(0, 7).map((p) => (
                <button
                  key={p.id}
                  onClick={() => forceIntoXI(p.id)}
                  className="group flex items-center gap-2 rounded-lg border bg-card/90 px-2.5 py-1.5 text-xs shadow-sm hover:ring-2 hover:ring-primary/40 transition"
                  title="Add to XI"
                >
                  {/* role chip */}
                  <span
                    className={[
                      "grid h-6 w-6 place-items-center rounded-full bg-background/80 text-[10px] font-semibold",
                      // reuse your role colors:
                      p.role === "POR"
                        ? "ring-2 ring-sky-400/60 text-sky-700 dark:text-sky-300"
                        : p.role === "DIF"
                        ? "ring-2 ring-emerald-400/60 text-emerald-700 dark:text-emerald-300"
                        : p.role === "CEN"
                        ? "ring-2 ring-indigo-400/60 text-indigo-700 dark:text-indigo-300"
                        : "ring-2 ring-rose-400/60 text-rose-700 dark:text-rose-300",
                    ].join(" ")}
                  >
                    {p.role}
                  </span>

                  {/* name + xi */}
                  <div className="min-w-0">
                    <div className="truncate max-w-[120px] font-medium">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      XI {Math.round(p.xiProb * 100)}%
                    </div>
                  </div>

                  {/* quick action */}
                  <ArrowUpCircle className="ml-1 h-4 w-4 opacity-70 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>


    </>
  );
}

