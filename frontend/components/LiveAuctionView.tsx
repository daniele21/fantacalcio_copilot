import React, { useState, useRef, useEffect } from 'react';
import { Player, MyTeamPlayer, LeagueSettings, Role, AuctionResult, TargetPlayer } from '../types';
import { BiddingAssistant } from './BiddingAssistant';
import { TeamStatus } from './TeamStatus';
import { AuctionBoard } from './AuctionBoard';
import { ChevronDown, ChevronUp, Users, Wallet, Info } from 'lucide-react';
import { TeamsView } from './TeamsView';
import { InstantHeader } from './InstantHeader';
import { InsightColumn } from './InsightColumn';
import { useAuth } from '../services/AuthContext';
import { getStrategyBoard } from '../services/strategyBoardService';
import { fetchLeagueSettings } from '../services/leagueSettingsService';

interface LiveAuctionViewProps {
    players: Player[];
    myTeam: MyTeamPlayer[];
    auctionLog: Record<number, AuctionResult>;
    onPlayerAuctioned: (player: Player, purchasePrice: number, buyer: string) => void;
    leagueSettings: LeagueSettings;
    roleBudget: Record<Role, number>;
    targetPlayers: TargetPlayer[];
    onUpdateAuctionResult: (playerId: number, newPrice: number) => void;
}

export const LiveAuctionView: React.FC<LiveAuctionViewProps> = ({ players, myTeam, auctionLog, onPlayerAuctioned, leagueSettings: initialLeagueSettings, roleBudget, targetPlayers, onUpdateAuctionResult }) => {
    const [isAuctionBoardExpanded, setIsAuctionBoardExpanded] = useState(true);
    const [isTeamsViewExpanded, setIsTeamsViewExpanded] = useState(false);
    const [playerForBidding, setPlayerForBidding] = useState<Player | null>(null);
    const [currentBid, setCurrentBid] = useState<number | ''>(1);
    const biddingAssistantRef = useRef<HTMLDivElement>(null);
    const { idToken, isLoggedIn } = useAuth();
    const [localTargetPlayers, setLocalTargetPlayers] = useState<TargetPlayer[]>(targetPlayers);
    const [leagueSettings, setLeagueSettings] = useState(initialLeagueSettings);

    const availablePlayers = React.useMemo(() => {
        const auctionedPlayerIds = new Set(Object.keys(auctionLog).map(Number));
        return players.filter(p => !auctionedPlayerIds.has(p.id));
    }, [players, auctionLog]);
    
    const handlePlayerSelectForBidding = (player: Player) => {
        setPlayerForBidding(player);
        setCurrentBid(1);
        // A small delay to allow the header to render before scrolling
        setTimeout(() => {
             biddingAssistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleClearBiddingPlayer = () => {
        setPlayerForBidding(null);
        setCurrentBid(1);
    };

    const handlePlayerAuctionedAndClear = (player: Player, purchasePrice: number, buyer: string) => {
        onPlayerAuctioned(player, purchasePrice, buyer);
        handleClearBiddingPlayer();
    };
    
    const isInstantHeaderVisible = playerForBidding && (Number(currentBid) || 0) > 0;

    // Always reload league settings on mount
    useEffect(() => {
        (async () => {
            try {
                const latest = await fetchLeagueSettings(idToken || undefined);
                if (latest) setLeagueSettings(latest);
            } catch (e) {
                // Optionally show error/toast
                console.error('Errore nel caricamento delle impostazioni lega:', e);
            }
        })();
    }, [idToken]);

    // Ensure 'io' is always present in participantNames
    const myName = "io";
    let participantNames = Array.isArray(leagueSettings.participantNames) ? [...leagueSettings.participantNames] : [];
    if (!participantNames.map(n => n.toLowerCase()).includes(myName)) {
        participantNames = [myName, ...participantNames];
    }

    // Load favourites from API if missing
    useEffect(() => {
        if (!isLoggedIn || !idToken) return;
        if (localTargetPlayers.length === 0) {
            (async () => {
                try {
                    const board = await getStrategyBoard(idToken);
                    if (board && board.target_players) {
                        const validPlayers = board.target_players
                            .map((p: any) => {
                                const player = players.find(pl => pl.id === p.player_id);
                                if (player) {
                                    return { ...player, maxBid: p.max_bid };
                                }
                                return null;
                            })
                            .filter(Boolean);
                        setLocalTargetPlayers(validPlayers);
                    }
                } catch (e) {
                    // Ignore errors
                }
            })();
        }
    }, [isLoggedIn, idToken, localTargetPlayers.length, players]);

    return (
        <div>
            {isInstantHeaderVisible && (
                <InstantHeader 
                    player={playerForBidding!}
                    currentPrice={Number(currentBid)}
                    myTeam={myTeam}
                    leagueSettings={leagueSettings}
                />
            )}
             {/* This spacer pushes down the content by the height of the header, preventing overlap */}
            {isInstantHeaderVisible && <div className="h-16" />}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Left/Main Column */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                    <button
                        onClick={() => window.location.href = '/setup'}
                        className="mb-4 px-3 py-1.5 text-sm font-semibold text-content-200 bg-base-200 rounded-md hover:bg-base-300"
                    >
                        ← Torna alle Impostazioni
                    </button>
                    <div ref={biddingAssistantRef} className="scroll-mt-32">
                        <BiddingAssistant 
                            availablePlayers={availablePlayers}
                            myTeam={myTeam}
                            leagueSettings={leagueSettings}
                            onPlayerAuctioned={handlePlayerAuctionedAndClear}
                            roleBudget={roleBudget}
                            participantNames={participantNames.length > 0 ? participantNames : ["Partecipante 1"]}
                            playerForBidding={playerForBidding}
                            onSelectPlayer={handlePlayerSelectForBidding}
                            onClearPlayer={handleClearBiddingPlayer}
                            currentBid={currentBid}
                            onCurrentBidChange={setCurrentBid}
                        />
                    </div>
                    
                    {/* Collapsible Teams View Section */}
                    <div className="bg-base-200 rounded-lg shadow-lg">
                        <button
                            type="button"
                            onClick={() => setIsTeamsViewExpanded(!isTeamsViewExpanded)}
                            className="w-full flex justify-between items-center p-4 text-left rounded-t-lg hover:bg-base-300/50 transition-colors"
                            aria-expanded={isTeamsViewExpanded}
                            aria-controls="teams-view-content"
                        >
                             <h2 className="text-xl font-bold text-brand-primary flex items-center"><Users className="w-6 h-6 mr-3"/>Rose Avversari</h2>
                            {isTeamsViewExpanded ? <ChevronUp className="w-6 h-6 text-content-200" /> : <ChevronDown className="w-6 h-6 text-content-200" />}
                        </button>
                         {isTeamsViewExpanded && (
                            <div id="teams-view-content" className="p-4 pt-0">
                                <TeamsView auctionLog={auctionLog} players={players} leagueSettings={leagueSettings} onUpdateAuctionResult={onUpdateAuctionResult} />
                            </div>
                        )}
                    </div>

                    {/* Collapsible Auction Board Section */}
                    <div className="bg-base-200 rounded-lg shadow-lg">
                        <button
                            type="button"
                            onClick={() => setIsAuctionBoardExpanded(!isAuctionBoardExpanded)}
                            className="w-full flex justify-between items-center p-4 text-left rounded-t-lg hover:bg-base-300/50 transition-colors"
                            aria-expanded={isAuctionBoardExpanded}
                            aria-controls="auction-board-content"
                        >
                            <h2 className="text-xl font-bold text-brand-primary">Tabellone Asta</h2>
                            {isAuctionBoardExpanded ? <ChevronUp className="w-6 h-6 text-content-200" /> : <ChevronDown className="w-6 h-6 text-content-200" />}
                        </button>
                        {isAuctionBoardExpanded && (
                            <div id="auction-board-content" className="p-4 pt-0">
                                {players.length === 0 ? (
                                    <div className="text-center text-content-200 py-8">Nessun giocatore disponibile.</div>
                                ) : (
                                    <AuctionBoard 
                                        players={players} 
                                        auctionLog={auctionLog} 
                                        leagueSettings={leagueSettings}
                                        targetPlayers={localTargetPlayers}
                                        onPlayerSelect={handlePlayerSelectForBidding}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right/Sticky Column */}
                <div className="lg:col-span-5 xl:col-span-4">
                     <div className="sticky top-36 space-y-6">
                        {playerForBidding ? (
                            <InsightColumn
                                player={playerForBidding}
                                currentBid={Number(currentBid) || 0}
                                myTeam={myTeam}
                                leagueSettings={leagueSettings}
                                roleBudget={roleBudget}
                                auctionLog={auctionLog}
                                players={players}
                            />
                        ) : (
                            <div className="bg-base-200 p-6 rounded-lg shadow-lg text-center text-content-200 space-y-4 border-2 border-dashed border-base-300">
                                <Info className="w-12 h-12 mx-auto text-brand-primary" />
                                <h3 className="text-lg font-bold text-content-100">Pronto per l'asta?</h3>
                                <p className="mt-2 text-sm">Seleziona un giocatore dal tabellone o cercalo nell'assistente offerte per visualizzare qui le analisi e i consigli in tempo reale.</p>
                            </div>
                        )}
                         <TeamStatus 
                            myTeam={myTeam}
                            leagueSettings={leagueSettings}
                            roleBudget={roleBudget}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
