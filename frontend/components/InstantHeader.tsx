import React from 'react';
// ROI Gauge logic (copied from InsightColumn)
const calculateOpportunityScore = (currentBid: number, player: Player, myTeam: MyTeamPlayer[], settings: LeagueSettings): number => {
    if (currentBid <= 0) return 50;
    const scaleFactor = settings.budget / 500;
    const scaledBaseCost = (player.baseCost ?? 0) * scaleFactor;
    const recommendationModifier = 1 + ((player.stars - 3) * 0.05);
    const fairValue = scaledBaseCost * recommendationModifier;
    const greatDealPrice = fairValue * 0.7;
    const overpayPrice = fairValue * 1.5;
    let final_score;

    let score: number;
    if (currentBid <= greatDealPrice) score = 100;
    else if (currentBid >= overpayPrice) score = 0;
    else {
        const priceRange = overpayPrice - greatDealPrice;
        score = 100 * (1 - ((currentBid - greatDealPrice) / priceRange));
    }

    const spentBudget = myTeam.reduce((sum, p) => sum + p.purchasePrice, 0);
    const remainingBudget = settings.budget - spentBudget;
    const slotsToFill = Object.values(settings.roster).reduce((sum, count) => sum + count, 0) - myTeam.length;
    if (slotsToFill <= 0 || currentBid > remainingBudget) return 0;
    
    const avgCreditPerSlot = remainingBudget / slotsToFill;
    const budgetPressureRatio = currentBid / avgCreditPerSlot;
    if (budgetPressureRatio > 1.5) {
        score -= Math.min(30, (budgetPressureRatio - 1.5) * 20);
    }
    final_score = Math.max(0, Math.min(100, Math.round(score)));
    return final_score;
};

const getROILabelStyle = (s: number) => s > 70 ? 'text-green-400' : s > 30 ? 'text-yellow-400' : 'text-red-400';
const getROILabelText = (s: number) => {
    const label = s > 70 ? 'Ottimo Affare' : s > 30 ? 'Prezzo Giusto' : 'Sopravvalutato';
    return label;
};
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

export const InstantHeader = React.forwardRef<HTMLDivElement, InstantHeaderProps>(
    ({ player, currentPrice, myTeam, leagueSettings }, ref) => {
    // ROI Gauge calculation
    const roiScore = React.useMemo(() => calculateOpportunityScore(currentPrice, player, myTeam, leagueSettings), [currentPrice, player, myTeam, leagueSettings]);
    const suggestedCap = React.useMemo(() => {
        const scaleFactor = leagueSettings.budget / 500;
        const scaledCost = (player.baseCost ?? 0) * scaleFactor;
        return Math.round(scaledCost);
    }, [player, leagueSettings.budget]);

    // Calculate slots remaining for the player's role
    const slotsForRole = React.useMemo(() => {
        const role = player.position as Role;
        const total = leagueSettings.roster[role] || 0;
        const taken = myTeam.filter(p => p.position === role).length;
        return total - taken - 1;
    }, [leagueSettings, myTeam, player.position]);

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
            <div
                ref={ref}
                className="instant-header-top bg-base-100 border-b border-base-200 shadow-[0_2px_8px_0_rgba(0,0,0,0.04)] w-full px-2 xs:px-4 sm:px-6 lg:px-8 py-2 sm:py-3 min-h-[56px] sm:min-h-[72px] animate-slide-in-down"
                style={{
                    zIndex: 2147483648, // must be higher than app header
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    pointerEvents: 'none',
                    marginTop: 0,
                    width: '100%',
                    height: '20%'
                }}
            >
                <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 sm:gap-4 w-full min-w-0" style={{pointerEvents: 'auto', overflowX: 'auto'}}>
                    {/* Player Info */}
                    <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 w-full sm:w-auto">
                        <h2 className="text-base xs:text-lg sm:text-2xl font-extrabold text-content-100 tracking-tight truncate max-w-full flex items-center gap-1 sm:gap-2">
                            {player.player_name}
                            <span className="ml-1 sm:ml-2 text-xs xs:text-sm sm:text-base font-semibold text-brand-primary">– {getRoleAbbreviation(player.position as Role)}</span>
                        </h2>
                        <div className="flex flex-wrap items-baseline gap-1 xs:gap-2 sm:gap-3 mt-1 justify-center sm:justify-start">
                            <span className="text-sm xs:text-base sm:text-lg font-bold text-brand-primary">{currentPrice} crediti</span>
                            <span className="text-xs sm:text-sm text-content-200 bg-brand-primary/10 border border-brand-primary/20 rounded px-2 py-0.5 font-semibold">Consigliato: {suggestedCap}</span>
                            <span className="text-xs sm:text-sm font-semibold rounded px-2 py-0.5 ml-0 sm:ml-1 bg-blue-500/10 border border-blue-500/20 text-blue-500">Slot {getRoleAbbreviation(player.position as Role)} rim.: {slotsForRole >= 0 ? slotsForRole : 0}</span>
                        </div>
                    </div>
                    {/* Budget Impact + ROI (mobile: ROI left of Crediti Rim.) */}
                    <div className="flex flex-row sm:flex-row gap-2 xs:gap-3 sm:gap-6 items-center justify-center flex-shrink-0 w-full sm:w-auto">
                        {/* ROI left of Crediti Rim. on mobile, above on desktop */}
                        <div className="flex flex-col items-center justify-center px-2 order-1 sm:order-none">
                            <span className={`text-lg sm:text-xl font-bold ${getROILabelStyle(roiScore)}`}>{getROILabelText(roiScore)}</span>
                            <span className={`text-xs sm:text-sm font-semibold ${getROILabelStyle(roiScore)}`}>ROI</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm order-2 sm:order-none">
                            <Coins className={`w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 flex-shrink-0 ${budgetColor}`} />
                            <div className="text-right">
                                <p className={`font-bold text-sm xs:text-base sm:text-lg ${budgetColor}`}>{budgetAfterWin}</p>
                                <p className="text-xs text-content-200">Crediti Rim.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm order-3 sm:order-none">
                            <UserMinus className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 flex-shrink-0 text-content-100" />
                            <div className="text-right">
                                <p className="font-bold text-sm xs:text-base sm:text-lg text-content-100">{slotsAfterWin}</p>
                                <p className="text-xs text-content-200">Slot Rim.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .instant-header-top {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    z-index: 2147483648 !important;
                    width: 100vw !important;
                    height: 16%
                }
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
                    animation: slide-in-down 0.3s cubic-bezier(0.4,0,0.2,1) forwards;
                }
            `}</style>
        </>
    );
    }
);