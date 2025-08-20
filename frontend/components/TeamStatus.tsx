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
            acc[p.position] = (acc[p.position] || 0) + 1;
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
            spending[p.position] += p.purchasePrice;
        });
        return spending;
    }, [myTeam]);


    return (
        <div className="bg-base-200 rounded-2xl shadow-2xl p-2 sm:p-4 w-full max-w-xl mx-auto animate-fade-in">
            {/* <h2 className="text-xl sm:text-2xl font-extrabold text-brand-primary flex items-center mb-3 sm:mb-5"><Wallet className="w-6 h-6 sm:w-7 sm:h-7 mr-2 sm:mr-3"/>Stato Squadra</h2> */}
            <div className="flex flex-col gap-4 sm:gap-6">
                {/* Budget */}
                <section className="rounded-xl bg-base-100 shadow-sm p-3 sm:p-4 flex flex-col gap-2">
                    <h3 className="font-semibold text-content-100 mb-1 text-base sm:text-lg flex items-center gap-2"><Wallet className="w-5 h-5"/>Budget Globale</h3>
                    <div className="w-full bg-base-300 rounded-full h-2.5 sm:h-3 mb-2">
                        <div className="bg-brand-primary h-2.5 sm:h-3 rounded-full transition-all duration-300" style={{ width: `${budgetInfo.percentage}%` }}></div>
                    </div>
                    <div className="flex flex-wrap justify-between text-sm sm:text-base mt-1 gap-2">
                        <span className="text-content-200">Spesi: <span className="font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded">{budgetInfo.spent}</span></span>
                        <span className="text-content-200">Rimanenti: <span className="font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">{budgetInfo.remaining}</span></span>
                    </div>
                </section>

                {/* Roster Slots */}
                <section className="rounded-xl bg-base-100 shadow-sm p-3 sm:p-4 flex flex-col gap-2">
                    <h3 className="font-semibold text-content-100 mb-2 text-base sm:text-lg flex items-center gap-2"><Users className="w-5 h-5"/>Slot Rosa</h3>
                    <div className="grid grid-cols-2 xs:grid-cols-4 gap-x-2 gap-y-2">
                        {rosterInfo.map(({ role, name, current, max, missing }) => (
                            <div key={role} className="flex flex-col items-center text-sm sm:text-base">
                                <span className="flex items-center gap-1 text-content-200 text-lg">{ROLE_ICONS[role]}</span>
                                <span className="text-xs text-content-200 mb-1">{name}</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-xs sm:text-sm
                                    ${current === max && !missing ? 'bg-green-100 text-green-600' : 'bg-base-300 text-content-100'}
                                    ${missing ? 'border border-red-500 text-red-500' : ''}
                                `}>{current}/{max}{missing ? ' ⚠️' : ''}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Allocazione Budget per Ruolo */}
                <section className="rounded-xl bg-base-100 shadow-sm p-3 sm:p-4 flex flex-col gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-content-100 mb-2 flex items-center gap-2"><PieChart className="w-5 h-5 text-brand-primary"/>Budget per Ruolo</h3>
                    <div className="flex flex-row gap-2 overflow-x-auto pb-1 -mx-1 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:mx-0">
                        {ROLES_ORDER.map(role => {
                            const allocatedAmount = Math.round((leagueSettings.budget * roleBudget[role]) / 100);
                            const spentAmount = spentByRole[role];
                            const progress = allocatedAmount > 0 ? Math.min((spentAmount / allocatedAmount) * 100, 100) : 0;
                            const isOverbudget = spentAmount > allocatedAmount;
                            return (
                                <div key={role} className="min-w-[140px] sm:min-w-0 bg-base-200 p-2 sm:p-3 rounded-lg shadow-sm flex flex-col gap-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="font-semibold text-content-100 flex items-center gap-2">{ROLE_ICONS[role]} {ROLE_NAMES[role]}</label>
                                        <div className="font-bold text-content-100 bg-base-300 px-2 py-0.5 rounded-md text-xs">
                                            {roleBudget[role]}%
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-content-200 mb-1">
                                        <span>Spesi: <span className="font-bold">{spentAmount}</span> Cr</span>
                                        <span>Allocati: <span className="font-bold">{allocatedAmount}</span> Cr</span>
                                    </div>
                                    <div className="w-full bg-base-300 rounded-full h-1.5 sm:h-2">
                                        <div 
                                            className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${isOverbudget ? 'bg-red-500' : 'bg-brand-primary'}`}
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* Giocatori Acquistati */}
                <section className="rounded-xl bg-base-100 shadow-sm p-3 sm:p-4 flex flex-col gap-2">
                    <h3 className="font-semibold text-content-100 mb-2 flex items-center text-base sm:text-lg"><Shirt className="w-5 h-5 mr-2"/>Rosa Attuale <span className="ml-2 text-xs text-content-200">({myTeam.length})</span></h3>
                    <div className="space-y-1 sm:space-y-2 max-h-48 sm:max-h-60 overflow-y-auto pr-0.5 sm:pr-1 custom-scrollbar">
                        {myTeam.length === 0 ? (
                            <p className="text-sm sm:text-base text-content-200 text-center py-3 sm:py-4">Nessun giocatore ancora acquistato.</p>
                        ) : (
                            [...myTeam]
                                .sort((a, b) =>
                                    ROLES_ORDER.indexOf(a.position as Role) - ROLES_ORDER.indexOf(b.position as Role) || b.purchasePrice - a.purchasePrice
                                )
                                .map(player => (
                                    <div key={player.id} className="flex justify-between items-center bg-base-200 p-1.5 sm:p-2 rounded-lg text-sm sm:text-base shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                                            <span className="text-base sm:text-lg">{ROLE_ICONS[player.position as Role]}</span>
                                            <span className="font-bold truncate max-w-[5.5rem] sm:max-w-[7.5rem]">{player.player_name}</span>
                                            <span className="text-xs text-content-200 ml-1 sm:ml-2 truncate">({player.current_team})</span>
                                        </div>
                                        <span className="font-bold bg-brand-primary/20 text-brand-primary px-2 py-1 rounded">
                                            {player.purchasePrice}
                                        </span>
                                    </div>
                                ))
                        )}
                    </div>
                </section>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #4b5563;
                    border-radius: 8px;
                }
            `}</style>
        </div>
    );
};