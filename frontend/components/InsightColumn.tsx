import React, { useState, useMemo, useEffect } from 'react';
import { Player, MyTeamPlayer, LeagueSettings, Role, AuctionResult, PriceTier } from '../types';
import { ChevronDown, TrendingUp, DollarSign, Users, BarChart, FileText, Shield, AlertTriangle, HeartPulse, RectangleHorizontal, UsersRound, Plane } from 'lucide-react';

// --- PROPS INTERFACE ---
interface InsightColumnProps {
    player: Player;
    currentBid: number;
    myTeam: MyTeamPlayer[];
    leagueSettings: LeagueSettings;
    roleBudget: Record<Role, number>;
    auctionLog: Record<number, AuctionResult>;
    players: Player[];
}

// --- HELPER: COLLAPSIBLE SECTION ---
const CollapsibleSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; }> = ({ title, icon, children, defaultOpen = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultOpen);
    return (
        <div className="bg-base-200 rounded-lg shadow-lg">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center p-3 text-left hover:bg-base-300/50 transition-colors"
            >
                <div className="flex items-center">
                    <span className="text-brand-primary">{icon}</span>
                    <h3 className="ml-3 font-semibold text-content-100">{title}</h3>
                </div>
                <ChevronDown className={`w-5 h-5 text-content-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && <div className="p-3 border-t border-base-300">{children}</div>}
        </div>
    );
};

// --- SUB-COMPONENT: ROI GAUGE (FIXED) ---
const calculateOpportunityScore = (currentBid: number, player: Player, myTeam: MyTeamPlayer[], settings: LeagueSettings): number => {
    if (currentBid <= 0) return 50;
    const scaleFactor = settings.budget / 500;
    const scaledBaseCost = (player.baseCost ?? 0) * scaleFactor;
    const recommendationModifier = 1 + ((player.recommendation - 3) * 0.05);
    const fairValue = scaledBaseCost * recommendationModifier;
    const greatDealPrice = fairValue * 0.8;
    const overpayPrice = fairValue * 1.5;

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
    return Math.max(0, Math.min(100, Math.round(score)));
};

const ROIGauge: React.FC<{ score: number, currentBid: number }> = ({ score, currentBid }) => {
    const angle = -90 + (Math.max(0, Math.min(100, score)) / 100) * 180;
    const getLabelStyle = (s: number) => s > 70 ? 'text-green-400' : s > 30 ? 'text-yellow-400' : 'text-red-400';
    const getLabelText = (s: number) => s > 70 ? 'Ottimo Affare' : s > 30 ? 'Prezzo Giusto' : 'Sopravvalutato';

    return (
        <div className="bg-base-200 rounded-lg shadow-lg p-4 flex flex-col items-center">
            <div className="relative w-full max-w-[220px]" style={{ height: '125px' }}>
                <svg viewBox="0 0 200 100" className="w-full h-full absolute top-0 left-0">
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#facc15" />
                            <stop offset="100%" stopColor="#4ade80" />
                        </linearGradient>
                    </defs>
                    <path d="M 10 90 A 80 80 0 0 1 190 90" fill="none" stroke="url(#gaugeGradient)" strokeWidth="16" strokeLinecap="round" />
                    <path d="M 10 90 A 80 80 0 0 1 190 90" fill="none" stroke="rgba(10,10,10,0.4)" strokeWidth="18" strokeDasharray="2 4" strokeLinecap="round"/>
                </svg>
                {/* The Needle */}
                <div 
                    className="absolute bottom-[10px] left-1/2 w-0.5 h-[45%] bg-content-100 rounded-full"
                    style={{ 
                        transform: `translateX(-50%) rotate(${angle}deg)`, 
                        transformOrigin: 'bottom center',
                        transition: 'transform 300ms ease-out'
                    }} 
                />
                <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-content-100 rounded-full border-2 border-base-200"></div>

                 <div className="absolute bottom-[-15px] w-full text-center">
                    <div className="text-3xl font-bold text-content-100">{currentBid} <span className="text-xl">Cr</span></div>
                    <div className={`text-lg font-bold transition-colors duration-300 ${getLabelStyle(score)}`}>{getLabelText(score)}</div>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: ROLE BUDGET IMPACT ---
const RoleBudgetImpactBar: React.FC<{ player: Player; currentBid: number; myTeam: MyTeamPlayer[]; leagueSettings: LeagueSettings; roleBudget: Record<Role, number> }> = ({ player, currentBid, myTeam, leagueSettings, roleBudget }) => {
    const { allocated, spentOnRole, prospective, progress, isOver } = useMemo(() => {
        const allocated = Math.round((leagueSettings.budget * roleBudget[player.role]) / 100);
        const spentOnRole = myTeam.filter(p => p.role === player.role).reduce((sum, p) => sum + p.purchasePrice, 0);
        const prospective = spentOnRole + currentBid;
        const progress = allocated > 0 ? Math.min((prospective / allocated) * 100, 100) : 100;
        const isOver = prospective > allocated;
        return { allocated, spentOnRole, prospective, progress, isOver };
    }, [player, currentBid, myTeam, leagueSettings, roleBudget]);

    return (
        <div className="bg-base-200 rounded-lg shadow-lg p-3">
            <h3 className="text-sm font-semibold text-content-200 mb-2">
                Impatto sul Budget del Ruolo
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-base-300 text-brand-primary font-bold text-xs align-middle">
                    {player.role} {/* Optionally add icon: {ROLE_ICONS[player.role]} */}
                </span>
            </h3>
            <div className="w-full bg-base-300 rounded-full h-5 relative overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-500' : 'bg-brand-primary'}`}
                    style={{ width: `${progress}%`, transform: isOver ? 'scale(1.02)' : 'scale(1)', boxShadow: isOver ? '0 0 8px 1px rgba(239, 68, 68, 0.7)' : 'none' }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">
                    {prospective} / {allocated} Cr
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: WHAT-IF ANALYSIS ---
const WhatIfAnalysis: React.FC<{ myTeam: MyTeamPlayer[], leagueSettings: LeagueSettings, currentPrice: number }> = ({ myTeam, leagueSettings, currentPrice }) => {
    const { budgetAfterWin, slotsAfterWin, avgCreditPerSlotAfterWin, flash } = useMemo(() => {
        const currentSpent = myTeam.reduce((sum, p) => sum + p.purchasePrice, 0);
        const totalSlots = Object.values(leagueSettings.roster).reduce((sum, count) => sum + count, 0);
        const budgetAfterWin = leagueSettings.budget - currentSpent - currentPrice;
        const slotsAfterWin = totalSlots - myTeam.length - 1;
        const avgCreditPerSlotAfterWin = slotsAfterWin > 0 ? Math.round(budgetAfterWin / slotsAfterWin) : 0;
        const flash = avgCreditPerSlotAfterWin < 8 && avgCreditPerSlotAfterWin >= 0;
        return { budgetAfterWin, slotsAfterWin, avgCreditPerSlotAfterWin, flash };
    }, [myTeam, leagueSettings, currentPrice]);

    const [shouldFlash, setShouldFlash] = useState(false);
    useEffect(() => {
        if(flash) {
            setShouldFlash(true);
            const timer = setTimeout(() => setShouldFlash(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [flash, currentPrice]);
    
    return(
        <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center bg-base-100 p-2 rounded"><span>Budget Rimanente Post-Acquisto</span> <strong className={`font-bold ${budgetAfterWin < 0 ? 'text-red-400' : 'text-green-400'}`}>{budgetAfterWin} Cr</strong></div>
            <div className="flex justify-between items-center bg-base-100 p-2 rounded"><span>Slot Rimanenti Post-Acquisto</span> <strong className="font-bold">{slotsAfterWin}</strong></div>
            <div className={`flex justify-between items-center p-2 rounded transition-all duration-200 ${shouldFlash ? 'bg-red-500/30 animate-pulse' : 'bg-base-100'}`}><span>Media Crediti/Slot Futura</span> <strong className={`font-bold ${avgCreditPerSlotAfterWin < 0 ? 'text-red-400' : ''}`}>{avgCreditPerSlotAfterWin} Cr</strong></div>
        </div>
    );
};

// --- SUB-COMPONENT: RIVALS HEATMAP ---
const RivalsHeatmap: React.FC<{ auctionLog: Record<number, AuctionResult>, leagueSettings: LeagueSettings, currentBid: number }> = ({ auctionLog, leagueSettings, currentBid }) => {
    const rivalsData = useMemo(() => {
        const rivals = leagueSettings.participantNames.filter(name => name.toLowerCase() !== 'io');
        return rivals.map(name => {
            const spent = Object.values(auctionLog).filter(r => r.buyer === name).reduce((sum, r) => sum + r.purchasePrice, 0);
            const remaining = leagueSettings.budget - spent;
            const heat = Math.min(1, remaining / leagueSettings.budget);
            const canOutbid = remaining >= currentBid;
            return { name, remaining, heat, canOutbid };
        }).sort((a,b) => b.remaining - a.remaining);
    }, [auctionLog, leagueSettings, currentBid]);

    // Debug log
    useEffect(() => {
        console.log('Heatmap Rivali:', {
            participantNames: leagueSettings.participantNames,
            auctionLog,
            rivalsData
        });
    }, [leagueSettings.participantNames, auctionLog, rivalsData]);

    if (!leagueSettings.participantNames || leagueSettings.participantNames.length <= 1) {
        return <div className="text-content-200 text-sm">Nessun rivale trovato. Aggiungi altri partecipanti nelle impostazioni della lega.</div>;
    }
    if (rivalsData.length === 0) {
        return <div className="text-content-200 text-sm">Nessun rivale da mostrare.</div>;
    }

    return(
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rivalsData.map(rival => (
                <div key={rival.name} className={`p-2 rounded text-center border ${rival.canOutbid ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-transparent'}`} style={{ backgroundColor: `rgba(22, 163, 74, ${rival.heat * 0.5})` }}>
                    <p className="text-xs font-bold truncate text-content-100">{rival.name}</p>
                    <p className="text-sm font-mono text-content-200">{rival.remaining}</p>
                </div>
            ))}
        </div>
    );
}

// --- SUB-COMPONENT: ROLE INFLATION CHART ---
const RoleInflationChart: React.FC<Omit<InsightColumnProps, 'myTeam' | 'currentBid' | 'roleBudget'>> = ({ player, auctionLog, players, leagueSettings }) => {
    const averageInflation = useMemo(() => {
        const playerMap = new Map(players.map(p => [p.id, p]));
        const scaleFactor = leagueSettings.budget / 500;
        
        const auctionedRolePlayers = Object.entries(auctionLog)
            .map(([playerId, result]) => {
                const p = playerMap.get(Number(playerId));
                return p ? { ...p, ...result } : null;
            })
            .filter((p): p is Player & AuctionResult => p !== null && p.role === player.role);

        if (auctionedRolePlayers.length === 0) {
            return null;
        }

        const totalInflationPercent = auctionedRolePlayers.reduce((sum, p) => {
            if (!p.baseCost) return sum;
            const scaledBaseCost = p.baseCost * scaleFactor;
            if (scaledBaseCost === 0) return sum; // Avoid division by zero
            const inflation = ((p.purchasePrice - scaledBaseCost) / scaledBaseCost) * 100;
            return sum + inflation;
        }, 0);

        return totalInflationPercent / auctionedRolePlayers.length;

    }, [auctionLog, player.role, players, leagueSettings.budget]);

    if (averageInflation === null) {
        return <p className="text-xs text-center text-content-200 p-4">Dati insufficienti per calcolare l'inflazione per questo ruolo.</p>;
    }

    const { colorClass, bgColorClass, label } = useMemo(() => {
        if (averageInflation > 15) return { colorClass: 'text-red-400', bgColorClass: 'bg-red-500/80', label: 'Molto Alta' };
        if (averageInflation > 10) return { colorClass: 'text-yellow-400', bgColorClass: 'bg-yellow-500/80', label: 'Alta' };
        if (averageInflation > -5) return { colorClass: 'text-brand-primary', bgColorClass: 'bg-brand-primary', label: 'Nella Media' };
        return { colorClass: 'text-green-400', bgColorClass: 'bg-green-500', label: 'Conveniente' };
    }, [averageInflation]);

    const displayValue = `${averageInflation > 0 ? '+' : ''}${averageInflation.toFixed(1)}%`;
    const barWidth = Math.min(100, (Math.abs(averageInflation) / 30) * 100); // Visual clamp at 30% inflation/deflation

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-baseline">
                <span className={`font-bold text-xl ${colorClass}`}>{displayValue}</span>
                <span className="text-xs font-semibold">{label}</span>
            </div>
            <div className="w-full bg-base-100 h-2.5 rounded-full">
                <div 
                    className={`h-full rounded-full transition-all duration-300 ${bgColorClass}`}
                    style={{ width: `${barWidth}%` }}
                ></div>
            </div>
            <p className="text-xs text-content-200 text-center pt-1">Sovrapprezzo medio pagato per i {player.role === 'P' ? 'portieri' : player.role === 'D' ? 'difensori' : player.role === 'C' ? 'centrocampisti' : 'attaccanti'}.</p>
        </div>
    );
};

// --- SUB-COMPONENT: RISK FACTORS (IMPROVED) ---
const RiskItem: React.FC<{ icon: React.ReactNode; label: string; description: string; colorClass: string; }> = ({ icon, label, description, colorClass }) => (
    <div className={`flex items-start gap-3 p-3 rounded-lg border-l-4 bg-opacity-10 ${colorClass}`}>
        <span className="mt-1">{icon}</span>
        <div>
            <h4 className="font-semibold text-content-100">{label}</h4>
            <p className="text-sm text-content-200">{description}</p>
        </div>
    </div>
);

const RiskFactors: React.FC<{ player: Player }> = ({ player }) => {
    const risks = useMemo(() => {
        if (!player.stats) return [];
        const { stats, analystCeiling, analystFloor } = player;
        const result: { key: string; icon: React.ReactNode; label: string; description: string; colorClass: string; }[] = [];

        // Injury Risk
        if (stats.injuries === 'Alto rischio') {
            result.push({ key: 'injury', icon: <HeartPulse size={20} />, label: 'Rischio Infortuni', description: 'Alto', colorClass: 'border-red-500 bg-red-500' });
        } else if (stats.injuries === 'Medio rischio') {
            result.push({ key: 'injury', icon: <HeartPulse size={20} />, label: 'Rischio Infortuni', description: 'Medio', colorClass: 'border-yellow-500 bg-yellow-500' });
        }

        // Card Risk
        const cardScore = (stats.yellowCards || 0) + ((stats.redCards || 0) * 2.5);
        if (cardScore > 8) {
             result.push({ key: 'cards', icon: <RectangleHorizontal size={20} />, label: 'Malus Cartellini', description: `Tendenza alta (${stats.yellowCards}G, ${stats.redCards}R)`, colorClass: 'border-red-500 bg-red-500' });
        } else if (cardScore > 4) {
             result.push({ key: 'cards', icon: <RectangleHorizontal size={20} />, label: 'Malus Cartellini', description: `Tendenza moderata (${stats.yellowCards}G, ${stats.redCards}R)`, colorClass: 'border-yellow-500 bg-yellow-500' });
        }

        // Turnover/Cup Risk
        const safeCeiling = typeof analystCeiling === 'string' ? analystCeiling : '';
        const safeFloor = typeof analystFloor === 'string' ? analystFloor : '';
        const analysisText = (safeCeiling + safeFloor).toLowerCase();
        const turnoverKeywords = ['coppa', 'turnover', 'ballottaggio', 'panchina', 'europa', 'nazionale'];
        if (turnoverKeywords.some(kw => analysisText.includes(kw))) {
             result.push({ key: 'turnover', icon: <UsersRound size={20} />, label: 'Turnover', description: 'Soggetto a rotazioni/coppe', colorClass: 'border-yellow-500 bg-yellow-500' });
        }
        
        return result.filter(r => r.description !== 'Basso');

    }, [player]);

    if (risks.length === 0) {
        return <p className="text-sm text-center text-content-200 p-2">Nessun fattore di rischio significativo rilevato.</p>;
    }

    return (
        <div className="space-y-2">
            {risks.map(risk => <RiskItem key={risk.key} {...risk} />)}
        </div>
    );
};

// --- SUB-COMPONENT: ALTERNATIVES CAROUSEL ---
const AlternativesCarousel: React.FC<Omit<InsightColumnProps, 'myTeam' | 'currentBid' | 'roleBudget'>> = ({ player, players, auctionLog, leagueSettings }) => {
    // Add role icon mapping
    const ROLE_ICONS: { [key in Role]: string } = {
      P: '🧤',
      D: '🛡️',
      C: '⚽',
      A: '🎯',
    };

    // Only show alternatives that are NOT taken (not present in auctionLog)
    const alternatives = useMemo(() => {
        // Defensive: filter out all players present in auctionLog, regardless of key type
        const auctionedIds = new Set([
            ...Object.keys(auctionLog).map(Number),
            ...Object.values(auctionLog).map(r => r.playerId)
        ]);
        return players.filter(p => 
            p.id !== player.id &&
            p.role === player.role &&
            !auctionedIds.has(p.id)
        )
        .sort((a,b) => b.recommendation - a.recommendation || (b.baseCost ?? 0) - (a.baseCost ?? 0))
        .slice(0, 5);
    }, [player, players, auctionLog]);

    if (alternatives.length === 0) {
        return <p className="text-xs text-center text-content-200 p-4">Nessuna alternativa simile disponibile per questo ruolo.</p>;
    }

    return (
        <div className="flex overflow-x-auto space-x-3 p-1 pb-2 -mx-3">
            {alternatives.map(alt => {
                 const scaleFactor = leagueSettings.budget / 500;
                 const baseCost = typeof alt.baseCost === 'number' && !isNaN(alt.baseCost) ? alt.baseCost : 1;
                 const minSpend = Math.round((baseCost * scaleFactor) * 0.9);
                 const maxSpend = Math.round((baseCost * scaleFactor) * 1.15);
                 let badge = null;
                 if (alt.stats && typeof alt.stats.injury_score === 'number') {
                    if (alt.recommendation > 3) {
                        badge = { text: 'Upside Alto', color: 'bg-green-500/20 text-green-400' };
                    } else if (alt.stats.injury_score >= 3) {
                        badge = { text: 'Rischio Alto', color: 'bg-red-500/20 text-red-400' };
                    }
                 } else if (alt.recommendation > 3) {
                    badge = { text: 'Upside Alto', color: 'bg-green-500/20 text-green-400' };
                 }
                 // Defensive: FantaMedia
                 let fantamedia = '-';
                 if (alt.stats && typeof alt.stats.fm1y === 'number' && isFinite(alt.stats.fm1y)) {
                    fantamedia = alt.stats.fm1y.toFixed(2);
                 }
                return (
                    <div key={alt.id} className="flex-shrink-0 w-40 bg-base-100 rounded-lg p-2.5 text-center border border-base-300/50">
                        <div className="flex items-center justify-center mb-1">
                            <span className="text-xl mr-1">{ROLE_ICONS[alt.role]}</span>
                            <p className="font-bold text-sm truncate text-content-100">{alt.name}</p>
                        </div>
                        <p className="text-xs truncate text-content-200">{alt.team}</p>
                        <p className="my-1 font-bold text-brand-primary">{minSpend}-{maxSpend} Cr</p>
                        <p className="text-xs text-content-200">FantaMedia: {fantamedia}</p>
                        {badge && <span className={`mt-2 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${badge.color}`}>{badge.text}</span>}
                    </div>
                )
            })}
        </div>
    );
};

// --- MAIN INSIGHT COLUMN ---
export const InsightColumn: React.FC<InsightColumnProps> = ({ player, currentBid, myTeam, leagueSettings, roleBudget, auctionLog, players }) => {
    const opportunityScore = useMemo(() => calculateOpportunityScore(currentBid, player, myTeam, leagueSettings), [currentBid, player, myTeam, leagueSettings]);

    return (
        <div className="space-y-4 animate-fade-in">
            <ROIGauge score={opportunityScore} currentBid={currentBid} />
            <RoleBudgetImpactBar player={player} currentBid={currentBid} myTeam={myTeam} leagueSettings={leagueSettings} roleBudget={roleBudget} />
            {/* <CollapsibleSection title="Analisi 'What if...?'" icon={<TrendingUp size={20} />} defaultOpen>
                <WhatIfAnalysis myTeam={myTeam} leagueSettings={leagueSettings} currentPrice={currentBid} />
            </CollapsibleSection> */}
            <CollapsibleSection title="Alternative" icon={<FileText size={20} />} defaultOpen>
                <AlternativesCarousel 
                    player={player} 
                    players={players} 
                    auctionLog={auctionLog} 
                    leagueSettings={leagueSettings} 
                />
            </CollapsibleSection>
             <CollapsibleSection title="Heatmap Rivali" icon={<Users size={20} />} defaultOpen>
                <RivalsHeatmap auctionLog={auctionLog} leagueSettings={leagueSettings} currentBid={currentBid} />
            </CollapsibleSection>
            <CollapsibleSection title="Fattori di Rischio" icon={<Shield size={20} />} defaultOpen>
                <RiskFactors player={player} />
            </CollapsibleSection>
            {/* <CollapsibleSection title="Inflazione Ruolo" icon={<BarChart size={20} />}>
                 <RoleInflationChart 
                    player={player} 
                    auctionLog={auctionLog}
                    players={players}
                    leagueSettings={leagueSettings}
                 />
            </CollapsibleSection> */}
             
            
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateX(10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                /* Custom scrollbar for alternatives */
                .overflow-x-auto::-webkit-scrollbar {
                    height: 6px;
                }
                .overflow-x-auto::-webkit-scrollbar-track {
                    background: transparent;
                }
                .overflow-x-auto::-webkit-scrollbar-thumb {
                    background-color: #4b5563;
                    border-radius: 20px;
                    border: 3px solid transparent;
                }
            `}</style>
        </div>
    );
};