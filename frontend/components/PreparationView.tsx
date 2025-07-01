import React, { useState, useMemo } from 'react';
import { Player, Role, LeagueSettings, AggregatedAnalysisResult, TargetPlayer } from '../types';
import { getAggregatedAnalysis } from '../services/geminiService';
import { PlayerCard } from './PlayerCard';
import { FilterChip } from './shared/FilterChip';
import { Loader, Frown, Sparkles } from 'lucide-react';

const ROLES_ORDER: Role[] = [Role.GK, Role.DEF, Role.MID, Role.FWD];
const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'Portieri', [Role.DEF]: 'Difensori', [Role.MID]: 'Centrocampisti', [Role.FWD]: 'Attaccanti' };

interface PlayerExplorerViewProps {
    leagueSettings: LeagueSettings;
    targetPlayers: TargetPlayer[];
    players: Player[];
    onAddTarget: (player: Player) => void;
    onRemoveTarget: (playerId: number) => void;
}

export const PlayerExplorerView: React.FC<PlayerExplorerViewProps> = ({ leagueSettings, targetPlayers, players, onAddTarget, onRemoveTarget }: PlayerExplorerViewProps) => {
  const [selectedRole, setSelectedRole] = useState<Role>(ROLES_ORDER[0]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [aggregatedAnalysis, setAggregatedAnalysis] = useState<AggregatedAnalysisResult>({
    analysis: "Seleziona i filtri e clicca su 'Analizza Segmento' per ottenere una valutazione strategica da Gemini.",
    sources: [],
  });
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);

  // Compute unique skills from all loaded players
  const allSkills = useMemo(() => {
    const skillSet = new Set<string>();
    players.forEach((player: Player) => player.skills.forEach((skill: string) => skillSet.add(skill)));
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
    return players
      .filter((player: Player) => {
        const roleMatch = player.role === selectedRole;
        const skillMatch = selectedSkills.size === 0 || player.skills.some(skill => selectedSkills.has(skill));
        return roleMatch && skillMatch;
      })
      .sort((a, b) => (b.recommendation ?? 0) - (a.recommendation ?? 0));
  }, [players, selectedRole, selectedSkills]);

  const handleAnalysisRequest = async () => {
    setIsAnalysisLoading(true);
    const result = await getAggregatedAnalysis(filteredPlayers, selectedRole, selectedSkills);
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
        <h3 className="text-xl font-bold text-brand-primary mb-3 flex items-center">
            <Sparkles className="w-6 h-6 mr-3" />
            Analisi Strategica Aggregata
        </h3>
        {isAnalysisLoading ? (
             <div className="space-y-3">
                <div className="h-4 bg-base-300 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-base-300 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-base-300 rounded w-1/2 animate-pulse"></div>
            </div>
        ) : (
            <>
                <div className="text-content-200 whitespace-pre-wrap prose" dangerouslySetInnerHTML={{ __html: aggregatedAnalysis.analysis.replace(/\*\*(.*?)\*\*/g, '<strong class="text-content-100">$1</strong>').replace(/\n/g, '<br />') }}/>
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

      <div className="bg-base-200 rounded-lg mb-6 sticky top-[125px] z-20 backdrop-blur-sm bg-opacity-80 border border-base-300">
        <div className="flex bg-base-100 rounded-t-lg border-b-2 border-base-300">
            {ROLES_ORDER.map(role => (
                 <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`flex-1 text-center font-bold p-3 transition-colors duration-200 border-b-4 ${selectedRole === role ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
                >
                   {ROLE_NAMES[role]}
                </button>
            ))}
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
            <div className="mt-2 pt-4 border-t border-base-300">
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