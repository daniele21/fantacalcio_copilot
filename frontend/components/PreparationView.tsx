import React, { useState, useMemo } from 'react';
import { Player, Role, LeagueSettings, AggregatedAnalysisResult, TargetPlayer, Skill } from '../types';
import { getAggregatedAnalysis } from '../services/geminiService';
import { PlayerCard } from './PlayerCard';
import { FilterChip } from './shared/FilterChip';
import { Loader, Frown, Sparkles, Star } from 'lucide-react';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';

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
  const [aggregatedAnalysis, setAggregatedAnalysis] = useState<AggregatedAnalysisResult>({
    analysis: "Seleziona i filtri e clicca su 'Analizza Segmento' per ottenere una valutazione strategica da Gemini.",
    sources: [],
  });
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('recommendation');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
      filtered = filtered.filter((player: Player) => player.role === selectedRole);
    }
    // Then filter by skills
    if (selectedSkills.size > 0) {
      filtered = filtered.filter((player: Player) => (player.skills as string[]).some(skill => selectedSkills.has(skill)));
    }
    if (searchTerm.trim() !== '') {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter((player: Player) =>
        player.name.toLowerCase().includes(lower) ||
        (player.team && player.team.toLowerCase().includes(lower))
      );
    }
    // Sorting
    const sorters: Record<string, (a: Player, b: Player) => number> = {
      recommendation: (a, b) => (parseFloat(b.recommendation ?? 0) || 0) - (parseFloat(a.recommendation ?? 0) || 0),
      good_bet: (a, b) => {
        // Log good_bet values for debugging
        // console.log('good_bet a:', a.stats?.good_bet, 'good_bet b:', b.stats?.good_bet);
        const parseScore = (val: any) => {
          if (typeof val === 'string' && /^\d/.test(val)) return parseInt(val[0], 10);
          if (typeof val === 'number') return val;
          return null;
        };
        const bScore = parseScore(b.stats?.good_bet);
        const aScore = parseScore(a.stats?.good_bet);
        if (bScore === null && aScore === null) return 0;
        if (bScore === null) return 1;
        if (aScore === null) return -1;
        return bScore - aScore;
      },
      xGoal: (a, b) => {
        // Log xGoal values for debugging
        // console.log('xGoal a:', a.stats.exp_goal, 'xGoal b:', b.stats.exp_goal);
        const parseX = (val: any) => {
          if (typeof val === 'string' && /^\d+/.test(val)) return parseInt(val.match(/^\d+/)?.[0] ?? '0', 10);
          if (typeof val === 'number') return val;
          return 0;
        };
        return parseX(b.stats.exp_goal) - parseX(a.stats.exp_goal);
      },
      fm2324: (a, b) => (parseFloat(b.stats.fm1y ?? 0) || 0) - (parseFloat(a.stats.fm1y ?? 0) || 0),
      xPresenze: (a, b) => {
        const parseX = (val: any) => {
          if (typeof val === 'string' && /^\d+/.test(val)) return parseInt(val.match(/^\d+/)?.[0] ?? '0', 10);
          if (typeof val === 'number') return val;
          return 0;
        };
        return parseX(b.stats.exp_presenze) - parseX(a.stats.exp_presenze);
      },
      xAssist: (a, b) => {
        const parseX = (val: any) => {
          if (typeof val === 'string' && /^\d+/.test(val)) return parseInt(val.match(/^\d+/)?.[0] ?? '0', 10);
          if (typeof val === 'number') return val;
          return 0;
        };
        return parseX(b.stats.exp_assist) - parseX(a.stats.exp_assist);
      },
    };
    const sorted = filtered.sort(sorters[sortKey === 'buonInvestimento' ? 'good_bet' : sortKey] || sorters['recommendation']);
    return sortOrder === 'asc' ? [...sorted].reverse() : sorted;
  }, [players, selectedRole, selectedSkills, showFavouritesOnly, targetPlayerIds, searchTerm, sortKey, sortOrder]);

  const handleAnalysisRequest = async () => {
    setIsAnalysisLoading(true);
    // Pass null if 'ALL' is selected, otherwise pass the selectedRole
    const result = await getAggregatedAnalysis(filteredPlayers, selectedRole === 'ALL' ? null : selectedRole);
    setAggregatedAnalysis(result);
    setIsAnalysisLoading(false);
  };

  const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-content-200 mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <div>
      <div className="bg-base-200 p-6 rounded-lg mb-8 border border-brand-primary/20">
        <button
          className="flex items-center justify-between w-full mb-3 text-xl font-bold text-brand-primary focus:outline-none"
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
                <div className="text-content-200 whitespace-pre-wrap prose" dangerouslySetInnerHTML={{ __html: aggregatedAnalysis.analysis.replace(/\*\*(.*?)\*\*/g, '<strong class=\"text-content-100\">$1</strong>').replace(/\n/g, '<br />') }} />
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

      <div className="bg-base-200 rounded-lg mb-6 sticky top-[125px] z-20 backdrop-blur-sm bg-opacity-80 border border-base-300">
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
        <div className="flex flex-wrap bg-base-100 rounded-t-lg border-b-2 border-base-300 items-center gap-2 px-2 py-1">
          {ROLES_ORDER.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`min-w-[100px] flex-1 text-center font-bold p-3 transition-colors duration-200 border-b-4 ${selectedRole === role ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
            >
              {ROLE_NAMES[role]}
            </button>
          ))}
          <button
            key="ALL"
            onClick={() => setSelectedRole('ALL')}
            className={`min-w-[100px] flex-1 text-center font-bold p-3 transition-colors duration-200 border-b-4 ${selectedRole === 'ALL' ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
          >
            Tutti
          </button>
          <div className="flex items-center gap-2 ml-2">
            <FilterChip
              key="favourites"
              label={<Star className="w-5 h-5" />}
              isActive={showFavouritesOnly}
              onClick={() => setShowFavouritesOnly(!showFavouritesOnly)}
            />
            <button
              onClick={onSaveFavourites}
              disabled={isSavingFavourites}
              className="px-3 py-1.5 text-sm font-semibold text-brand-primary bg-base-200 rounded-md hover:bg-brand-primary/10 border border-brand-primary/30 disabled:opacity-60"
            >
              {isSavingFavourites ? 'Salvataggio...' : 'Salva Preferiti'}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Sei sicuro di voler resettare tutti i preferiti?')) {
                  targetPlayers.forEach(tp => onRemoveTarget(tp.id));
                }
              }}
              className="px-3 py-1.5 text-sm font-semibold text-red-600 bg-base-200 rounded-md hover:bg-red-100 border border-red-200"
            >
              Reset Preferiti
            </button>
          </div>
        </div>
        <div className="p-4">
          <FilterSection title="Filtra per Skill">
            {allSkills.map((skill: string) => (
              <FilterChip
                key={skill}
                label={skill}
                isActive={selectedSkills.has(skill)}
                onClick={() => handleSkillToggle(skill)}
              />
            ))}
          </FilterSection>
          {/* Sorting and search row */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label htmlFor="sortKey" className="font-medium text-content-200 whitespace-nowrap">Ordina per:</label>
              <select
                id="sortKey"
                value={sortKey}
                onChange={e => setSortKey(e.target.value)}
                className="px-3 py-2 rounded-lg border border-base-300 bg-base-100 text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="recommendation">Stelle Copilot</option>
                <option value="buonInvestimento">Buon investimento</option>
                <option value="fm2324">FM23/24</option>
                <option value="xGoal">xGoal</option>
                <option value="xAssist">xAssist</option>
                <option value="xPresenze">xPresenze</option>
              </select>
              <button
                type="button"
                aria-label={sortOrder === 'desc' ? 'Ordine discendente' : 'Ordine ascendente'}
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="ml-1 px-2 py-2 rounded border border-base-300 bg-base-100 text-content-100 hover:bg-base-200 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              >
                {sortOrder === 'desc' ? (
                  <span title="Ordine discendente" className="inline-block">↓</span>
                ) : (
                  <span title="Ordine ascendente" className="inline-block">↑</span>
                )}
              </button>
            </div>
            <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-1/3">
                <input
                  type="text"
                  placeholder="Digita nome giocatore…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-4 py-2 rounded-lg bg-white border-2 border-gray-200 text-black placeholder-black/50 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 transition-all duration-200 ease-in-out"
                />
              </div>
              <div className="w-full md:w-2/3">
                <button
                  onClick={handleAnalysisRequest}
                  disabled={isAnalysisLoading || filteredPlayers.length === 0}
                  className="w-full flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  {isAnalysisLoading ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Analizza Segmento ({filteredPlayers.length} giocatori)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          {/* End sorting and search row */}
        </div>
      </div>
      
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
  );
};