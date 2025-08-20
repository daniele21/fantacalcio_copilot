import React, { useState, useMemo, useEffect, useContext } from 'react';
import { Player, Role, LeagueSettings, TargetPlayer, Skill } from '../types';
import { getAggregatedAnalysis } from '../services/geminiService';
import { PlayerCard } from './PlayerCard';
import { FilterChip } from './shared/FilterChip';
import { Loader, Frown, Sparkles, Star } from 'lucide-react';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';
import { AuthContext } from '../services/AuthContext';
import { useApi } from '../services/useApi';
import { base_url } from '../services/api';
import ShowNoCreditDialog from './showNoCreditDialog';

type AggregatedAnalysisBackendResult = {
  trend: string;
  hot_players: string[];
  trap: string;
};

interface PlayerExplorerViewProps {
  leagueSettings: LeagueSettings;
  targetPlayers: TargetPlayer[];
  players: Player[];
  onAddTarget: (player: Player) => void;
  onRemoveTarget: (playerId: number) => void;
  showFavouritesOnly: boolean;
  setShowFavouritesOnly: (v: boolean) => void;
  onSaveFavourites?: () => void;
  isSavingFavourites?: boolean;
}

export const PlayerExplorerView: React.FC<PlayerExplorerViewProps> = ({ leagueSettings, targetPlayers, players, onAddTarget, onRemoveTarget, showFavouritesOnly, setShowFavouritesOnly, onSaveFavourites, isSavingFavourites }: PlayerExplorerViewProps) => {
  const [selectedRole, setSelectedRole] = useState<Role | 'ALL'>('ALL');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [aggregatedAnalysis, setAggregatedAnalysis] = useState<{
    analysis: string | AggregatedAnalysisBackendResult;
    sources: any[];
  }>({
    analysis: "Seleziona i filtri e clicca su 'Analizza Segmento' per ottenere una valutazione strategica da Gemini.",
    sources: [],
  });
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('stars');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const { refreshProfile } = useContext(AuthContext) ?? {};
  const { call } = useApi();
  const [showNoCreditDialog, setShowNoCreditDialog] = useState(false);

  // Compute unique skills from all loaded players
  const allSkills = useMemo(() => {
    const skillSet = new Set<string>();
    players.forEach((player: Player) => (player.skills as string[]).forEach((skill: string) => skillSet.add(skill)));
    return Array.from(skillSet).sort();
  }, [players]);

  const targetPlayerIds = useMemo(() => new Set(targetPlayers.map((p: TargetPlayer) => p.id)), [targetPlayers]);

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(skill)) {
        newSet.delete(skill);
      } else {
        newSet.add(skill);
      }
      return newSet;
    });
  };

  const filteredPlayers = useMemo(() => {
    let filtered = players;
    if (showFavouritesOnly) {
      filtered = filtered.filter((player: Player) => targetPlayerIds.has(player.id));
    }
    // Filter by role unless 'ALL' is selected
    if (selectedRole !== 'ALL') {
      filtered = filtered.filter((player: Player) => player.position === selectedRole);
    }
    // Then filter by skills
    if (selectedSkills.size > 0) {
      filtered = filtered.filter((player: Player) => (player.skills as string[]).some(skill => selectedSkills.has(skill)));
    }
    if (searchTerm.trim() !== '') {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((player: Player) =>
        player.player_name.toLowerCase().includes(lower) ||
        (player.current_team && player.current_team.toLowerCase().includes(lower))
      );
    }
    // Sorting
    const sorters: Record<string, (a: Player, b: Player) => number> = {
      stars: (a, b) => (Number(b.stars ?? 0) || 0) - (Number(a.stars ?? 0) || 0),
      xBonus: (a, b) => (Number(b.xfp_per_game ?? 0) || 0) - (Number(a.xfp_per_game ?? 0) || 0),
      titolarita: (a, b) => (Number(b.titolarita ?? 0) || 0) - (Number(a.titolarita ?? 0) || 0),
      voto_medio: (a, b) => (Number(b.rating_average ?? 0) || 0) - (Number(a.rating_average ?? 0) || 0),
      big_chance: (a, b) => (Number(b.big_chances_created_per_90 ?? 0) || 0) - (Number(a.big_chances_created_per_90 ?? 0) || 0),
    };
    const sorted = filtered.sort(sorters[sortKey] || sorters['stars']);
    return sortOrder === 'asc' ? [...sorted].reverse() : sorted;
  }, [players, selectedRole, selectedSkills, showFavouritesOnly, targetPlayerIds, searchTerm, sortKey, sortOrder]);

  const handleAnalysisRequest = async () => {
    setIsAnalysisLoading(true);
    try {
      // Check credit before making Gemini call
      const creditResp: { data: { has_credit?: boolean } } = await call(`${base_url}/api/check-credit`, { method: 'GET' });
      if (!creditResp?.data.has_credit) {
        setShowNoCreditDialog(true);
        setIsAnalysisLoading(false);
        return;
      }
      // Prepare minimal player list: only player_name, MAX 20
      const minimalPlayers = filteredPlayers.slice(0, 20).map((p: Player) => p.player_name);

      // Pass null if 'ALL' is selected, otherwise pass the selectedRole
      const result = await getAggregatedAnalysis(minimalPlayers, selectedRole === 'ALL' ? null : selectedRole);
      // Defensive: check backend result structure
      let backendResult: any = result.result;
      if (!backendResult || typeof backendResult !== 'object' || (!('trend' in backendResult) && typeof backendResult !== 'string')) {
        throw new Error('Risposta backend non valida. Riprova o contatta il supporto.');
      }
      setAggregatedAnalysis({
        analysis: backendResult, // Store the raw object for custom rendering
        sources: [], // No sources from backend in new schema
      });
      // Only deduct credit if Gemini call was successful
      await call(`${base_url}/api/use-ai-credit`, { method: 'POST', body: JSON.stringify({ cost: result.cost ?? 0 }), headers: { 'Content-Type': 'application/json' } });
      await refreshProfile?.();
    } catch (err: any) {
      setAggregatedAnalysis({
        analysis: typeof err?.message === 'string' ? err.message : 'Errore durante la generazione dell\'analisi.',
        sources: [],
      });
      alert(err?.message || 'Errore durante la generazione dell\'analisi.');
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-content-200 mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* No Credit Dialog */}
      <ShowNoCreditDialog open={showNoCreditDialog} onClose={() => setShowNoCreditDialog(false)} plan={""} />

      {/* Analysis & Filters Section - make compact and collapsible */}
      <div className="bg-base-900 p-4 rounded-lg mb-2 border border-brand-primary/20" style={{maxHeight: isAnalysisOpen ? '320px' : '56px', overflow: 'auto', transition: 'max-height 0.3s'}}> 
        <button
          className="flex items-center justify-between w-full mb-2 text-xl font-bold text-brand-primary focus:outline-none"
          onClick={() => setIsAnalysisOpen((open) => !open)}
        >
          <span className="flex items-center">
            <Sparkles className="w-6 h-6 mr-3" />
            Analisi Strategica Aggregata
          </span>
          <span className={`transition-transform ${isAnalysisOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {isAnalysisOpen && (
          <div>
            {isAnalysisLoading ? (
              <div className="space-y-3">
                <div className="h-4 bg-base-300 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-base-300 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-base-300 rounded w-1/2 animate-pulse"></div>
              </div>
            ) : (
              <>
                {typeof aggregatedAnalysis.analysis === 'object' && aggregatedAnalysis.analysis !== null && 'trend' in aggregatedAnalysis.analysis ? (
                  <div className="flex flex-col gap-6">
                    {/* Trend Section
                    <div className="p-4 rounded-lg bg-blue-900 border border-blue-700 flex items-start gap-3">
                      <Sparkles className="w-6 h-6 text-blue-300 mt-1" />
                      <div>
                        <div className="font-bold text-blue-200 text-lg mb-1">Trend</div>
                        <div className="text-blue-100 text-base">{(aggregatedAnalysis.analysis as AggregatedAnalysisBackendResult).trend}</div>
                      </div>
                    </div> */}
                    {/* Hot Players Section */}
                    <div className="p-4 rounded-lg bg-green-900 border border-green-700 flex items-start gap-3">
                      <Star className="w-6 h-6 text-green-300 mt-1" />
                      <div>
                        <div className="font-bold text-green-200 text-lg mb-1">Hot Players</div>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray((aggregatedAnalysis.analysis as AggregatedAnalysisBackendResult).hot_players) && (aggregatedAnalysis.analysis as AggregatedAnalysisBackendResult).hot_players.length > 0 ? (
                            (aggregatedAnalysis.analysis as AggregatedAnalysisBackendResult).hot_players.map((name: string, idx: number) => (
                              <span key={idx} className="inline-block bg-green-800 text-green-100 font-semibold px-3 py-1 rounded-full text-sm shadow-sm border border-green-600">{name}</span>
                            ))
                          ) : (
                            <span className="text-green-100">Nessun giocatore caldo individuato.</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Trap Section */}
                    <div className="p-4 rounded-lg bg-red-900 border border-red-700 flex items-start gap-3">
                      <Frown className="w-6 h-6 text-red-300 mt-1" />
                      <div>
                        <div className="font-bold text-red-200 text-lg mb-1">Trappola</div>
                        <div className="text-red-100 text-base">{(aggregatedAnalysis.analysis as AggregatedAnalysisBackendResult).trap}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-content-100 whitespace-pre-wrap prose" style={{ background: '#18181b', color: '#fafafa', borderRadius: '0.5rem', padding: '1rem' }} dangerouslySetInnerHTML={{ __html: aggregatedAnalysis.analysis.replace(/\*\*(.*?)\*\*/g, '<strong class=\"text-content-100\">$1</strong>').replace(/\n/g, '<br />') }} />
                )}
                {aggregatedAnalysis.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-base-300/50">
                    <h4 className="font-semibold text-sm text-content-200 mb-2">Fonti utilizzate:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {aggregatedAnalysis.sources.map((source: any, index: number) => (
                        <li key={index}>
                          <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline text-sm truncate">
                            {source.title || source.uri}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters Section - compact */}
      <div className="bg-base-200 rounded-lg mb-2 border border-base-300">
        {/* <div className="flex flex-col gap-2 p-2">
          <input
            type="text"
            placeholder="Cerca giocatore..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            // className="w-full px-3 py-2 rounded border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            // className="w-full px-3 py-2 rounded border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            className="w-full px-3 py-2 rounded border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"

          />
        </div> */}
        <div className="flex flex-wrap bg-base-100 rounded-t-lg border-b-2 border-base-300 items-center gap-1 xs:gap-2 px-1 xs:px-2 py-1">
          {ROLES_ORDER.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`flex flex-col items-center justify-center min-w-[36px] xs:min-w-[60px] sm:min-w-[100px] flex-1 text-center font-bold p-2 xs:p-3 text-xs xs:text-sm transition-colors duration-200 border-b-4 ${selectedRole === role ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
            >
              <span className="block sm:hidden">
                {/* Use a role icon here if available, fallback to first letter */}
                {role === Role.GK ? '🧤' : role === Role.DEF ? '🛡️' : role === Role.MID ? '🎯' : role === Role.FWD ? '⚡' : role[0]}
              </span>
              <span className="hidden sm:block">{ROLE_NAMES[role]}</span>
            </button>
          ))}
          <button
            key="ALL"
            onClick={() => setSelectedRole('ALL')}
            className={`flex flex-col items-center justify-center min-w-[36px] xs:min-w-[60px] sm:min-w-[100px] flex-1 text-center font-bold p-2 xs:p-3 text-xs xs:text-sm transition-colors duration-200 border-b-4 ${selectedRole === 'ALL' ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
          >
            <span className="block sm:hidden">🔄</span>
            <span className="hidden sm:block">Tutti</span>
          </button>
          <div className="flex items-center gap-1 xs:gap-2 ml-1 xs:ml-2">
            <FilterChip
              key="favourites"
              label={
                <>
                  <span className="block sm:hidden"><Star className="w-5 h-5" /></span>
                  <span className="hidden sm:inline-flex items-center"><Star className="w-5 h-5 mr-1" /> Preferiti</span>
                </>
              }
              isActive={showFavouritesOnly}
              onClick={() => setShowFavouritesOnly(!showFavouritesOnly)}
            />
            <button
              onClick={onSaveFavourites}
              disabled={isSavingFavourites}
              className="px-2 xs:px-3 py-1 text-xs xs:text-sm font-semibold text-brand-primary bg-base-200 rounded-md hover:bg-brand-primary/10 border border-brand-primary/30 disabled:opacity-60"
            >
              <span className="block sm:hidden">💾</span>
              <span className="hidden sm:inline">{isSavingFavourites ? 'Salvataggio...' : 'Salva Preferiti'}</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Sei sicuro di voler resettare tutti i preferiti?')) {
                  targetPlayers.forEach(tp => onRemoveTarget(Number(tp.id)));
                }
              }}
              className="px-2 xs:px-3 py-1 text-xs xs:text-sm font-semibold text-red-600 bg-base-200 rounded-md hover:bg-red-100 border border-red-200"
            >
              <span className="block sm:hidden">🗑️</span>
              <span className="hidden sm:inline">Reset Preferiti</span>
            </button>
          </div>
        </div>
        <div className="p-2 sm:p-4">
          {/* Skill filter chips: horizontal scroll on mobile */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-content-200">Filtra per Skill</h3>
              {selectedSkills.size > 0 && (
                <button
                  className="ml-2 px-3 py-1 rounded-full bg-base-300 text-content-200 text-xs font-semibold hover:bg-red-100 hover:text-red-600 border border-base-300 transition-all duration-150"
                  onClick={() => setSelectedSkills(new Set())}
                  title="Azzera filtri skill"
                >
                  Azzera
                </button>
              )}
            </div>
            <div className="relative">
              {/* Horizontal scrollable chips with fade edges on mobile */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-1 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {allSkills.map((skill: string) => (
                  <FilterChip
                    key={skill}
                    label={skill}
                    isActive={selectedSkills.has(skill)}
                    onClick={() => handleSkillToggle(skill)}
                  />
                ))}
              </div>
              {/* Fade effect for scrollable area on mobile */}
              <div className="pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-base-200 via-base-200/80 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-base-200 via-base-200/80 to-transparent sm:hidden" />
            </div>
          </div>
          {/* Sorting and search row, mobile responsive */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 mb-4 sm:items-stretch">
            {/* Sort controls - increased width */}
            <div className="flex items-center gap-2 w-full sm:w-[300px] bg-base-100 rounded-lg border border-base-300 px-2 py-2 relative">
              <div className="flex items-center w-full">
                <select
                  id="sortKey"
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-base-300 bg-base-100 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm appearance-none pr-8"
                  aria-label="Ordina per"
                >
                  <option value="stars">Stelle FantaPilot</option>
                  <option value="xBonus">xBonus</option>
                  <option value="titolarita">Titolarità</option>
                  <option value="voto_medio">Voto Medio</option>
                  <option value="big_chance">Big Chance</option>
                </select>
                {/* Custom dropdown icon */}
                <span className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-content-200">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <button
                  type="button"
                  aria-label={sortOrder === 'desc' ? 'Ordine discendente' : 'Ordine ascendente'}
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="ml-1 px-2 py-1 rounded border border-base-300 bg-base-100 text-content-100 hover:bg-base-200 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm"
                  title={sortOrder === 'desc' ? 'Ordine discendente' : 'Ordine ascendente'}
                >
                  {sortOrder === 'desc' ? (
                    <span title="Ordine discendente" className="inline-block">↓</span>
                  ) : (
                    <span title="Ordine ascendente" className="inline-block">↑</span>
                  )}
                </button>
              </div>
            </div>
            {/* Search input */}
            <div className="w-full sm:w-[260px] flex items-center bg-base-100 rounded-lg border border-base-300 px-3 py-2">
              <input
                type="text"
                placeholder="Digita nome giocatore…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm text-content-100 placeholder-content-200"
              />
            </div>
            {/* Analyze button and info - reduced width */}
            <div className="w-full sm:w-webkit-fill-available; flex flex-col justify-end">
              <div className="mb-1 mt-1 flex items-center h-full">
                {/* Tooltip for Analizza button */}
                <div className="relative group flex-grow">
                  <button
                    onClick={handleAnalysisRequest}
                    disabled={isAnalysisLoading || filteredPlayers.length === 0}
                    className="w-full flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-2 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-base sm:text-base h-full min-h-[44px]"
                    // title={filteredPlayers.length > 0 ? `Giocatori analizzati: ${filteredPlayers.slice(0, 20).map(p => p.player_name).join(', ')}${filteredPlayers.length > 20 ? ` +${filteredPlayers.length - 20} altri (solo i primi 20 verranno analizzati)` : ''}` : 'Analizza i giocatori selezionati con l’AI'}
                    tabIndex={0}
                  >
                    {isAnalysisLoading ? (
                      <>
                        <Loader className="w-5 h-5 mr-2 animate-spin" />
                        Analisi in corso...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        {filteredPlayers.length > 20
                          ? 'Analizza (primi 20)'
                          : `Analizza (${filteredPlayers.length})`}
                        <span className="ml-2 px-2 py-0.5 rounded bg-white/20 border border-white/30 text-xs font-semibold text-white hidden xs:inline">1 Credito AI</span>
                      </>
                    )}
                  </button>
                  {/* Tooltip overlay on hover/focus */}
                  <div className="absolute left-1/2 z-20 -translate-x-1/2 mt-2 w-max min-w-[220px] max-w-xs bg-base-900 text-content-100 text-xs font-medium rounded-lg shadow-lg border border-base-300 px-4 py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-200" style={{top: '2.2rem'}}>
                    Puoi analizzare un segmento di massimo 20 giocatori alla volta. Seleziona filtri o preferiti per restringere la lista.
                  </div>
                </div>
                {/* Alert icon if needed */}
                {filteredPlayers.length > 20 && (
                  <div className="relative inline-block group ml-2 flex-shrink-0">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 border border-red-200 cursor-pointer transition-all duration-150 shadow-sm group-hover:bg-red-200 group-focus:bg-red-200"
                      tabIndex={0}
                      aria-label={`Limite massimo: ${filteredPlayers.length} selezionati, massimo 20 per analisi`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 5.5a7 7 0 100 14 7 7 0 000-14z" /></svg>
                    </span>
                    {/* Overlay/tooltip on hover/focus */}
                    <div className="absolute right-0 z-20 mt-2 w-max min-w-[220px] max-w-xs bg-white text-red-700 text-xs font-semibold rounded-lg shadow-lg border border-red-200 px-4 py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-200" style={{top: '2.2rem'}}>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 5.5a7 7 0 100 14 7 7 0 000-14z" /></svg>
                        <span>Giocatori selezionati: {filteredPlayers.length}.<br/>Seleziona massimo <b>20</b> giocatori per l'analisi aggregata.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* End sorting and search row */}
        </div>
      </div>
      
      {/* Player Card Grid - take remaining space */}
      <div className="flex-1 overflow-auto px-2 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map((player: Player) => (
            <PlayerCard
              key={player.id}
              player={player}
              leagueSettings={leagueSettings}
              isTarget={targetPlayerIds.has(player.id)}
              onAddTarget={onAddTarget}
              onRemoveTarget={onRemoveTarget}
            />
          ))}
        </div>
        {filteredPlayers.length === 0 && (
          <div className="col-span-full flex flex-col justify-center items-center h-64 text-content-200">
            <Frown className="w-12 h-12 mb-4" />
            <p className="text-xl">Nessun giocatore trovato.</p>
            <p>Prova a modificare i filtri di ricerca.</p>
          </div>
        )}
      </div>
    </div>
  );
};