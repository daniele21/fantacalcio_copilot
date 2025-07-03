import React, { useState, useMemo, useEffect } from 'react';
import { Player, MyTeamPlayer, LeagueSettings, Role, BiddingAdviceResult } from '../types';
import { getBiddingAdvice } from '../services/geminiService';
import { Search, Sparkles, X, Loader, AlertTriangle, Gavel, Coins, MessageSquare, Star, PiggyBank, Users, Tag, Lightbulb } from 'lucide-react';

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
}) => {
    const [query, setQuery] = useState('');
    const [finalPrice, setFinalPrice] = useState<number>(1);
    const [buyer, setBuyer] = useState<string>('');
    
    const [advice, setAdvice] = useState<BiddingAdviceResult | null>(null);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
    const [error, setError] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (playerForBidding) {
            setFinalPrice(1);
            // Only reset bid if currentBid is empty or not a number
            if (currentBid === '' || typeof currentBid !== 'number' || currentBid < 1) {
                onCurrentBidChange(1);
            }
            setAdvice(null);
            setError('');
            const myName = participantNames.find(n => n.toLowerCase() === 'io') || participantNames[0] || '';
            setBuyer(myName);
        } else {
            setBuyer('');
        }
    }, [playerForBidding, onCurrentBidChange, participantNames]);

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
        return availablePlayers.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }, [query, availablePlayers]);

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
            const result = await getBiddingAdvice(playerForBidding, myTeam, leagueSettings, Number(currentBid) || 1, roleBudget);
            setAdvice(result);
        } catch (e: any) {
            setError(e.message || 'Errore nel ricevere il consiglio.');
        } finally {
            setIsLoadingAdvice(false);
        }
    };

    const handleAcquirePlayer = () => {
        if (!playerForBidding || finalPrice <= 0 || !buyer) return;
        onPlayerAuctioned(playerForBidding, finalPrice, buyer);
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
            <div className="bg-base-200 p-4 md:p-6 rounded-[14px]">
                 <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="w-8 h-8 text-brand-primary" />
                    <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-green-500">
                        Assistente Offerte Asta
                    </h2>
                </div>
                <p className="text-content-200 mb-6 ml-11">
                    Il tuo copilota intelligente per le decisioni in tempo reale.
                </p>

                {!playerForBidding ? (
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-content-200" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="Cerca il giocatore all'asta..."
                            className="w-full bg-base-100 border-2 border-base-300 rounded-lg pl-12 pr-4 py-4 text-lg text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"
                        />
                         {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-base-300 border border-base-300/50 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {suggestions.map(player => (
                                    <li key={player.id} onClick={() => handleSelectPlayerFromSearch(player)} className="px-4 py-3 cursor-pointer hover:bg-brand-primary/20 flex justify-between items-center transition-colors">
                                        <span>{player.name} <span className="text-sm text-content-200">({player.team})</span></span>
                                        <span className="text-xs font-bold bg-base-100 px-2 py-1 rounded-md">{player.role}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="animate-fade-in-up space-y-6">
                        <div className="p-4 bg-base-100 rounded-lg flex justify-between items-center border border-base-300">
                            <div>
                                <h3 className="text-2xl font-bold text-content-100">{playerForBidding.name}</h3>
                                <p className="text-content-200">{playerForBidding.team}</p>
                                {playerForBidding.skills && (
                                    <p className="text-content-200 text-sm mt-1">{playerForBidding.skills.join(', ')}</p>
                                )}
                                {typeof playerForBidding.recommendation === 'number' && (
                                    <div className="mt-2 inline-block bg-brand-primary/10 border border-brand-primary/30 rounded-lg px-3 py-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-brand-primary text-xs">Copilot Score</span>
                                            <span className="flex items-center">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <span key={i} className={i < Math.round(playerForBidding.recommendation) ? 'text-yellow-400' : 'text-base-300'}>★</span>
                                                ))}
                                            </span>
                                            <span className="ml-1 text-xs font-bold text-brand-primary">{playerForBidding.recommendation.toFixed(1)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={onClearPlayer} className="p-2 text-content-200 hover:text-red-400 rounded-full hover:bg-red-500/10 transition-colors" aria-label="Cambia giocatore">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label htmlFor="current_bid" className="text-sm font-medium text-content-200 mb-1 block">Offerta Attuale</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        aria-label="Diminuisci offerta"
                                        className="bg-base-300 hover:bg-base-400 text-lg rounded-l-lg px-3 py-2 border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        onClick={() => {
                                            if (typeof currentBid === 'number' && currentBid > 1) onCurrentBidChange(currentBid - 1);
                                        }}
                                        disabled={typeof currentBid !== 'number' || currentBid <= 1}
                                    >
                                        -
                                    </button>
                                    <input
                                        id="current_bid"
                                        type="number"
                                        value={currentBid}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                onCurrentBidChange('');
                                            } else {
                                                const num = parseInt(val, 10);
                                                if (!isNaN(num) && num >= 1) {
                                                    onCurrentBidChange(num);
                                                }
                                            }
                                        }}
                                        placeholder="1"
                                        min="1"
                                        className="w-24 text-center bg-base-100 border-2 border-base-300 text-2xl font-bold text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition px-2 py-2"
                                        style={{ appearance: 'textfield' }}
                                    />
                                    <button
                                        type="button"
                                        aria-label="Aumenta offerta"
                                        className="bg-base-300 hover:bg-base-400 text-lg rounded-r-lg px-3 py-2 border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        onClick={() => {
                                            if (typeof currentBid === 'number') onCurrentBidChange(currentBid + 1);
                                        }}
                                        disabled={typeof currentBid !== 'number'}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <button onClick={handleGetAdvice} disabled={isLoadingAdvice} className="w-full h-[62px] flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-lg">
                                {isLoadingAdvice ? <><Loader className="w-6 h-6 mr-3 animate-spin" />Analisi...</> : <><Sparkles className="w-6 h-6 mr-3" />Chiedi Consiglio</>}
                            </button>
                        </div>

                        {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</p>}
                        
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
                             <div className="mt-4 p-4 bg-base-100 rounded-lg border border-base-300 space-y-4">
                                <h4 className="font-bold text-lg text-content-100">Analisi del Copilota</h4>
                                <AdviceItem icon={<PiggyBank className="w-5 h-5 text-blue-400"/>} title="Budget Ruolo" content={advice.roleBudgetAdvice} />
                                <AdviceItem icon={<Users className="w-5 h-5 text-yellow-400"/>} title="Slot Rosa" content={advice.roleSlotAdvice} />
                                <AdviceItem icon={<Tag className="w-5 h-5 text-purple-400"/>} title="Prezzo Consigliato" content={advice.recommendedPriceAdvice} />
                                <AdviceItem icon={<MessageSquare className="w-5 h-5 text-green-400"/>} title="Opportunità" content={advice.opportunityAdvice} />
                               
                                <div className="!mt-6 p-4 bg-brand-primary/10 rounded-lg border-2 border-brand-primary/30">
                                    <h5 className="font-bold text-lg text-brand-primary flex items-center gap-2 mb-2"><Lightbulb className="w-6 h-6"/>Verdetto Finale</h5>
                                    <p className="text-content-100 font-medium text-base">{advice.finalAdvice}</p>
                                </div>
                            </div>
                        )}
                        
                        <div className="p-4 bg-base-100 rounded-lg border border-base-300">
                            <h4 className="font-semibold text-content-100 mb-3 flex items-center"><Gavel className="w-5 h-5 mr-2"/>Registra Esito Asta</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                <div>
                                    <label htmlFor="final_price" className="text-sm font-medium text-content-200 mb-1 block">Prezzo Finale</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            aria-label="Diminuisci prezzo finale"
                                            className="bg-base-300 hover:bg-base-400 text-lg rounded-l-lg px-3 py-2 border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                            onClick={() => setFinalPrice(prev => Math.max(1, prev - 1))}
                                            disabled={finalPrice <= 1}
                                        >
                                            -
                                        </button>
                                        <input id="final_price" type="number" value={finalPrice} onChange={e => {
                                            const val = e.target.value;
                                            const num = parseInt(val, 10);
                                            if (!isNaN(num) && num >= 1) setFinalPrice(num);
                                            else if (val === '') setFinalPrice(1);
                                        }} min="1" className="w-24 text-center bg-base-200 border-2 border-base-300 text-xl font-bold text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition px-2 py-2" style={{ appearance: 'textfield' }} />
                                        <button
                                            type="button"
                                            aria-label="Aumenta prezzo finale"
                                            className="bg-base-300 hover:bg-base-400 text-lg rounded-r-lg px-3 py-2 border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                            onClick={() => setFinalPrice(prev => prev + 1)}
                                        >
                                            +
                                        </button>
                                    </div>
                                    {finalPrice > 500 && (
                                        <p className="text-yellow-500 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-4 h-4"/>Prezzo molto alto, sei sicuro?</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="buyer" className="text-sm font-medium text-content-200 mb-1 block">Acquirente</label>
                                    <div className="relative">
                                        <select
                                            id="buyer"
                                            value={buyer || (participantNames[0] || '')}
                                            onChange={(e) => setBuyer(e.target.value)}
                                            className="w-full h-full bg-base-200 border-2 border-base-300 rounded-lg px-3 py-2 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary appearance-none pr-10"
                                            style={{ minHeight: '48px' }}
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
                             <button onClick={handleAcquirePlayer} disabled={!playerForBidding || finalPrice <= 0 || !buyer} className="w-full mt-4 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-lg">
                                <Gavel className="w-6 h-6 mr-2" />
                                Registra Acquisto
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};