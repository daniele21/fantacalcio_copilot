

import React, { useState, useMemo, useEffect } from 'react';
import { Player, DetailedAnalysisResult, Role } from '../types';
import { getDetailedPlayerAnalysis } from '../services/geminiService';
import { Search, Sparkles, X, Loader, AlertTriangle, ThumbsUp, ThumbsDown, Lightbulb } from 'lucide-react';

interface TargetedSearchViewProps {
    players: Player[];
}

const AnalysisSkeleton: React.FC = () => (
    <div className="mt-6 p-6 bg-base-100 rounded-lg border border-base-300/50 animate-pulse">
        <div className="h-6 bg-base-300 rounded w-1/2 mb-6"></div>
        <div className="space-y-4">
            <div className="h-5 bg-base-300 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-base-300 rounded w-full"></div>
            <div className="h-4 bg-base-300 rounded w-5/6"></div>
        </div>
        <div className="space-y-4 mt-6">
            <div className="h-5 bg-base-300 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-base-300 rounded w-full"></div>
        </div>
         <div className="space-y-4 mt-6">
            <div className="h-5 bg-base-300 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-base-300 rounded w-full"></div>
            <div className="h-4 bg-base-300 rounded w-1/2"></div>
        </div>
    </div>
);

export const TargetedSearchView: React.FC<TargetedSearchViewProps> = ({ players }) => {
    const [query, setQuery] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [analysis, setAnalysis] = useState<DetailedAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const suggestions = useMemo(() => {
        if (!query) return [];
        return players.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }, [query, players]);
    
    useEffect(() => {
        if(selectedPlayer && query !== selectedPlayer.name) {
            setSelectedPlayer(null);
            setAnalysis(null);
        }
    }, [query, selectedPlayer]);

    const handleSelectPlayer = (player: Player) => {
        setQuery(player.name);
        setSelectedPlayer(player);
        setShowSuggestions(false);
    };

    const handleAnalyze = async () => {
        if (!selectedPlayer) {
            setError('Per favore, seleziona un giocatore dalla lista.');
            return;
        }
        setIsLoading(true);
        setError('');
        setAnalysis(null);
        try {
            const result = await getDetailedPlayerAnalysis(selectedPlayer.name, selectedPlayer.team, selectedPlayer.role);
            setAnalysis(result);
        } catch (err: any) {
            setError(err.message || "Si è verificato un errore durante la generazione dell'analisi.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setQuery('');
        setSelectedPlayer(null);
        setAnalysis(null);
        setError('');
        setShowSuggestions(false);
    };

    const getRoleColor = (role: Role) => {
        switch (role) {
            case Role.GK: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case Role.DEF: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case Role.MID: return 'bg-green-500/20 text-green-400 border-green-500/30';
            case Role.FWD: return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    return (
        <div className="bg-base-200 p-4 md:p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-brand-primary mb-1">Ricerca Mirata & Analisi On-Demand</h2>
            <p className="text-content-200 mb-6">Trova un giocatore e ottieni un'analisi dettagliata generata da Gemini e aggiornata con dati web.</p>

            <div className="relative mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-200" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Es. Lautaro Martínez"
                        className="w-full bg-base-100 border border-base-300 rounded-lg pl-10 pr-10 py-3 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"
                    />
                     {query && <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-content-200 hover:text-content-100" aria-label="Pulisci ricerca"><X className="w-5 h-5" /></button>}
                </div>
                 {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-base-300 border border-base-300/50 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {suggestions.map(player => (
                            <li key={player.id} onClick={() => handleSelectPlayer(player)} className="px-4 py-3 cursor-pointer hover:bg-brand-primary/20 flex justify-between items-center transition-colors">
                                <span>{player.name} <span className="text-sm text-content-200">({player.team})</span></span>
                                <span className="text-xs font-bold bg-base-100 px-2 py-1 rounded-md">{player.role}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <button onClick={handleAnalyze} disabled={!selectedPlayer || isLoading} className="w-full flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed">
                {isLoading ? <><Loader className="w-5 h-5 mr-2 animate-spin" />Analisi in corso...</> : <><Sparkles className="w-5 h-5 mr-2" />Genera Analisi con Gemini</>}
            </button>

            {error && <div className="mt-6 p-4 bg-red-500/10 text-red-400 rounded-lg flex items-center"><AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0"/><p>{error}</p></div>}
            
            {isLoading && <AnalysisSkeleton />}

            {analysis && selectedPlayer && (
                <div className="mt-6 bg-base-100 rounded-lg border border-base-300/50 animate-fade-in-up">
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                             <div>
                                <h3 className="text-2xl font-bold text-content-100">{selectedPlayer.name}</h3>
                                <p className="text-md text-content-200">{selectedPlayer.team}</p>
                             </div>
                             <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`px-3 py-1 text-sm font-bold rounded-full border ${getRoleColor(selectedPlayer.role)}`}>{selectedPlayer.role}</span>
                                <span className="px-3 py-1 text-sm font-semibold rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">{selectedPlayer.priceTier}</span>
                             </div>
                        </div>
                    </div>
                    
                    <div className="border-t border-base-300/50 px-6 py-5">
                       <h4 className="font-semibold text-lg text-green-400 mb-3 flex items-center"><ThumbsUp className="w-5 h-5 mr-3"/>Punti di Forza</h4>
                       <ul className="list-disc list-inside space-y-1 text-content-200">
                           {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                       </ul>
                    </div>
                    <div className="border-t border-base-300/50 px-6 py-5">
                       <h4 className="font-semibold text-lg text-red-400 mb-3 flex items-center"><ThumbsDown className="w-5 h-5 mr-3"/>Punti Deboli</h4>
                       <ul className="list-disc list-inside space-y-1 text-content-200">
                           {analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                       </ul>
                    </div>
                     <div className="border-t border-base-300/50 bg-brand-primary/5 px-6 py-5 rounded-b-lg">
                       <h4 className="font-semibold text-lg text-brand-primary mb-3 flex items-center"><Lightbulb className="w-5 h-5 mr-3"/>Consiglio per l'Asta</h4>
                       <p className="text-content-200">{analysis.advice}</p>
                    </div>

                </div>
            )}
             <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};