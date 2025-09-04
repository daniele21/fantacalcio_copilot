import { useMemo, useState, useEffect } from "react";
import { usePlayerApi } from "../services/playerService";
import { getMatchdays } from "../services/lineupService";
import { getProbableLineups } from "../services/probableLineupsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, ShieldCheck, Zap, Wand2} from "lucide-react";
// import MiniActions from "./components/MiniActions"; // Only import if used directly
import RoleRow from "./components/RoleRow";
import FormationPitch from "./components/FormationPitch";
import ImportTeamDialog, { ImportedPlayer, ImportMode } from "@/components/ImportTeamDialog";


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


// --- Import helpers --------------------------------------------------------

function mapImported(ip: ImportedPlayer): Player {
  const xfp = ip.xFP ?? 0;
  return {
    id: ip.id,
    name: ip.name,
    role: ip.role,
    team: ip.team ?? "",
    opponent: ip.opponent ?? "",
    kickoff: ip.kickoff ?? "",
    xiProb: typeof ip.xiProb === "number" ? Math.min(1, Math.max(0, ip.xiProb)) : 0.8,
    expMinutes: 90,
    xFP: xfp,
    ciLow: Math.max(0, xfp - 2),
    ciHigh: xfp + 3,
    risk: "Safe",
  };
}

function mergePlayers(current: Player[], incoming: Player[]): Player[] {
  const byId = new Map(current.map(p => [p.id, p]));
  incoming.forEach(p => byId.set(p.id, p));
  return Array.from(byId.values());
}

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
  const { fetchPlayerStats } = usePlayerApi();
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerStatsError, setPlayerStatsError] = useState<string | null>(null);

  const handleFetchPlayerStats = async () => {
    setPlayerStatsLoading(true);
    setPlayerStatsError(null);
    try {
      const stats = await fetchPlayerStats();
      setPlayerStats(stats);
    } catch (e: any) {
      setPlayerStatsError(e.message || 'Errore durante la chiamata alle statistiche giocatori.');
    } finally {
      setPlayerStatsLoading(false);
    }
  };
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
  const [probableLineups, setProbableLineups] = useState<any>(null);
  const [probableLineupsLoading, setProbableLineupsLoading] = useState(false);
  const [probableLineupsError, setProbableLineupsError] = useState<string | null>(null);
  // Store the next matchday number from the API response
  const [nextMatchday, setNextMatchday] = useState<string | null>(null);


  // Load matches for today on mount
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    setMatchesLoading(true);
    setMatchesError(null);
    getMatchdays(today)
      .then((data) => {
        setMatches(data.matches || []);
        // Set next matchday from the first match if available
        if (data.matches && data.matches.length > 0 && data.matches[0].matchday) {
          setNextMatchday(data.matches[0].matchday);
        } else {
          setNextMatchday(null);
        }
      })
      .catch((e) => {
        setMatchesError(e.message || "Errore durante il caricamento delle partite.");
      })
      .finally(() => setMatchesLoading(false));
  }, []);

  // Helper to get current matchday as int (default 1 if not parseable)
  const matchdayInt = parseInt(matchday.replace(/\D/g, "")) || 1;

  const handleFetchProbableLineups = async () => {
    setProbableLineupsError(null);
    setProbableLineupsLoading(true);
    try {
      const data = await getProbableLineups(matchdayInt);
      setProbableLineups(data.result);
    } catch (e: any) {
      setProbableLineupsError(e.message || "Errore durante la chiamata alle probabili formazioni.");
    } finally {
      setProbableLineupsLoading(false);
    }
  };

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
    <div className="container mx-auto max-w-7xl p-4 md:p-8 space-y-8 bg-base-100 min-h-screen">
      {/* Matches Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            Serie A: Prossime partite
            {nextMatchday && (
              <span className="ml-2 text-base font-semibold text-brand-primary">Giornata {nextMatchday}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matchesLoading && <div>Caricamento partite...</div>}
          {matchesError && <Alert variant="destructive"><AlertTitle>Errore</AlertTitle><AlertDescription>{matchesError}</AlertDescription></Alert>}
          {!matchesLoading && !matchesError && matches.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {matches.map((m, i) => (
                <li key={i} className="border rounded p-2 bg-base-200">
                  <div className="font-semibold">{m.home_team} vs {m.away_team}</div>
                  <div className="text-xs text-muted-foreground">{m.date || m.data}</div>
                </li>
              ))}
            </ul>
          )}
          {!matchesLoading && !matchesError && matches.length === 0 && <div>Nessuna partita trovata.</div>}
        </CardContent>
      </Card>
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-base-200 rounded-2xl shadow-sm px-4 py-3 border border-base-300">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-lg font-bold tracking-tight bg-brand-primary text-white border-brand-secondary px-4 py-2 rounded-xl shadow">Lineup Coach</Badge>
          <div className="flex items-center gap-2 text-base text-content-100"><Info className="h-5 w-5 text-primary" /> Optimize your XI + bench for each matchday.</div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={handleFetchPlayerStats} disabled={playerStatsLoading} className="gap-2">
            Fetch Player Stats
          </Button>
          {playerStatsError && (
            <Alert variant="destructive" className="my-2">
              <AlertTitle>Errore</AlertTitle>
              <AlertDescription>{playerStatsError}</AlertDescription>
            </Alert>
          )}
          {playerStatsLoading && <div>Caricamento statistiche giocatori...</div>}
          {/* {!playerStatsLoading && playerStats.length > 0 && (
            <Card className="my-2">
              <CardHeader>
                <CardTitle>Player Stats (debug)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap break-all max-h-96 overflow-auto bg-base-200 p-2 rounded-lg">
                  {JSON.stringify(playerStats, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )} */}
          <Button variant="outline" onClick={handleFetchProbableLineups} disabled={probableLineupsLoading} className="gap-2">
            <Zap className="h-4 w-4" />
            {probableLineupsLoading ? "Caricamento..." : "Probabili formazioni"}
          </Button>
      {/* Probable Lineups Result Display */}
      {probableLineupsError && (
        <Alert variant="destructive" className="my-4">
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>{probableLineupsError}</AlertDescription>
        </Alert>
      )}
      {/* {probableLineups && (
        <Card className="my-4">
          <CardHeader>
            <CardTitle>Probabili formazioni (AI, giornata {matchdayInt})</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap break-all max-h-96 overflow-auto bg-base-200 p-2 rounded-lg">
              {JSON.stringify(probableLineups, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )} */}
          <Button variant="secondary" onClick={() => setImportOpen(true)} className="gap-2">
            Import Team
          </Button>
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

  <Card className="ring-1 ring-brand-primary/15 border border-base-300 rounded-2xl bg-base-100/80 backdrop-blur-md shadow-lg">
      {/* Mount ImportTeamDialog at the end of the page JSX */}
      <ImportTeamDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        currentPlayers={players.map(p => ({ id: p.id, role: p.role }))}
        onImport={(arr: ImportedPlayer[], mode: ImportMode) => {
          const mapped = arr.map(mapImported);
          setPlayers(prev => (mode === "replace" ? mapped : mergePlayers(prev, mapped)));
          setImportOpen(false);
        }}
      />
        <CardHeader className="pb-3 border-b border-base-300/60">
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="text-sm">
              Suggested module: {" "}
              <span className="inline-flex items-center rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2 py-1 font-bold text-brand-primary">
                {module}
              </span>
            </span>
            <div className="flex items-center gap-2 text-sm text-content-100/80">
              <Zap className="h-4 w-4 text-brand-primary" /> Team xFP: {" "}
              <span className="font-semibold text-foreground">{rec.teamXfp.toFixed(1)}</span>
              <Separator orientation="vertical" className="mx-2 h-4" />
              Avg XI prob: <span className="font-semibold">{teamAvgXIprob.toFixed(0)}%</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls: risk, sliders, toggles */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Risk profile */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk profile</span>
                <Badge variant="secondary">{risk <= 33 ? "Safe" : risk >= 66 ? "Upside" : "Balanced"}</Badge>
              </div>
              <Slider min={0} max={100} step={1} value={[risk]} onValueChange={([v]) => setRisk(v)} className="mt-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Safe</span>
                <span>Balanced</span>
                <span>Upside</span>
              </div>
            </div>
            {/* XI threshold */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">XI Probability threshold</span>
                <Badge variant="outline">{Math.round(xiThreshold * 100)}%</Badge>
              </div>
              <Slider min={0.5} max={1} step={0.01} value={[xiThreshold]} onValueChange={([v]) => setXiThreshold(v)} className="mt-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            {/* Prefer defensive modifier */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Prefer defensive modifier</span>
                <Switch checked={preferDefMod} onCheckedChange={setPreferDefMod} />
              </div>
              <span className="text-xs text-muted-foreground">Prioritize defenders for modifier bonus</span>
            </div>
          </div>

          {/* Role rows: horizontally scrollable player cards by role */}
          <div className="space-y-6">
            {/* Collapsible RoleRows with colored titles */}
            {([
              { role: "POR", title: "Portieri" },
              { role: "DIF", title: "Difensori" },
              { role: "CEN", title: "Centrocampisti" },
              { role: "ATT", title: "Attaccanti" },
            ] as const).map(({ role, title }) => {
              // Color logic matching PlayerCard
              let colorClass = "";
              switch (role) {
                case "POR": colorClass = "text-yellow-700 dark:text-yellow-300"; break;
                case "DIF": colorClass = "text-blue-700 dark:text-blue-300"; break;
                case "CEN": colorClass = "text-green-700 dark:text-green-300"; break;
                case "ATT": colorClass = "text-red-700 dark:text-red-300"; break;
                default: colorClass = "text-content-100";
              }
              // Collapsible state per role
              const [open, setOpen] = useState(true);
              return (
                <details key={role} open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-xl border border-base-200 bg-base-100/60 shadow-sm">
                  <summary className={`sticky top-0 z-10 flex items-center gap-2 px-4 py-2 text-lg font-bold cursor-pointer select-none rounded-t-xl bg-base-100/80 ${colorClass}`}>{title}</summary>
                  <div className="p-2 pt-0">
                    <RoleRow
                      title={title}
                      players={players.filter(p => p.role === role)}
                      xiIds={rec.xiIds}
                      onAddToXI={forceIntoXI}
                      onSendToBench={moveToBench}
                      onLock={toggleLock}
                      onExclude={toggleExclude}
                      captainId={captainId}
                      onCaptain={setCaptain}
                    />
                  </div>
                </details>
              );
            })}
          </div>

          {/* Pitch and bench strip */}
          <div className="pt-4">
            <FormationPitch
              orientation="landscape"
              module={module}
              players={rec.xi}
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
            {/* compact bench strip */}
            <div className="mt-2 rounded-xl border border-base-300 bg-base-100/70 p-2">
              <div className="mb-1 text-[11px] font-semibold text-content-100/80">Bench</div>
              <div className="flex flex-wrap gap-2">
                {rec.bench.slice(0, 7).map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-100 px-2 py-1 text-xs"
                    title={`${b.team} ${b.opponent} · XI ${Math.round(b.xiProb * 100)}%`}
                  >
                    <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-brand-primary/15 text-brand-primary text-[10px] font-bold">
                      {b.role}
                    </span>
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

