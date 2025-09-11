import { Player } from "./types";

export function captainScore(p: Player, riskLevel: number) {
  // Base projection using average of bounds
  let score = (p.ciLow + p.ciHigh) / 2;
  // Reward starters reliability
  score += p.xiProb * 2.2;
  // Upside lever influences captaincy preference
  score += (p.ciHigh - ((p.ciLow + p.ciHigh) / 2)) * (riskLevel / 100) * 0.8;
  // Role preference: attackers > mids > defs > gk
  const roleW = p.role === "ATT" ? 0.8 : p.role === "CEN" ? 0.4 : p.role === "DIF" ? 0.1 : -0.6;
  score += roleW;
  // Set pieces bonus
  if (p.setPieces?.pens) score += 0.6;
  if (p.setPieces?.fks) score += 0.25;
  if (p.setPieces?.corners) score += 0.15;
  return score;
}

export function suggestCaptaincy(xi: Player[], riskLevel: number) {
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
