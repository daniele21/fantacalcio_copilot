import React, { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { Player, TargetPlayer, LeagueSettings, Role } from '../types';
import { Search, PlusCircle, Trash2, AlertTriangle, PieChart, Info } from 'lucide-react';
import { useAuth } from '../services/AuthContext';

interface StrategyBoardViewProps {
    players: Player[];
    leagueSettings: LeagueSettings;
}

const ROLES_ORDER: Role[] = [Role.GK, Role.DEF, Role.MID, Role.FWD];
const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'Portieri', [Role.DEF]: 'Difensori', [Role.MID]: 'Centrocampisti', [Role.FWD]: 'Attaccanti' };
const BASE_URL = "http://127.0.0.1:5000";

export const StrategyBoardView: React.FC<StrategyBoardViewProps> = ({ players, leagueSettings }: StrategyBoardViewProps) => {
    const { idToken } = useAuth();
    // Internal state for role budget and target players
    const [roleBudget, setRoleBudget] = useState<Record<Role, number>>({
        [Role.GK]: 8,
        [Role.DEF]: 22,
        [Role.MID]: 35,
        [Role.FWD]: 35,
    });
    const [targetPlayers, setTargetPlayers] = useState<TargetPlayer[]>([]);
    const [query, setQuery] = useState<string>('');
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');

    // Handlers for internal state
    const handleRoleBudgetChange = (role: Role, e: ChangeEvent<HTMLInputElement>) => {
        setRoleBudget((prev: Record<Role, number>) => ({ ...prev, [role]: Math.max(0, parseInt(e.target.value) || 0) }));
    };
    const handleAddTarget = (p: Player) => {
        if (targetPlayers.some((tp: TargetPlayer) => tp.id === p.id)) return;
        setTargetPlayers((prev: TargetPlayer[]) => [...prev, { ...p, maxBid: 0 }]);
        setQuery('');
        setShowSuggestions(false);
    };
    const handleBidChange = (id: string, bid: number) => {
        setTargetPlayers((prev: TargetPlayer[]) => prev.map((tp: TargetPlayer) => tp.id === id ? { ...tp, maxBid: bid } : tp));
    };
    const handleRemoveTarget = (id?: string) => {
        if (id) {
            setTargetPlayers((prev: TargetPlayer[]) => prev.filter((tp: TargetPlayer) => tp.id !== id));
        } else {
            setTargetPlayers([]);
        }
    };
    const handleClear = () => {
        if (!window.confirm('Sei sicuro di voler resettare la strategia? Tutte le modifiche non salvate andranno perse.')) {
            return;
        }
        setRoleBudget({
            [Role.GK]: 8,
            [Role.DEF]: 22,
            [Role.MID]: 35,
            [Role.FWD]: 35,
        });
        setTargetPlayers([]);
    };
    // Suggestions logic
    const targetPlayerIds = useMemo(() => new Set(targetPlayers.map((p: TargetPlayer) => p.id)), [targetPlayers]);
    const suggestions = useMemo(() => {
        if (!query) return [];
        return players.filter((p: Player) =>
            !targetPlayerIds.has(p.id) && p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }, [query, players, targetPlayerIds]);

    // Budget calculations
    const totalPercentage = useMemo(() => Object.values(roleBudget).reduce((sum: number, p: number) => sum + p, 0), [roleBudget]);
    const plannedSpendingByRole = useMemo(() => {
        const spending: Record<Role, number> = { [Role.GK]: 0, [Role.DEF]: 0, [Role.MID]: 0, [Role.FWD]: 0 };
        targetPlayers.forEach((p: TargetPlayer) => {
            const bid = Number(p.maxBid);
            spending[p.role] += isNaN(bid) ? 0 : bid;
        });
        return spending;
    }, [targetPlayers]);
    const totalPlannedSpending = useMemo(() => {
        return targetPlayers.reduce((sum: number, p: TargetPlayer) => {
            const bid = Number(p.maxBid);
            return sum + (isNaN(bid) ? 0 : bid);
        }, 0);
    }, [targetPlayers]);
    const remainingBudget = leagueSettings.budget - totalPlannedSpending;

    // Save/load logic
    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            const targetPlayersPayload = targetPlayers.map((p: TargetPlayer) => ({ id: p.id, maxBid: p.maxBid }));
            const resp = await fetch(`${BASE_URL}/api/strategy-board`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ roleBudget, targetPlayers: targetPlayersPayload }),
            });
            if (resp.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
            }
        } catch {
            setSaveStatus('error');
        }
    };

    useEffect(() => {
        // Load strategy board on mount
        const fetchStrategyBoard = async () => {
            if (!idToken) return;
            try {
                const resp = await fetch(`${BASE_URL}/api/strategy-board`, {
                    headers: { Authorization: `Bearer ${idToken}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data.targetPlayer)) {
                        setTargetPlayers([]); // Clear all first
                        data.targetPlayer.forEach((player: any) => {
                            const match = players.find(
                                (p: Player) => p.name === player.nome && p.role === player.ruolo && p.price === player.quota_attuale
                            );
                            const syntheticId = `${player.nome}_${player.ruolo}_${player.quota_attuale}`;
                            setTargetPlayers((prev: TargetPlayer[]) => [...prev, {
                                id: syntheticId,
                                name: player.nome,
                                role: player.ruolo,
                                price: player.quota_attuale,
                                maxBid: Number(player.max_bid),
                                team: match ? match.team : '',
                            }]);
                        });
                    }
                }
            } catch (e) {
                // Ignore errors for now
            }
        };
        fetchStrategyBoard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-base-200 p-4 md:p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-brand-primary mb-1">Tavolo Strategia</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="bg-base-300 text-content-200 px-4 py-2 rounded-lg font-semibold hover:bg-base-400 transition"
                        type="button"
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-brand-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-secondary transition disabled:opacity-50"
                        disabled={saveStatus === 'saving'}
                    >
                        {saveStatus === 'saving' ? 'Salvataggio...' : saveStatus === 'success' ? 'Salvato!' : 'Salva'}
                    </button>
                </div>
            </div>
            <p className="text-content-200 mb-6">Crea la tua lista di obiettivi e pianifica il tuo budget per l'asta, sia per ruolo che per singolo giocatore.</p>
            {/* Riepilogo budget complessivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-100 p-4 rounded-lg mb-6 border border-base-300">
                <div className="text-center">
                    <p className="text-sm text-content-200">Spesa Pianificata Totale</p>
                    <p className="text-2xl font-bold text-red-400">{totalPlannedSpending} Cr</p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-content-200">Budget Rimanente Globale</p>
                    <p className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-500'}`}>{remainingBudget} Cr</p>
                </div>
            </div>
            {/* Allocazione Budget per Ruolo */}
            <div className="mb-8 p-4 bg-base-100 rounded-lg border border-base-300">
                <h3 className="text-xl font-bold text-content-100 mb-4 flex items-center"><PieChart className="w-6 h-6 mr-3 text-brand-primary"/>Allocazione Budget per Ruolo</h3>
                {totalPercentage !== 100 && (
                    <div className="flex items-center p-3 mb-4 text-sm text-yellow-300 bg-yellow-900/50 rounded-lg border border-yellow-700">
                        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                        L'allocazione totale è del <strong>{totalPercentage}%</strong>. La somma delle percentuali dovrebbe essere 100%.
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {ROLES_ORDER.map(role => {
                        const allocated = Math.round((leagueSettings.budget * roleBudget[role]) / 100);
                        const planned = plannedSpendingByRole[role];
                        const progress = allocated > 0 ? Math.min((planned / allocated) * 100, 100) : 0;
                        const isOverbudget = planned > allocated;
                        return (
                            <div key={role} className="bg-base-200 p-3 rounded-md">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="font-semibold text-content-100">{ROLE_NAMES[role]}</label>
                                    <div className="flex items-center bg-base-300 rounded-md">
                                        <input 
                                            type="number" 
                                            value={roleBudget[role]}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRoleBudgetChange(role, e)}
                                            className="w-16 bg-transparent text-right font-bold text-content-100 p-1 focus:outline-none"
                                        />
                                        <span className="mr-2 text-content-200 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-content-200 mb-1">
                                    <span>Pianificati: <span className="font-bold">{planned}</span> Cr</span>
                                    <span>Allocati: <span className="font-bold">{allocated}</span> Cr</span>
                                </div>
                                <div className="w-full bg-base-300 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full transition-all duration-300 ${isOverbudget ? 'bg-red-500' : 'bg-brand-primary'}`}
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            <div className="relative mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-200" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Cerca un giocatore da aggiungere alla lista obiettivi..."
                        className="w-full bg-base-100 border border-base-300 rounded-lg pl-10 pr-4 py-3 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"
                    />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-base-300 border border-base-300/50 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {suggestions.map((player: Player) => (
                            <li key={player.id} onClick={() => handleAddTarget(player)} className="px-4 py-3 cursor-pointer hover:bg-brand-primary/20 flex justify-between items-center transition-colors">
                                <span>{player.name} <span className="text-sm text-content-200">({player.team})</span></span>
                                <span className="text-xs font-bold bg-base-100 px-2 py-1 rounded-md">{player.role}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b border-base-300">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-content-200">Giocatore</th>
                            <th className="p-3 text-sm font-semibold text-content-200 text-center">Ruolo</th>
                            <th className="p-3 text-sm font-semibold text-content-200 text-center">Consigliato</th>
                            <th className="p-3 text-sm font-semibold text-content-200 text-center">Mio Max Bid</th>
                            <th className="p-3 text-sm font-semibold text-content-200 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {targetPlayers.map((player: TargetPlayer) => {
                            const scaleFactor = leagueSettings.budget / 500;
                            const baseCost = Math.round((player.price ?? 0) * scaleFactor);
                            const recommendedBid = Math.round(baseCost * 1.15);
                            return (
                                <tr key={player.id} className="border-b border-base-300/50 hover:bg-base-100/50">
                                    <td className="p-3">
                                        <p className="font-bold text-content-100">{player.name}</p>
                                        <p className="text-sm text-content-200">{player.team}</p>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="font-mono bg-base-100 px-2 py-1 rounded">{player.role}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="font-mono bg-base-100 px-2 py-1 rounded text-content-100">{recommendedBid}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <input
                                            type="number"
                                            value={!isNaN(Number(player.maxBid)) ? Number(player.maxBid) : 0}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleBidChange(player.id, parseInt(e.target.value, 10) || 0)}
                                            className="w-24 bg-base-100 border border-base-300 rounded-md p-1 text-center font-bold text-brand-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                                        />
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleRemoveTarget(player.id)} className="p-2 text-content-200 hover:text-red-400 rounded-full hover:bg-red-500/10">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {targetPlayers.length === 0 && (
                    <div className="text-center py-12 text-content-200">
                        <Info className="w-10 h-10 mx-auto mb-3" />
                        <p className="font-semibold">La tua lista di obiettivi è vuota.</p>
                        <p className="text-sm">Usa la vista "Esplora Giocatori" per aggiungere i tuoi preferiti.</p>
                    </div>
                )}
            </div>
        </div>
    );
};