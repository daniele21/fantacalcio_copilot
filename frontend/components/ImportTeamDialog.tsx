
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchLeagueSettings } from "@/services/leagueSettingsService";
import { usePlayerApi } from "@/services/playerService";
import { Player, LeagueSettings } from "@/types";

interface ImportTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (selected: Record<string, Player[]>) => void;
}

export default function ImportTeamDialog({ open, onClose, onImport }: ImportTeamDialogProps) {
  const [loading, setLoading] = useState(false);
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Record<string, Player[]>>({ P: [], D: [], C: [], A: [] });
  const [search, setSearch] = useState("");
  const [searchRole, setSearchRole] = useState<"P" | "D" | "C" | "A">("P");
  const { fetchPlayers } = usePlayerApi();

  // Fetch league settings and players on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetchLeagueSettings(),
      fetchPlayers()
    ]).then(([settings, players]) => {
      setLeagueSettings(settings);
      setPlayers(players);
      setLoading(false);
    });
  }, [open]);

  // Add player to slot
  const addPlayer = (role: string, player: Player) => {
    setSelected(sel => {
      if (sel[role].some(p => p.id === player.id)) return sel;
      if (sel[role].length >= (leagueSettings?.roster[role] || 0)) return sel;
      return { ...sel, [role]: [...sel[role], player] };
    });
  };
  // Remove player from slot
  const removePlayer = (role: string, id: string) => {
    setSelected(sel => ({ ...sel, [role]: sel[role].filter(p => p.id !== id) }));
  };

  // Filtered player list for search
  const filteredPlayers = players.filter(
    p => (p.role === searchRole || p.role === roleMap(searchRole)) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Map for role code conversion
  function roleMap(r: string) {
    if (r === "P") return "POR";
    if (r === "D") return "DIF";
    if (r === "C") return "CEN";
    if (r === "A") return "ATT";
    return r;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Team</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="p-8 text-center">Loading…</div>
        ) : leagueSettings ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4">
              {Object.entries(leagueSettings.roster).map(([role, count]) => (
                <div key={role} className="flex-1 min-w-[120px]">
                  <div className="font-bold mb-1">{role} <Badge className="ml-1">{selected[role]?.length || 0}/{count}</Badge></div>
                  <div className="flex flex-wrap gap-1">
                    {(selected[role] || []).map(p => (
                      <Badge key={p.id} className="bg-brand-primary text-white px-2 py-1 rounded-lg flex items-center gap-1">
                        {p.name}
                        <button className="ml-1 text-xs" onClick={() => removePlayer(role, p.id)} title="Remove">×</button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <Select value={searchRole} onValueChange={v => setSearchRole(v as any)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="P">POR</SelectItem>
                  <SelectItem value="D">DIF</SelectItem>
                  <SelectItem value="C">CEN</SelectItem>
                  <SelectItem value="A">ATT</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Search player…" value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 bg-base-200">
              {filteredPlayers.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1 px-2 hover:bg-base-100 rounded cursor-pointer" onClick={() => addPlayer(searchRole, p)}>
                  <span>{p.name} <span className="text-xs text-content-200">({p.team})</span></span>
                  <Button size="xs" variant="secondary" className="ml-2" disabled={selected[searchRole].some(sel => sel.id === p.id) || selected[searchRole].length >= (leagueSettings.roster[searchRole] || 0)}>
                    Add
                  </Button>
                </div>
              ))}
              {!filteredPlayers.length && <div className="text-xs text-content-200 p-2">No players found.</div>}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-red-500">Could not load league settings.</div>
        )}
        <DialogFooter>
          <Button onClick={() => onImport(selected)} disabled={loading}>Import</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
