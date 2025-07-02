import React, { useState, useMemo, ChangeEvent, useEffect } from 'react';
import { Player, TargetPlayer, LeagueSettings, Role } from '../types';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';
import { Search, Trash2, AlertTriangle, PieChart, Info, Save, RotateCcw, Loader2 } from 'lucide-react';
import { saveStrategyBoardBudget, getStrategyBoardBudget } from '../services/strategyBoardBudgetService';
import { saveStrategyBoard } from '../services/strategyBoardService';
import { useAuth } from '../services/AuthContext';

interface StrategyBoardViewProps {
    players: Player[];
    leagueSettings: LeagueSettings;
    roleBudget: Record<Role, number>;
    onRoleBudgetChange: (value: Record<Role, number>) => void;
    targetPlayers: TargetPlayer[];
    onAddTarget: (player: Player) => void;
    onRemoveTarget: (playerId: number) => void;
    onBidChange: (playerId: number, newBid: number) => void;
    onSaveChanges: () => void;
    onResetChanges: () => void;
    isSaving: boolean;
}

export const StrategyBoardView: React.FC<StrategyBoardViewProps> = ({
    players,
    leagueSettings,
    roleBudget,
    onRoleBudgetChange,
    targetPlayers,
    onAddTarget,
    onRemoveTarget,
    onBidChange,
    onSaveChanges,
    onResetChanges,
    isSaving,
}) => {
    const { idToken, isLoggedIn } = useAuth();
    const [query, setQuery] = useState<string>('');
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

    useEffect(() => {
        if (!isLoggedIn || !idToken) return;
        getStrategyBoardBudget(idToken).then(budget => {
            if (budget) {
                onRoleBudgetChange({
                    [Role.GK]: budget.role_budget_gk,
                    [Role.DEF]: budget.role_budget_def,
                    [Role.MID]: budget.role_budget_mid,
                    [Role.FWD]: budget.role_budget_fwd,
                });
            }
        });
        // eslint-disable-next-line
    }, [isLoggedIn, idToken]);

    const handleRoleBudgetChange = (role: Role, e: ChangeEvent<HTMLInputElement>) => {
        const newRoleBudget = { ...roleBudget, [role]: Math.max(0, parseInt(e.target.value) || 0) };
        onRoleBudgetChange(newRoleBudget);
    };

    const targetPlayerIds = useMemo(() => new Set(targetPlayers.map(p => p.id)), [targetPlayers]);

    const suggestions = useMemo(() => {
        if (!query) return [];
        return players.filter(p =>
            !targetPlayerIds.has(p.id) && p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }, [query, players, targetPlayerIds]);

    const handleAddTargetAndClearQuery = (player: Player) => {
        onAddTarget(player);
        setQuery('');
        setShowSuggestions(false);
    };

    const totalPercentage = useMemo(() => Object.values(roleBudget).reduce((sum, p) => sum + p, 0), [roleBudget]);
    
    const plannedSpendingByRole = useMemo(() => {
        const spending: Record<Role, number> = { [Role.GK]: 0, [Role.DEF]: 0, [Role.MID]: 0, [Role.FWD]: 0 };
        targetPlayers.forEach(p => {
            const bid = Number(p.maxBid);
            spending[p.role] += isNaN(bid) ? 0 : bid;
        });
        return spending;
    }, [targetPlayers]);

    const totalPlannedSpending = useMemo(() => {
        return Object.values(plannedSpendingByRole).reduce((sum, spending) => sum + spending, 0);
    }, [plannedSpendingByRole]);

    const remainingBudget = leagueSettings.budget - totalPlannedSpending;

    const handleSaveBudget = async () => {
        if (!isLoggedIn || !idToken) return;
        const budget = {
            role_budget_gk: roleBudget[Role.GK],
            role_budget_def: roleBudget[Role.DEF],
            role_budget_mid: roleBudget[Role.MID],
            role_budget_fwd: roleBudget[Role.FWD],
        };
        // Save both budget and targetPlayers (maxBid)
        await Promise.all([
            saveStrategyBoardBudget(idToken, budget),
            saveStrategyBoard(idToken, targetPlayers)
        ]);
    };

    return (
        <div className="bg-base-200 p-4 md:p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-brand-primary mb-1">Tavolo Strategia</h2>
            </div>
            <p className="text-content-200 mb-6">Crea la tua lista di obiettivi e pianifica il tuo budget per l'asta, sia per ruolo che per singolo giocatore.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-100 p-4 rounded-lg mb-6 border border-base-300 items-center">
                <div className="text-center">
                    <p className="text-sm text-content-200">Spesa Pianificata</p>
                    <p className="text-2xl font-bold text-red-400">{totalPlannedSpending} Cr</p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-content-200">Budget Rimanente</p>
                    <p className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-500'}`}>{remainingBudget} Cr</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center md:justify-end">
                    <button
                        onClick={onResetChanges}
                        disabled={isSaving}
                        className="flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md bg-base-300 text-content-200 hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </button>
                    <button
                        onClick={handleSaveBudget}
                        disabled={isSaving}
                        className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-secondary transition-colors disabled:opacity-60"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Salvataggio...' : 'Salva Budget'}
                    </button>
                </div>
            </div>
            
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
                                            onChange={(e) => handleRoleBudgetChange(role, e)}
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
                        onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Cerca un giocatore da aggiungere alla lista obiettivi..."
                        className="w-full bg-base-100 border border-base-300 rounded-lg pl-10 pr-4 py-3 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"
                    />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-base-300 border border-base-300/50 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {suggestions.map(player => (
                            <li key={player.id} onClick={() => handleAddTargetAndClearQuery(player)} className="px-4 py-3 cursor-pointer hover:bg-brand-primary/20 flex justify-between items-center transition-colors">
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
                        {targetPlayers.map(player => {
                            const scaleFactor = leagueSettings.budget / 500;
                            const baseCost = Math.round((player.baseCost ?? 0) * scaleFactor);
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
                                            onChange={(e) => onBidChange(player.id, parseInt(e.target.value, 10) || 0)}
                                            className="w-24 bg-base-100 border border-base-300 rounded-md p-1 text-center font-bold text-brand-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                                        />
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => onRemoveTarget(player.id)} className="p-2 text-content-200 hover:text-red-400 rounded-full hover:bg-red-500/10">
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
                        <p className="text-sm">Usa la vista "Esplora Giocatori" o cerca qui sopra per aggiungere i tuoi preferiti.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
