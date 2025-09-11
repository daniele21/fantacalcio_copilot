import { Player } from "./types";
import { ImportedPlayer } from "../components/ImportTeamDialog";

// CSV export helper
export function exportTeamToCSV(players: Player[]) {
  const header = ['player_name', 'role', 'team'];
  const rows = players.map(p => [p.name, p.role, p.team]);
  const csv = [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my_team.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Import helpers
export function mapImported(ip: ImportedPlayer): Player {
  return {
    id: ip.id,
    name: ip.name,
    role: ip.role,
    team: ip.team ?? "",
    opponent: ip.opponent ?? "",
    kickoff: ip.kickoff ?? "",
    xiProb: typeof ip.xiProb === "number" ? Math.min(1, Math.max(0, ip.xiProb)) : 0.0,
    expMinutes: 90,
    ciLow: 2,
    ciHigh: 8,
    // Don't set risk until we have probable lineup data
  };
}

export function mergePlayers(current: Player[], incoming: Player[]): Player[] {
  const byId = new Map(current.map(p => [p.id, p]));
  incoming.forEach(p => byId.set(p.id, p));
  return Array.from(byId.values());
}
