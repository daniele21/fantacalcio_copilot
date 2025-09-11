import { Player, Role, Module, MODULE_SLOTS } from "./types";

export function adjustedScore(p: Player, riskLevel: number, preferDefModifier: boolean): number {
  // riskLevel: 0 (safe) .. 100 (upside)
  const base = (p.ciLow + p.ciHigh) / 2; // Use average of bounds as base score
  const upsideBoost = (p.ciHigh - base) * (riskLevel / 100);
  const safetyBoost = (base - p.ciLow) * ((100 - riskLevel) / 100);
  const roleBonus = preferDefModifier && p.role === "DIF" ? 0.35 : 0;
  const xiPenalty = p.xiProb < 0.75 ? -0.75 : 0; // favor starters
  return base + upsideBoost * 0.5 + safetyBoost * 0.15 + roleBonus + xiPenalty;
}

export function selectRolePlayers(
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
  // Filter to only include players with probable lineup data (xiProb > 0) or forced/locked players
  const healthy = players.filter((p) => 
    p.role === role && 
    p.status !== "injured" && 
    p.status !== "suspended" && 
    !excluded.has(p.id) &&
    (p.xiProb > 0 || forcedXI.has(p.id) || locked.has(p.id))
  );

  if (role === 'POR' && forcedXI.size > 0) {
    console.log(`DEBUG ${role} - Total players for role:`, players.filter(p => p.role === role).length);
    console.log(`DEBUG ${role} - Healthy players after filter:`, healthy.length);
    console.log(`DEBUG ${role} - ForcedXI for this role:`, 
      Array.from(forcedXI).filter(id => players.find(p => p.id === id)?.role === role)
    );
    console.log(`DEBUG ${role} - Players with xiProb > 0:`, 
      players.filter(p => p.role === role && p.xiProb > 0).map(p => ({ id: p.id, name: p.name, xiProb: p.xiProb }))
    );
    healthy.forEach(p => {
      const inForced = forcedXI.has(p.id);
      const inLocked = locked.has(p.id);
      console.log(`DEBUG ${role} - ${p.name} (${p.id}): xiProb=${p.xiProb}, forcedXI=${inForced}, locked=${inLocked}`);
    });
  }

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

export function buildRecommendation(
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

  // Bench ordering: only include players with xiProb > 0 or forced players
  const benchCandidates = players.filter((p) => 
    !xiIds.has(p.id) && 
    !excluded.has(p.id) && 
    (p.xiProb > 0 || forcedBench.has(p.id))
  );
  const forcedFirst = benchCandidates.filter((p) => forcedBench.has(p.id));
  const rest = benchCandidates.filter((p) => !forcedBench.has(p.id));
  const restSorted = rest
    .map((p) => ({ p, score: p.xiProb * 2 + ((p.ciLow + p.ciHigh) / 2) * 0.5 + (p.role === "POR" ? 0.2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  const bench = [...forcedFirst, ...restSorted];
  const teamXfp = xi.reduce((acc, p) => acc + ((p.ciLow + p.ciHigh) / 2), 0);
  return { xi, bench, teamXfp, xiIds };
}
