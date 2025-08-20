import React, { useState, useMemo, ChangeEvent, useEffect } from 'react';
import { NumberStepper } from './NumberStepper';
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
    const [showAllocOverlay, setShowAllocOverlay] = useState(false);

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

    const handleRoleBudgetChange = (role: Role, value: number) => {
        const newRoleBudget = { ...roleBudget, [role]: Math.max(0, value) };
        onRoleBudgetChange(newRoleBudget);
    }

    const targetPlayerIds = useMemo(() => new Set(targetPlayers.map(p => p.id)), [targetPlayers]);

    const suggestions = useMemo(() => {
        if (!query) return [];
        return players.filter(p =>
            !targetPlayerIds.has(p.id) && p.player_name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }, [query, players, targetPlayerIds]);

    const handleAddTargetAndClearQuery = (player: Player) => {
        onAddTarget(player);
        setQuery('');
        setShowSuggestions(false);
    };

    const totalPercentage = useMemo(() => Object.values(roleBudget).reduce((sum, p) => sum + p, 0), [roleBudget]);

    // Show overlay when allocation is not 100%
    useEffect(() => {
        if (totalPercentage !== 100) {
            setShowAllocOverlay(true);
            const timeout = setTimeout(() => setShowAllocOverlay(false), 1000);
            return () => clearTimeout(timeout);
        }
    }, [totalPercentage]);
    
    const plannedSpendingByRole = useMemo(() => {
        const spending: Record<Role, number> = { [Role.GK]: 0, [Role.DEF]: 0, [Role.MID]: 0, [Role.FWD]: 0 };
        targetPlayers.forEach(p => {
            // Use position as the role key
            const bid = Number(p.maxBid);
            const role = p.position;
            if ((role in spending) && !isNaN(bid)) {
                spending[role as Role] += bid;
            }
        });
        return spending;
    }, [targetPlayers]);

    const totalPlannedSpending = useMemo(() => {
        return Object.values(plannedSpendingByRole).reduce((sum, spending) => sum + (isNaN(spending) ? 0 : spending), 0);
    }, [plannedSpendingByRole]);

    const safeBudget = Number(leagueSettings.budget);
    const remainingBudget = !isNaN(safeBudget) ? safeBudget - totalPlannedSpending : 0;

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

    // Helper to color rows by player role
    const getRoleRowBgClass = (role: Role | string) => {
        switch (role) {
            case Role.GK:
            case 'GK':
                return 'bg-yellow-100/40 dark:bg-yellow-900/40';
            case Role.DEF:
            case 'DEF':
                return 'bg-blue-100/40 dark:bg-blue-900/40';
            case Role.MID:
            case 'MID':
                return 'bg-green-100/40 dark:bg-green-900/40';
            case Role.FWD:
            case 'FWD':
                return 'bg-red-100/40 dark:bg-red-900/40';
            default:
                return '';
        }
    };

    return (
        <div className="bg-base-200 p-2 sm:p-4 md:p-6 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-brand-primary mb-1">Tavolo Strategia</h2>
            </div>
            <p className="text-content-200 mb-4 sm:mb-6 text-sm sm:text-base">Crea la tua lista di obiettivi e pianifica il tuo budget per l'asta, sia per ruolo che per singolo giocatore.</p>

            {/* Summary and actions: stack on mobile, row on desktop */}
            <div className="flex flex-col md:grid md:grid-cols-3 gap-2 md:gap-4 bg-base-100 p-2 sm:p-4 rounded-lg mb-4 md:mb-6 border border-base-300 items-center">
                <div className="text-center">
                    <p className="text-xs sm:text-sm text-content-200">Spesa Pianificata</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-400">{totalPlannedSpending} Cr</p>
                </div>
                <div className="text-center">
                    <p className="text-xs sm:text-sm text-content-200">Budget Rimanente</p>
                    <p className={`text-xl sm:text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-500'}`}>{remainingBudget} Cr</p>
                </div>
                <div className="flex flex-row gap-2 justify-center md:justify-end w-full md:w-auto mt-2 md:mt-0">
                    <button
                        onClick={onResetChanges}
                        disabled={isSaving}
                        className="flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-semibold rounded-md bg-base-300 text-content-200 hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </button>
                    <button
                        onClick={handleSaveBudget}
                        disabled={isSaving}
                        className="flex items-center px-3 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-secondary transition-colors disabled:opacity-60 text-xs sm:text-sm"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Salvataggio...' : 'Salva Budget'}
                    </button>
                </div>
            </div>

            {/* Budget allocation section */}
                        <div className="mb-6 md:mb-8 p-2 sm:p-4 bg-base-100 rounded-lg border border-base-300 relative">
                                <h3 className="text-lg sm:text-xl font-bold text-content-100 mb-3 sm:mb-4 flex items-center"><PieChart className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-brand-primary"/>Allocazione Budget per Ruolo</h3>
                                {/* Floating overlay for allocation alert */}
                                {showAllocOverlay && (
                                                                        <div
                                                                            className="fixed left-1/2 top-3 sm:top-10 z-50 -translate-x-1/2 flex items-center px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-yellow-300 bg-yellow-900/90 rounded-lg border border-yellow-700 shadow-lg animate-fade-in-out pointer-events-none max-w-[95vw] sm:max-w-md"
                                                                            style={{ minWidth: 'min-content', wordBreak: 'break-word', textAlign: 'center' }}
                                                                        >
                                                                                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0" />
                                                                                <span className="inline-block">
                                                                                    L'allocazione totale è del <strong className="mx-1">{totalPercentage}%</strong>. La somma delle percentuali dovrebbe essere 100%.
                                                                                </span>
                                                                        </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4">
                                        {ROLES_ORDER.map(role => {
                                                const allocated = Math.round((leagueSettings.budget * roleBudget[role]) / 100);
                                                const planned = plannedSpendingByRole[role];
                                                const progress = allocated > 0 ? Math.min((planned / allocated) * 100, 100) : 0;
                                                const isOverbudget = planned > allocated;
                                                // Icon and color accent by role
                                                let roleIcon = null;
                                                let accent = '';
                                                switch (role) {
                                                    case Role.GK:
                                                        roleIcon = <span className="text-yellow-400 text-lg mr-2">🧤</span>;
                                                        accent = 'border-l-4 border-yellow-400';
                                                        break;
                                                    case Role.DEF:
                                                        roleIcon = <span className="text-blue-400 text-lg mr-2">🛡️</span>;
                                                        accent = 'border-l-4 border-blue-400';
                                                        break;
                                                    case Role.MID:
                                                        roleIcon = <span className="text-green-400 text-lg mr-2">🎯</span>;
                                                        accent = 'border-l-4 border-green-400';
                                                        break;
                                                    case Role.FWD:
                                                        roleIcon = <span className="text-red-400 text-lg mr-2">⚡</span>;
                                                        accent = 'border-l-4 border-red-400';
                                                        break;
                                                    default:
                                                        accent = '';
                                                }
                                                return (
                                                    <div key={role} className={`relative bg-base-200 p-3 sm:p-4 rounded-md shadow-sm flex flex-col gap-1 ${accent} ${isOverbudget ? 'ring-2 ring-red-400' : ''}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1">
                                                                {roleIcon}
                                                                <label className="font-semibold text-content-100 text-xs sm:text-base tracking-wide">{ROLE_NAMES[role]}</label>
                                                            </div>
                                                            <NumberStepper
                                                                value={roleBudget[role]}
                                                                onChange={(val) => handleRoleBudgetChange(role, val)}
                                                                min={0}
                                                                max={100}
                                                                className=""
                                                                inputClassName="text-right"
                                                                rightLabel={<span className="mr-2 text-content-200 font-bold text-xs sm:text-base">%</span>}
                                                                ariaLabelDecrement={`Diminuisci ${ROLE_NAMES[role]}`}
                                                                ariaLabelIncrement={`Aumenta ${ROLE_NAMES[role]}`}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs text-content-200 mb-1">
                                                            <span>Pianificati: <span className="font-bold">{planned}</span> Cr</span>
                                                            <span>Allocati: <span className="font-bold">{allocated}</span> Cr</span>
                                                        </div>
                                                        <div className="w-full bg-base-300 rounded-full h-2 relative">
                                                            <div 
                                                                className={`h-2 rounded-full transition-all duration-300 ${isOverbudget ? 'bg-red-500' : 'bg-brand-primary'}`}
                                                                style={{ width: `${progress}%` }}
                                                            ></div>
                                                            {isOverbudget && (
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-500 font-bold animate-pulse">Over</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                        })}
                                </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-3 sm:mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-200" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Cerca un giocatore da aggiungere alla lista obiettivi..."
                        className="w-full bg-base-100 border border-base-300 rounded-lg pl-10 pr-4 py-2 sm:py-3 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition text-sm sm:text-base"
                    />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-base-300 border border-base-300/50 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {suggestions.map(player => (
                            <li key={player.id} onClick={() => handleAddTargetAndClearQuery(player)} className="px-4 py-2 sm:py-3 cursor-pointer hover:bg-brand-primary/20 flex justify-between items-center transition-colors text-sm sm:text-base">
                                <span>{player.player_name} <span className="text-xs sm:text-sm text-content-200">({player.current_team})</span></span>
                                <span className="text-xs font-bold bg-base-100 px-2 py-1 rounded-md">{player.position}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Target players table: horizontal scroll on mobile */}
            <div className="mt-4 sm:mt-6 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs sm:text-sm rounded-xl overflow-hidden">
                    <thead className="border-b border-base-300 bg-base-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 sm:p-3 font-semibold text-content-200">Giocatore</th>
                            <th className="p-2 sm:p-3 font-semibold text-content-200 text-center">Ruolo</th>
                            <th className="p-2 sm:p-3 font-semibold text-content-200 text-center">Consigliato</th>
                            <th className="p-2 sm:p-3 font-semibold text-content-200 text-center">Mio Max Bid</th>
                            <th className="p-2 sm:p-3 font-semibold text-content-200 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {targetPlayers.map((player, idx) => {
                            const scaleFactor = leagueSettings.budget / 500;
                            const baseCost = Math.round((player.baseCost ?? 0) * scaleFactor);
                            const recommendedBid = Math.round(baseCost * 1.15);
                            const zebra = idx % 2 === 0 ? 'bg-base-200/60' : 'bg-base-100';
                            return (
                                <tr key={player.id} className={`border-b border-base-300/50 hover:bg-brand-primary/10 transition-colors ${getRoleRowBgClass(player.position)} ${zebra}`}>
                                    <td className="p-2 sm:p-3">
                                        <p className="font-bold text-content-100 text-xs sm:text-base truncate max-w-[120px] sm:max-w-[180px]">{player.player_name}</p>
                                        <p className="text-xs sm:text-sm text-content-200 truncate max-w-[120px] sm:max-w-[180px]">{player.current_team}</p>
                                    </td>
                                    <td className="p-2 sm:p-3 text-center">
                                        <span className="font-mono bg-base-100 px-2 py-1 rounded text-xs sm:text-sm">{player.position}</span>
                                    </td>
                                    <td className="p-2 sm:p-3 text-center">
                                        <span className="font-mono bg-base-100 px-2 py-1 rounded text-content-100 text-xs sm:text-sm">{recommendedBid}</span>
                                    </td>
                                    <td className="p-2 sm:p-3 text-center">
                                        <NumberStepper
                                            value={!isNaN(Number(player.maxBid)) ? Number(player.maxBid) : 0}
                                            onChange={(val) => onBidChange(typeof player.id === 'string' ? parseInt(player.id, 10) : player.id, Math.max(0, val))}
                                            min={0}
                                            max={999}
                                            className="bg-base-100 border border-base-300 rounded-md w-fit mx-auto"
                                            inputClassName="text-brand-primary"
                                            ariaLabelDecrement="Diminuisci offerta"
                                            ariaLabelIncrement="Aumenta offerta"
                                        />
                                    </td>
                                    <td className="p-2 sm:p-3 text-right">
                                        <button onClick={() => onRemoveTarget(Number(player.id))} className="p-2 text-content-200 hover:text-red-400 rounded-full hover:bg-red-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {targetPlayers.length === 0 && (
                    <div className="text-center py-8 sm:py-12 text-content-200">
                        <Info className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3" />
                        <p className="font-semibold text-xs sm:text-base">La tua lista di obiettivi è vuota.</p>
                        <p className="text-xs sm:text-sm">Usa la vista \"Esplora Giocatori\" o cerca qui sopra per aggiungere i tuoi preferiti.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
