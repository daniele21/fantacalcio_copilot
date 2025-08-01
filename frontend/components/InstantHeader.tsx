import React from 'react';
import { Player, MyTeamPlayer, LeagueSettings, Role } from '../types';
import { Coins, UserMinus } from 'lucide-react';

interface InstantHeaderProps {
    player: Player;
    currentPrice: number;
    myTeam: MyTeamPlayer[];
    leagueSettings: LeagueSettings;
}

const getRoleAbbreviation = (role: Role) => {
    switch(role) {
        case Role.GK: return 'POR';
        case Role.DEF: return 'DIF';
        case Role.MID: return 'CEN';
        case Role.FWD: return 'ATT';
    }
}

export const InstantHeader: React.FC<InstantHeaderProps> = ({ player, currentPrice, myTeam, leagueSettings }) => {

    const suggestedCap = React.useMemo(() => {
        const scaleFactor = leagueSettings.budget / 500;
        const scaledCost = (player.baseCost ?? 0) * scaleFactor;
        return Math.round(scaledCost * 1.15);
    }, [player, leagueSettings.budget]);

    const { budgetAfterWin, slotsAfterWin } = React.useMemo(() => {
        const currentSpent = myTeam.reduce((sum, p) => sum + p.purchasePrice, 0);
        const totalSlots = Object.values(leagueSettings.roster).reduce((sum, count) => sum + count, 0);
        
        const _budgetAfterWin = leagueSettings.budget - currentSpent - currentPrice;
        const _slotsAfterWin = totalSlots - myTeam.length - 1;

        return { budgetAfterWin: _budgetAfterWin, slotsAfterWin: _slotsAfterWin };
    }, [myTeam, leagueSettings, currentPrice]);

    const budgetColor = budgetAfterWin < 0 ? 'text-red-400' : 'text-green-400';

    return (
        <>
            <div className="fixed top-16 left-0 right-0 bg-base-200/80 backdrop-blur-lg border-b border-base-300/50 z-40 animate-slide-in-down shadow-lg">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    
                    {/* Left placeholder to balance the flexbox for centering the middle element */}
                    <div className="flex-1 hidden md:block"></div>

                    {/* Center: Player Info */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                        <h2 className="text-xl font-bold text-content-100 tracking-tight truncate max-w-full">
                            {player.player_name}
                            <span className="ml-2 text-base font-semibold text-brand-primary">
                                – {getRoleAbbreviation(player.position)}
                            </span>
                        </h2>
                        <div className="flex items-baseline space-x-3 mt-1">
                            <p className="text-sm font-medium text-content-100 whitespace-nowrap">
                               {currentPrice} crediti
                            </p>
                            <p className="text-xs text-content-200 whitespace-nowrap">
                                (cap {suggestedCap})
                            </p>
                        </div>
                    </div>
                    
                    {/* Right: Budget Impact */}
                    <div className="flex-1 flex justify-end items-center space-x-2 sm:space-x-4">
                        <div className="flex items-center space-x-2 text-sm">
                            <Coins className={`w-5 h-5 flex-shrink-0 ${budgetColor}`} />
                            <div className="text-right">
                                <p className={`font-bold text-base ${budgetColor}`}>{budgetAfterWin}</p>
                                <p className="text-xs text-content-200 hidden sm:block">Crediti Rim.</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                            <UserMinus className="w-5 h-5 flex-shrink-0 text-content-100" />
                            <div className="text-right">
                                <p className="font-bold text-base text-content-100">{slotsAfterWin}</p>
                                <p className="text-xs text-content-200 hidden sm:block">Slot Rim.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
             <style>{`
                @keyframes slide-in-down {
                    from {
                        opacity: 0;
                        transform: translateY(-100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-slide-in-down {
                    animation: slide-in-down 0.3s ease-out forwards;
                }
            `}</style>
        </>
    );
};