"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { AlertTriangle, UserPlus, Users, XCircle, Filter, Upload } from "lucide-react";

// === Services ===============================================================
import { usePlayerApi } from "@/services/playerService";
import { fetchLeagueSettings } from "@/services/leagueSettingsService";
import { useAuth } from "@/services/AuthContext";
import { saveUserTeam } from "@/services/teamService";

// === Types (aligned to your app) ===========================================
export type Role = "POR" | "DIF" | "CEN" | "ATT";
export type ImportMode = "append" | "replace";

export type ImportedPlayer = {
  id: string;
  name: string;
  role: Role;
  team?: string;
  opponent?: string;
  kickoff?: string;
  xiProb?: number;
  xFP?: number;
};

// service shape (adjust if your service returns more/less fields)
type ServicePlayer = {
  id: string;
  name: string;
  role: Role;
  team?: string;
  opponent?: string;
  kickoff?: string;
  xiProb?: number;
  xFP?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (players: ImportedPlayer[], mode: ImportMode) => void;
  /** current roster, to compute remaining slots per role */
  currentPlayers?: Array<{ id: string; role: Role }>;
};


const ROLE_LABEL: Record<Role, string> = { POR: "Portieri", DIF: "Difensori", CEN: "Centrocampisti", ATT: "Attaccanti" };
const ROLES: Role[] = ["POR", "DIF", "CEN", "ATT"];

// Repo style: badge color by role (matches PlayerCard)
function getRoleBadgeClass(role: Role) {
  switch (role) {
    case "POR": return "bg-yellow-100/40 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700";
    case "DIF": return "bg-blue-100/40 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700";
    case "CEN": return "bg-green-100/40 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700";
    case "ATT": return "bg-red-100/40 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700";
    default: return "bg-base-200/40 text-content-100 border-base-300 dark:bg-base-800/40 dark:text-content-100 dark:border-base-700";
  }
}

export default function ImportTeamDialog({ open, onClose, onImport, currentPlayers = [] }: Props) {
  const authContext = useAuth();
  const idToken = authContext?.idToken;
  const [mode, setMode] = React.useState<ImportMode>("append");
  const [roleFilter, setRoleFilter] = React.useState<Role | "ALL">("ALL");
  const [query, setQuery] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [servicePlayers, setServicePlayers] = React.useState<ServicePlayer[]>([]);
  const [slots, setSlots] = React.useState<{ POR: number; DIF: number; CEN: number; ATT: number } | null>(null);

  // local selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  // Store role overrides for each player by id
  const [roleOverrides, setRoleOverrides] = React.useState<Record<string, Role>>({});

  const { fetchPlayers } = usePlayerApi();

  // fetch players + roster slots
  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetchPlayers().then(players => players.map(p => ({
        id: String(p.id),
        name: p.player_name,
        role: p.position as "POR" | "DIF" | "CEN" | "ATT",
        team: p.current_team,
        // Mock data for missing fields
        opponent: '',
        kickoff: '',
        xiProb: p.starting_rate ? p.starting_rate / 100 : undefined,
        xFP: p.xfp_per_game || undefined,
      }))),
  fetchLeagueSettings(idToken || undefined).then(settings => {
        // Map API roster keys to app roles
        const apiRoster: Record<string, number> = settings?.roster || { P: 3, D: 8, C: 8, A: 6 };
        return {
          POR: apiRoster["P"] ?? 3,
          DIF: apiRoster["D"] ?? 8,
          CEN: apiRoster["C"] ?? 8,
          ATT: apiRoster["A"] ?? 6,
        };
      })
    ])
      .then(([players, slots]) => {
        setServicePlayers(players);
        setSlots(slots);
        // Reset role overrides to initial roles
        const initialRoles: Record<string, Role> = {};
        players.forEach(p => { initialRoles[p.id] = p.role; });
        setRoleOverrides(initialRoles);
      })
      .finally(() => setLoading(false));
  }, [open, idToken]);

  // compute remaining per role
  const currentCounts = React.useMemo(() => {
    const init = { POR: 0, DIF: 0, CEN: 0, ATT: 0 } as Record<Role, number>;
    currentPlayers.forEach((p) => (init[p.role] += 1));
    return init;
  }, [currentPlayers]);

  const selectionCounts = React.useMemo(() => {
    const init = { POR: 0, DIF: 0, CEN: 0, ATT: 0 } as Record<Role, number>;
    for (const id of selectedIds) {
      const role = roleOverrides[id] ?? servicePlayers.find((sp) => sp.id === id)?.role;
      if (role) init[role] += 1;
    }
    return init;
  }, [selectedIds, servicePlayers, roleOverrides]);

  const remainingByRole = React.useMemo(() => {
    if (!slots) return { POR: 0, DIF: 0, CEN: 0, ATT: 0 } as Record<Role, number>;
    if (mode === "replace") return slots;
    // append: subtract current counts
    return {
      POR: Math.max(0, slots.POR - currentCounts.POR),
      DIF: Math.max(0, slots.DIF - currentCounts.DIF),
      CEN: Math.max(0, slots.CEN - currentCounts.CEN),
      ATT: Math.max(0, slots.ATT - currentCounts.ATT),
    };
  }, [slots, mode, currentCounts]);

  // filtered list
  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return servicePlayers.filter((p) => {
      if (roleFilter !== "ALL" && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q) ||
        (p.opponent ?? "").toLowerCase().includes(q)
      );
    });
  }, [servicePlayers, roleFilter, query]);

  const atCap = (role: Role) => selectionCounts[role] >= remainingByRole[role];
  const isDisabledByCap = (p: ServicePlayer) => {
    const role = roleOverrides[p.id] ?? p.role;
    // If already selected, never disable (can uncheck)
    if (selectedIds.has(p.id)) return false;
    // If replace mode, caps == absolute slots (no current roster penalty)
    if (mode === "replace") return selectionCounts[role] >= (slots?.[role] ?? 0);
    // Append mode: respect remaining
    return atCap(role);
  };

  const toggleOne = (p: ServicePlayer) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(p.id)) next.delete(p.id);
      else if (!isDisabledByCap(p)) next.add(p.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectAllFiltered = () => {
    const next = new Set(selectedIds);
    const tempCounts = { ...selectionCounts };
    for (const p of list) {
      if (next.has(p.id)) continue;
      const cap = mode === "replace" ? (slots?.[p.role] ?? 0) : remainingByRole[p.role];
      if (tempCounts[p.role] < cap) {
        next.add(p.id);
        tempCounts[p.role] += 1;
      }
    }
    setSelectedIds(next);
  };

  const canImport = selectedIds.size > 0 && (!!slots || mode === "replace");

  const toImported = (id: string): ImportedPlayer | null => {
    const sp = servicePlayers.find((x) => x.id === id);
    if (!sp) return null;
    return {
      id: sp.id,
      name: sp.name,
      role: roleOverrides[id] ?? sp.role,
      team: sp.team,
      opponent: sp.opponent,
      kickoff: sp.kickoff,
      xiProb: typeof sp.xiProb === "number" ? sp.xiProb : undefined,
      xFP: typeof sp.xFP === "number" ? sp.xFP : undefined,
    };
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
  <DialogContent className="sm:max-w-3xl bg-base-100/90 backdrop-blur-xl border border-base-300 rounded-2xl shadow-xl">
        <DialogHeader className="pb-2 border-b border-base-300/60">
          <DialogTitle className="text-lg font-bold text-brand-primary">Importa squadra</DialogTitle>
          <DialogDescription className="text-sm text-content-100/80">
            Seleziona i giocatori dal database e rispetta i limiti di rosa per ruolo.
          </DialogDescription>
        </DialogHeader>

        {/* Top controls */}
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-2">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-content-100">Modalità merge</label>
            <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
              <SelectTrigger className="w-[150px] border-base-300 rounded-md bg-base-100 text-content-100 shadow-xs"><SelectValue placeholder="Append or Replace" /></SelectTrigger>
              <SelectContent className="bg-base-100 border-base-300 rounded-md shadow-lg">
                <SelectItem value="append">Append</SelectItem>
                <SelectItem value="replace">Replace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-[220px]">
              <Input
                placeholder="Cerca nome, team, avversario"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 border-base-300 rounded-md bg-base-100 text-content-100 shadow-xs"
              />
              <Filter className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "ALL")}> 
              <SelectTrigger className="w-[140px] border-base-300 rounded-md bg-base-100 text-content-100 shadow-xs"><SelectValue placeholder="Ruolo" /></SelectTrigger>
              <SelectContent className="bg-base-100 border-base-300 rounded-md shadow-lg">
                <SelectItem value="ALL">Tutti i ruoli</SelectItem>
                {ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Caps summary */}
        <div className="rounded-xl border border-base-300 bg-base-100/80 p-3 mb-2">
          <div className="grid grid-cols-4 gap-3 text-xs">
            {ROLES.map((r) => {
              const cap = mode === "replace" ? (slots?.[r] ?? 0) : remainingByRole[r];
              const sel = selectionCounts[r];
              const taken = mode === "replace" ? 0 : currentCounts[r];
              return (
                <div key={r} className="rounded-lg border border-base-200 bg-base-100 p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-content-100`}>
                      <Badge variant="outline" className={`w-8 justify-center px-2 py-1 text-xs font-bold border ${getRoleBadgeClass(r)}`}>{r}</Badge>
                    </span>
                    <Badge variant="outline" className={`px-2 py-1 text-xs font-bold border ${getRoleBadgeClass(r)}`}>{sel}/{cap}</Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {mode === "append" ? <>Occupati: <b>{taken}</b></> : <>Sostituirai l’intera rosa</>}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand-primary/40 transition-[width]"
                      style={{ width: `${cap === 0 ? 0 : Math.min(100, (sel / Math.max(1, cap)) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* List */}
  <Tabs defaultValue="select" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 rounded-lg bg-base-100 border border-base-300 mb-2">
            <TabsTrigger value="select" className="rounded-lg data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary font-semibold"><Users className="mr-2 h-4 w-4" /> Seleziona</TabsTrigger>
            <TabsTrigger value="paste" className="rounded-lg data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary font-semibold"><Upload className="mr-2 h-4 w-4" /> CSV/JSON</TabsTrigger>
          </TabsList>

          {/* Select from services */}
          <TabsContent value="select" className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-full rounded-lg bg-base-200/80 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-content-100/80">
                    {list.length} risultati · selezionati <b>{selectedIds.size}</b>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-base-300 bg-base-100 text-content-100 hover:bg-brand-primary/10" onClick={clearSelection}><XCircle className="mr-1 h-4 w-4" /> Clear</Button>
                    <Button variant="secondary" size="sm" className="bg-brand-primary text-brand-secondary hover:bg-brand-primary/90" onClick={selectAllFiltered}><UserPlus className="mr-1 h-4 w-4" /> Seleziona filtri</Button>
                  </div>
                </div>

                <div className="h-[320px] rounded-xl border border-base-300 bg-base-100/80 overflow-y-auto shadow">
                  <div className="divide-y divide-base-200">
                    {list.map((p) => {
                      const checked = selectedIds.has(p.id);
                      const disabled = isDisabledByCap(p);
                      const roleOverride = roleOverrides[p.id] ?? p.role;
                      const handleRoleChange = (newRole: Role) => {
                        setRoleOverrides(prev => ({ ...prev, [p.id]: newRole }));
                      };
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg ${disabled && !checked ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled && !checked}
                            onChange={() => toggleOne(p)}
                            className="form-checkbox h-4 w-4 text-brand-primary rounded border-base-300 focus:ring-brand-primary/50 disabled:opacity-50"
                          />
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Select value={roleOverride} onValueChange={v => handleRoleChange(v as Role)}>
                              <SelectTrigger className={`w-14 border ${getRoleBadgeClass(roleOverride)} rounded px-1 py-0 text-xs font-bold`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ROLES.map(r => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-content-100">{p.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {(p.team ?? "")} {(p.opponent ?? "")} {p.kickoff ? `· ${p.kickoff}` : ""}
                              </div>
                            </div>
                          </div>
                          {typeof p.xiProb === "number" && (
                            <div className="text-xs text-brand-primary/80 w-16 text-right font-semibold">XI {Math.round(p.xiProb * 100)}%</div>
                          )}
                        </label>
                      );
                    })}
                    {list.length === 0 && (
                      <div className="p-6 text-center text-sm text-content-100/70">
                        Nessun risultato. Modifica i filtri.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Optional CSV/JSON fallback (kept minimal) */}
          <TabsContent value="paste" className="space-y-2">
            <div className="rounded-xl border border-base-300 bg-base-100/80 p-3 text-xs text-content-100/80">
              Per ora l’import CSV/JSON è opzionale: usa la selezione manuale sopra.
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between mt-4">
          <div className="flex items-center gap-2 text-xs text-content-100/80">
            <AlertTriangle className="h-3.5 w-3.5 text-brand-primary" />
            Rispettare i limiti di ruolo: la selezione oltre il cap è disabilitata.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-base-300 bg-base-100 text-content-100 hover:bg-brand-primary/10" onClick={onClose}>Annulla</Button>
            <Button
              variant="secondary"
              className="bg-brand-primary text-brand-secondary hover:bg-brand-primary/90 font-semibold"
              disabled={!canImport}
              onClick={async () => {
                const arr = Array.from(selectedIds).map(toImported).filter(Boolean) as ImportedPlayer[];
                const team_players = arr.map(p => ({
                  player_id: p.id,      // Include the player ID for AI optimization
                  player_name: p.name,
                  team: p.team ?? '',
                  role: p.role
                }));
                // Use idToken and sub from authContext.profile
                const googleSub = authContext?.profile?.sub || '';
                const token = typeof idToken === 'string' ? idToken : '';
                console.log('authContext:', authContext);
                if (!googleSub) {
                  alert('Utente non autenticato. Effettua il login.');
                  return;
                }
                if (!team_players.length) {
                  alert('Seleziona almeno un giocatore.');
                  return;
                }
                console.log('[ImportTeamDialog] Calling saveUserTeam', { googleSub, team_players, token });
                try {
                  await saveUserTeam(googleSub, team_players, token);
                  console.log('[ImportTeamDialog] saveUserTeam success');
                } catch (err) {
                  console.error('[ImportTeamDialog] saveUserTeam error', err);
                  alert('Errore nel salvataggio della squadra: ' + (err instanceof Error ? err.message : String(err)));
                  return;
                }
                onImport(arr, mode);
              }}
            >
              Importa ({selectedIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
