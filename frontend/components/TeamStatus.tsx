import React, { useMemo } from 'react';
import { MyTeamPlayer, LeagueSettings, Role } from '../types';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';
import { Wallet, Users, Shirt, Trash2, PieChart } from 'lucide-react';

const ROLE_ICONS: { [key in Role]: string } = {
  [Role.GK]: '🧤',
  [Role.DEF]: '🛡️',
  [Role.MID]: '⚽',
  [Role.FWD]: '🎯',
};

interface TeamStatusProps {
    myTeam: MyTeamPlayer[];
    leagueSettings: LeagueSettings;
    roleBudget: Record<Role, number>;
}

export const TeamStatus: React.FC<TeamStatusProps> = ({ myTeam, leagueSettings, roleBudget }) => {
    // Map backend roster keys to frontend keys if needed
    function mapRosterKeys(roster: any) {
        if (!roster) return { POR: 0, DIF: 0, CEN: 0, ATT: 0 };
        // If already mapped, return as is
        if ('POR' in roster && 'DIF' in roster && 'CEN' in roster && 'ATT' in roster) return roster;
        return {
            POR: roster.P ?? 0,
            DIF: roster.D ?? 0,
            CEN: roster.C ?? 0,
            ATT: roster.A ?? 0,
        };
    }
    const mappedRoster = mapRosterKeys(leagueSettings.roster);

    // Defensive: keep last valid roster
    const lastValidRoster = React.useRef(mappedRoster);
    React.useEffect(() => {
        if (mappedRoster && Object.values(mappedRoster).every(v => typeof v === 'number' && v > 0)) {
            lastValidRoster.current = mappedRoster;
        }
    }, [mappedRoster]);
    const safeRoster = mappedRoster && Object.values(mappedRoster).every(v => typeof v === 'number' && v > 0)
        ? mappedRoster
        : lastValidRoster.current;
    
    // console.log('TeamStatus leagueSettings:', leagueSettings);
    
    const budgetInfo = useMemo(() => {
        const spent = myTeam.reduce((sum, p) => sum + p.purchasePrice, 0);
        const remaining = leagueSettings.budget - spent;
        const percentage = (spent / leagueSettings.budget) * 100;
        return { spent, remaining, percentage };
    }, [myTeam, leagueSettings.budget]);

    const rosterInfo = useMemo(() => {
        const counts = myTeam.reduce((acc, p) => {
            acc[p.role] = (acc[p.role] || 0) + 1;
            return acc;
        }, {} as Record<Role, number>);

        return ROLES_ORDER.map(role => {
            const max = safeRoster?.[role] ?? 0;
            if (max === 0) {
                console.warn(`Missing or zero max value for role '${role}' in leagueSettings.roster`);
            }
            return {
                role,
                name: ROLE_NAMES[role],
                current: counts[role] || 0,
                max,
                missing: max === 0
            };
        });
    }, [myTeam, safeRoster]);
    
    const spentByRole = useMemo(() => {
        const spending: Record<Role, number> = { [Role.GK]: 0, [Role.DEF]: 0, [Role.MID]: 0, [Role.FWD]: 0 };
        myTeam.forEach(p => {
            spending[p.role] += p.purchasePrice;
        });
        return spending;
    }, [myTeam]);


    return (
        <div className="bg-base-200 rounded-2xl shadow-2xl p-5">
            <h2 className="text-2xl font-extrabold text-brand-primary flex items-center mb-5"><Wallet className="w-7 h-7 mr-3"/>Stato Squadra</h2>
            <div className="space-y-8">
                {/* Budget */}
                <div>
                    <h3 className="font-semibold text-content-100 mb-2 text-lg">Budget Globale</h3>
                    <div className="w-full bg-base-300 rounded-full h-3 mb-2">
                        <div className="bg-brand-primary h-3 rounded-full transition-all duration-300" style={{ width: `${budgetInfo.percentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-base mt-1">
                        <span className="text-content-200">Spesi: <span className="font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded">{budgetInfo.spent}</span></span>
                        <span className="text-content-200">Rimanenti: <span className="font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">{budgetInfo.remaining}</span></span>
                    </div>
                </div>

                {/* Roster Slots */}
                <div>
                    <h3 className="font-semibold text-content-100 mb-3 text-lg">Slot Rosa</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {rosterInfo.map(({ role, name, current, max, missing }) => (
                            <div key={role} className="flex justify-between items-center text-base">
                                <span className="flex items-center gap-2 text-content-200">{ROLE_ICONS[role]} {name}</span>
                                <span className={`font-bold px-2 py-0.5 rounded
                                    ${current === max && !missing ? 'bg-green-100 text-green-600' : 'bg-base-300 text-content-100'}
                                    ${missing ? 'border border-red-500 text-red-500' : ''}
                                `}>{current}/{max}{missing ? ' ⚠️' : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Allocazione Budget per Ruolo */}
                <div className="pt-6 border-t border-base-300">
                    <h3 className="text-lg font-bold text-content-100 mb-3 flex items-center"><PieChart className="w-5 h-5 mr-3 text-brand-primary"/>Stato Budget per Ruolo</h3>
                    <div className="grid grid-cols-1 gap-y-3">
                        {ROLES_ORDER.map(role => {
                            const allocatedAmount = Math.round((leagueSettings.budget * roleBudget[role]) / 100);
                            const spentAmount = spentByRole[role];
                            const progress = allocatedAmount > 0 ? Math.min((spentAmount / allocatedAmount) * 100, 100) : 0;
                            const isOverbudget = spentAmount > allocatedAmount;
                            return (
                                <div key={role} className="bg-base-100 p-3 rounded-lg shadow-sm">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="font-semibold text-content-100 flex items-center gap-2">{ROLE_ICONS[role]} {ROLE_NAMES[role]}</label>
                                        <div className="font-bold text-content-100 bg-base-300 px-2 py-0.5 rounded-md text-sm">
                                            {roleBudget[role]}%
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-content-200 mb-1">
                                        <span>Spesi: <span className="font-bold">{spentAmount}</span> Cr</span>
                                        <span>Allocati: <span className="font-bold">{allocatedAmount}</span> Cr</span>
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

                {/* Giocatori Acquistati */}
                <div className="pt-6 border-t border-base-300">
                    <h3 className="font-semibold text-content-100 mb-3 flex items-center text-lg">
                        <Shirt className="w-5 h-5 mr-2"/>
                        Rosa Attuale ({myTeam.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {myTeam.length === 0 ? (
                            <p className="text-base text-content-200 text-center py-4">Nessun giocatore ancora acquistato.</p>
                        ) : (
                            [...myTeam].sort((a,b) => ROLES_ORDER.indexOf(a.role) - ROLES_ORDER.indexOf(b.role) || b.purchasePrice - a.purchasePrice).map(player => (
                                <div key={player.id} className="flex justify-between items-center bg-base-100 p-2 rounded-lg text-base shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{ROLE_ICONS[player.role]}</span>
                                        <span className="font-bold">{player.name}</span>
                                        <span className="text-xs text-content-200 ml-2">({player.team})</span>
                                    </div>
                                    <span className="font-bold bg-brand-primary/20 text-brand-primary px-2 py-1 rounded">
                                        {player.purchasePrice}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};