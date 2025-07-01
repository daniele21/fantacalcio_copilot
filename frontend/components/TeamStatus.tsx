import React, { useMemo } from 'react';
import { MyTeamPlayer, LeagueSettings, Role } from '../types';
import { Wallet, Users, Shirt, Trash2, PieChart } from 'lucide-react';

interface TeamStatusProps {
    myTeam: MyTeamPlayer[];
    leagueSettings: LeagueSettings;
    roleBudget: Record<Role, number>;
}

const ROLES_ORDER: Role[] = [Role.GK, Role.DEF, Role.MID, Role.FWD];
const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'Portieri', [Role.DEF]: 'Difensori', [Role.MID]: 'Centrocampisti', [Role.FWD]: 'Attaccanti' };

export const TeamStatus: React.FC<TeamStatusProps> = ({ myTeam, leagueSettings, roleBudget }) => {
    
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

        return ROLES_ORDER.map(role => ({
            role,
            name: ROLE_NAMES[role],
            current: counts[role] || 0,
            max: leagueSettings.roster[role],
        }));
    }, [myTeam, leagueSettings.roster]);
    
    const spentByRole = useMemo(() => {
        const spending: Record<Role, number> = { [Role.GK]: 0, [Role.DEF]: 0, [Role.MID]: 0, [Role.FWD]: 0 };
        myTeam.forEach(p => {
            spending[p.role] += p.purchasePrice;
        });
        return spending;
    }, [myTeam]);


    return (
        <div className="bg-base-200 rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-bold text-brand-primary flex items-center mb-4"><Wallet className="w-6 h-6 mr-3"/>Stato Squadra</h2>
            <div className="space-y-6">
                {/* Budget */}
                <div className="mb-6">
                    <h3 className="font-semibold text-content-100 mb-2">Budget Globale</h3>
                    <div className="w-full bg-base-300 rounded-full h-2.5 mb-2">
                        <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${budgetInfo.percentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-content-200">Spesi: <span className="font-bold text-red-400">{budgetInfo.spent}</span></span>
                        <span className="text-content-200">Rimanenti: <span className="font-bold text-green-400">{budgetInfo.remaining}</span></span>
                    </div>
                </div>

                {/* Roster Slots */}
                <div>
                    <h3 className="font-semibold text-content-100 mb-3">Slot Rosa</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {rosterInfo.map(({ role, name, current, max }) => (
                            <div key={role} className="flex justify-between items-center text-sm">
                                <span className="text-content-200">{name}</span>
                                <span className={`font-bold ${current === max ? 'text-brand-primary' : 'text-content-100'}`}>
                                    {current}/{max}
                                </span>
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
                                <div key={role} className="bg-base-100 p-3 rounded-md">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="font-semibold text-content-100">{ROLE_NAMES[role]}</label>
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
                    <h3 className="font-semibold text-content-100 mb-3 flex items-center">
                        <Shirt className="w-5 h-5 mr-2"/>
                        Rosa Attuale ({myTeam.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {myTeam.length === 0 ? (
                            <p className="text-sm text-content-200 text-center py-4">Nessun giocatore ancora acquistato.</p>
                        ) : (
                            [...myTeam].sort((a,b) => ROLES_ORDER.indexOf(a.role) - ROLES_ORDER.indexOf(b.role) || b.purchasePrice - a.purchasePrice).map(player => (
                                <div key={player.id} className="flex justify-between items-center bg-base-100 p-2 rounded-md text-sm">
                                    <div>
                                        <span className="font-bold">{player.name}</span>
                                        <span className="text-xs text-content-200 ml-2">{`(${player.role})`}</span>
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