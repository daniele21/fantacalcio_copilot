import React, { useState, useMemo, useEffect, useContext } from 'react';
import { Player, MyTeamPlayer, LeagueSettings, Role, BiddingAdviceResult } from '../types';
import { getBiddingAdvice } from '../services/geminiService';
import { Search, Sparkles, X, Loader, AlertTriangle, Gavel, Coins, MessageSquare, Star, PiggyBank, Users, Tag, Lightbulb, MessageSquareDot, CheckCircle } from 'lucide-react';
// Snackbar for confirmation
const Snackbar: React.FC<{ open: boolean; message: string; onClose: () => void }> = ({ open, message, onClose }) => (
    <div
        className={`fixed z-50 left-1/2 -translate-x-1/2 bottom-8 transition-all duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2`}
        role="status"
        aria-live="polite"
    >
        <CheckCircle className="w-5 h-5" />
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-white/80 hover:text-white" aria-label="Chiudi notifica">&times;</button>
    </div>
);
import { NumberStepper } from './NumberStepper';
import ShowNoCreditDialog from './showNoCreditDialog';
import { useApi } from '../services/useApi';
import { base_url } from '../services/api';
import { AuthContext } from '../services/AuthContext';

interface BiddingAssistantProps {
    availablePlayers: Player[];
    myTeam: MyTeamPlayer[];
    leagueSettings: LeagueSettings;
    onPlayerAuctioned: (player: Player, price: number, buyer: string) => void;
    roleBudget: Record<Role, number>;
    participantNames: string[];
    playerForBidding: Player | null;
    onSelectPlayer: (player: Player) => void;
    onClearPlayer: () => void;
    currentBid: number | '';
    onCurrentBidChange: (value: number | '') => void;
    plan: string; // Add plan prop
    refreshProfile?: () => void; // Optional prop for refreshing profile
    auctionLog: Record<number, any>; // Add auctionLog prop
}

export const BiddingAssistant: React.FC<BiddingAssistantProps> = ({ 
    availablePlayers, 
    myTeam, 
    leagueSettings, 
    onPlayerAuctioned, 
    roleBudget, 
    participantNames,
    playerForBidding,
    onSelectPlayer,
    onClearPlayer,
    currentBid,
    onCurrentBidChange,
    plan, // Destructure plan prop
    refreshProfile,
    auctionLog, // Destructure auctionLog
}) => {
    const [query, setQuery] = useState('');
    const [finalPrice, setFinalPrice] = useState<number | ''>(1);
    const [finalPriceTouched, setFinalPriceTouched] = useState(false);
    const [buyer, setBuyer] = useState<string>('');
    
    const [advice, setAdvice] = useState<BiddingAdviceResult | null>(null);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
    const [error, setError] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const { call } = useApi();
    const [showNoCreditDialog, setShowNoCreditDialog] = useState(false);
    const [showSnackbar, setShowSnackbar] = useState(false);

    // Optionally get refreshProfile from context if not passed as prop
    const authContext = useContext(AuthContext);
    const profile = authContext?.profile;
    const setProfile = authContext?.setProfile;

    // Only clear advice and error if playerForBidding actually changes (not on every effect run)
    const prevPlayerRef = React.useRef<Player | null>(null);
    useEffect(() => {
        if (playerForBidding && prevPlayerRef.current?.id !== playerForBidding.id) {
            setFinalPrice(1);
            setFinalPriceTouched(false);
            // Only reset bid if player changed
            onCurrentBidChange(1);
            setAdvice(null);
            setError('');
            const myName = participantNames.find(n => n.toLowerCase() === 'io') || participantNames[0] || '';
            setBuyer(myName);
        } else if (!playerForBidding) {
            setBuyer('');
        }
        prevPlayerRef.current = playerForBidding;
    }, [playerForBidding, onCurrentBidChange, participantNames]);

    // When currentBid changes, update finalPrice if not touched by user
    useEffect(() => {
        if (!finalPriceTouched) {
            setFinalPrice(currentBid);
        }
    }, [currentBid]);

    // Fallback: if buyer is empty but participantNames exist, show first participant
    useEffect(() => {
        if (!buyer && participantNames.length > 0) {
            setBuyer(participantNames.find(n => n.toLowerCase() === 'io') || participantNames[0]);
        }
    }, [buyer, participantNames]);

    // For debugging: log buyer and participantNames
    useEffect(() => {
        console.log('buyer:', buyer, 'participantNames:', participantNames);
    }, [buyer, participantNames]);

    const suggestions = useMemo(() => {
        if (!query) return [];
        // Exclude players already in myTeam or in auctionLog
        const takenIds = new Set([
            ...myTeam.map(p => p.id),
            ...Object.keys(auctionLog || {}).map(Number),
        ]);
        return availablePlayers.filter(p =>
            p.player_name.toLowerCase().includes(query.toLowerCase()) &&
            !takenIds.has(p.id)
        ).slice(0, 5);
    }, [query, availablePlayers, myTeam, auctionLog]);

    const handleSelectPlayerFromSearch = (player: Player) => {
        onSelectPlayer(player);
        setQuery('');
        setShowSuggestions(false);
        // Buyer will be set by useEffect above
    };

    const handleGetAdvice = async () => {
        if (!playerForBidding) return;
        setIsLoadingAdvice(true);
        setAdvice(null);
        setError('');
        try {
            const { result, cost, ai_credits } = await getBiddingAdvice(
                playerForBidding,
                myTeam,
                leagueSettings,
                Number(currentBid) || 1,
                roleBudget,
                availablePlayers,
                auctionLog
            );
            setAdvice(result);
            // update credits in context if present
            if (profile && setProfile && typeof ai_credits === 'number') {
                setProfile({ ...profile, ai_credits });
            }
        } catch (e: any) {
            if (e.status === 403) setShowNoCreditDialog(true);
            else setError(e.message || 'Errore nel ricevere il consiglio.');
        } finally {
            setIsLoadingAdvice(false);
        }
    };

    const handleAcquirePlayer = () => {
        if (!playerForBidding || typeof finalPrice !== 'number' || finalPrice <= 0 || !buyer) return;
        onPlayerAuctioned({
            ...playerForBidding,
            player_name: playerForBidding.player_name,
            position: playerForBidding.position
        }, finalPrice, buyer);
        setShowSnackbar(true);
        setTimeout(() => setShowSnackbar(false), 2500);
    };

    const AdviceItem: React.FC<{icon: React.ReactNode, title: string, content: string}> = ({ icon, title, content}) => (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-full flex-shrink-0 mt-1">{icon}</div>
            <div>
                <h5 className="font-semibold text-content-100">{title}</h5>
                <p className="text-content-200 text-sm">{content}</p>
            </div>
        </div>
    );
    
    return (
        <div className="relative p-0.5 bg-gradient-to-br from-brand-primary/80 to-emerald-700/60 rounded-2xl shadow-2xl shadow-brand-primary/20">
            <ShowNoCreditDialog open={showNoCreditDialog} onClose={() => setShowNoCreditDialog(false)} plan={plan} />
            <Snackbar open={showSnackbar} message="Acquisto registrato!" onClose={() => setShowSnackbar(false)} />
            <div className="bg-base-200 p-3 sm:p-4 md:p-6 rounded-[14px] flex flex-col gap-6 sm:gap-8">
                <div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2">
                        <Sparkles className="w-8 h-8 text-brand-primary" />
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-green-500">
                            Assistente Offerte Asta
                        </h2>
                    </div>
                    <p className="text-content-200 mb-4 sm:mb-6 ml-0 sm:ml-11 text-base sm:text-lg">
                        Il tuo copilota intelligente per le decisioni in tempo reale.
                    </p>
                </div>

                <div className="space-y-6 sm:space-y-8">
                {!playerForBidding ? (
                    <div className="relative animate-fade-in-up">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-content-200 pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="Cerca il giocatore all'asta..."
                            className="w-full bg-base-100 border-2 border-base-300 rounded-lg pl-12 pr-4 py-3 sm:py-4 text-base sm:text-lg text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition outline-none focus:outline-none shadow-sm focus:shadow-lg"
                            aria-label="Cerca il giocatore all'asta"
                        />
                        {showSuggestions && (
                            <ul className="absolute z-10 w-full mt-1 bg-base-300 border border-base-300/50 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-fade-in-up">
                                {suggestions.length > 0 ? suggestions.map(player => (
                                    <li key={player.id} onClick={() => handleSelectPlayerFromSearch(player)} className="px-4 py-3 cursor-pointer hover:bg-brand-primary/20 flex justify-between items-center transition-colors text-base sm:text-lg" tabIndex={0} aria-label={`Seleziona ${player.player_name}`}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSelectPlayerFromSearch(player); }}
                                    >
                                        <span>{player.player_name} <span className="text-sm text-content-200">({player.current_team})</span></span>
                                        <span className="text-xs font-bold bg-base-100 px-2 py-1 rounded-md">{player.position}</span>
                                    </li>
                                )) : (
                                    <li className="px-4 py-3 text-content-200">Nessun giocatore trovato.</li>
                                )}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="animate-fade-in-up space-y-6 sm:space-y-8">
                        <div className="p-3 sm:p-4 bg-base-100 rounded-lg flex flex-col md:flex-row border border-base-300 gap-3 sm:gap-4">
                            <div className="flex flex-row items-start sm:items-center w-full">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
                                        <h3 className="text-xl sm:text-2xl font-bold text-content-100 mb-0 truncate">{playerForBidding.player_name}</h3>
                                        {playerForBidding.skills && playerForBidding.skills.length > 0 && (
                                            <div className="flex flex-wrap gap-2 ml-0 sm:ml-2 mt-1 sm:mt-0">
                                                {playerForBidding.skills.map((skill, idx) => (
                                                    <span key={idx} className="px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary font-semibold text-xs sm:text-sm border border-brand-primary/30">{skill}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-content-200 truncate text-sm sm:text-base">{playerForBidding.current_team}</p>
                                    {typeof playerForBidding.recommendation === 'number' && (
                                        <div className="mt-2 inline-block bg-brand-primary/10 border border-brand-primary/30 rounded-lg px-3 py-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-brand-primary text-xs">FantaPilot Score</span>
                                                <span className="flex items-center">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <span key={i} className={i < Math.round(playerForBidding.stars ?? 0) ? 'text-yellow-400' : 'text-base-300'}>★</span>
                                                    ))}
                                                </span>
                                                <span className="ml-1 text-xs font-bold text-brand-primary">{(playerForBidding.stars ?? 0).toFixed(1)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={onClearPlayer} className="ml-auto p-2 text-content-200 hover:text-red-400 rounded-full hover:bg-red-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400" aria-label="Cambia giocatore">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                            <div className="flex-1">
                                <label htmlFor="current_bid" className="text-sm font-medium text-content-200 mb-1 block">Offerta Attuale</label>
                                <div className="flex justify-center items-center gap-2 bg-base-100 border-2 border-base-300 rounded-lg px-2 py-2 w-full max-w-xs mx-auto">
                                    <NumberStepper
                                        value={currentBid}
                                        onChange={onCurrentBidChange}
                                        min={1}
                                        max={999}
                                        step={1}
                                        inputClassName="text-2xl font-bold bg-transparent border-none focus:ring-0 focus:border-none"
                                        ariaLabelDecrement="Diminuisci offerta"
                                        ariaLabelIncrement="Aumenta offerta"
                                        disabled={false}
                                    />
                                    <span className="text-content-200 text-base font-semibold ml-1">💰</span>
                                </div>
                            </div>
                            <button
                                onClick={handleGetAdvice}
                                disabled={isLoadingAdvice}
                                className="w-full sm:w-auto h-[54px] sm:h-[62px] flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-brand-primary mt-4 sm:mt-0"
                                aria-label="Chiedi consiglio AI"
                            >
                                {isLoadingAdvice ? (
                                    <><Loader className="w-6 h-6 mr-3 animate-spin" />Analisi...</>
                                ) : (
                                    <>
                                        <Sparkles className="w-6 h-6 mr-3" />Chiedi Consiglio
                                        <span className="ml-3 px-2 py-0.5 rounded bg-white/20 border border-white/30 text-xs font-semibold text-white">1 Credito AI</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {error && <p className="text-red-400 text-sm flex items-center gap-2 mt-2"><AlertTriangle className="w-4 h-4"/>{error}</p>}

                        {isLoadingAdvice && (
                            <div className="mt-4 p-4 bg-base-100/50 rounded-lg space-y-4 animate-pulse">
                                <div className="h-5 bg-base-300 rounded w-1/3 mb-4"></div>
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-base-300"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-base-300 rounded w-1/4"></div>
                                        <div className="h-4 bg-base-300 rounded w-full"></div>
                                    </div>
                                </div>
                                <div className="h-14 bg-base-300 rounded w-full mt-4"></div>
                            </div>
                        )}

                        {advice && (
                            <div className="mt-4 p-4 bg-base-100 rounded-lg border border-base-300 space-y-4 animate-fade-in-up">
                                <h4 className="font-bold text-lg text-content-100">Analisi del Copilota</h4>
                                <div className="!mb-6 p-4 bg-brand-primary/10 rounded-lg border-2 border-brand-primary/30 animate-fade-in-up">
                                    <h5 className="font-bold text-lg text-brand-primary flex items-center gap-2 mb-2"><Lightbulb className="w-6 h-6"/>Verdetto Finale</h5>
                                    <p className="text-content-100 font-medium text-base">{advice.finalAdvice}</p>
                                </div>
                                <AdviceItem icon={<MessageSquareDot className="w-5 h-5 text-red-400"/>} title="Opportunità" content={advice.opportunityAdvice} />
                                <AdviceItem icon={<MessageSquare className="w-5 h-5 text-green-400"/>} title="Avversari" content={advice.participantAdvice} />
                            </div>
                        )}

                        <div className="p-3 sm:p-4 bg-base-100 rounded-lg border border-base-300 mt-6 sm:mt-8">
                            <h4 className="font-semibold text-content-100 mb-3 flex items-center"><Gavel className="w-5 h-5 mr-2"/>Registra Esito Asta</h4>
                            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 items-stretch">
                                <div>
                                    <label htmlFor="final_price" className="text-sm font-medium text-content-200 mb-1 block">Prezzo Finale</label>
                                    <div className="flex justify-center items-center gap-2 bg-base-100 border-2 border-base-300 rounded-lg px-2 py-2 w-full max-w-xs mx-auto">
                                        <NumberStepper
                                            value={finalPrice}
                                            onChange={val => {
                                                setFinalPrice(val);
                                                setFinalPriceTouched(true);
                                            }}
                                            min={1}
                                            max={999}
                                            step={1}
                                            inputClassName="text-2xl font-bold bg-transparent border-none focus:ring-0 focus:border-none"
                                            ariaLabelDecrement="Diminuisci prezzo finale"
                                            ariaLabelIncrement="Aumenta prezzo finale"
                                            disabled={false}
                                        />
                                        <span className="text-content-200 text-base font-semibold ml-1">💶</span>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="buyer" className="text-sm font-medium text-content-200 mb-1 block">Acquirente</label>
                                    <div className="relative">
                                        <select
                                            id="buyer"
                                            value={buyer || (participantNames[0] || '')}
                                            onChange={e => setBuyer(e.target.value)}
                                            className="w-full h-full bg-base-200 border-2 border-base-300 rounded-lg px-3 py-2 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary appearance-none pr-10 outline-none focus:outline-none"
                                            style={{ minHeight: '48px' }}
                                            aria-label="Seleziona acquirente"
                                        >
                                            <option value="" disabled>Seleziona acquirente...</option>
                                            {participantNames.map(name => (
                                                <option key={name} value={name}>{name.toLowerCase() === 'io' ? '👤 Io (Tu)' : name}</option>
                                            ))}
                                        </select>
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-content-200">
                                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleAcquirePlayer}
                                disabled={!playerForBidding || finalPrice === '' || finalPrice <= 0 || !buyer}
                                className="w-full mt-4 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                                aria-label="Registra acquisto"
                                title={!playerForBidding || finalPrice === '' || finalPrice <= 0 || !buyer ? 'Compila tutti i campi per registrare l’acquisto' : ''}
                            >
                                <Gavel className="w-6 h-6 mr-2" />
                                Registra Acquisto
                            </button>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
};