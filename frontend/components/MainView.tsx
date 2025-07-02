

import React, { useState } from 'react';
import { LeagueSettings, Player, Role, TargetPlayer } from '../types';
import { PlayerExplorerView } from './PreparationView';
import { TargetedSearchView } from './TargetedSearchView';
import { StrategyBoardView } from './StrategyBoardView';
import { Compass, Search, ClipboardList } from 'lucide-react';

type ActiveView = 'explorer' | 'search' | 'strategy';

interface MainViewProps {
    leagueSettings: LeagueSettings;
    players: Player[];
    roleBudget: Record<Role, number>;
    onRoleBudgetChange: (value: Record<Role, number>) => void;
    targetPlayers: TargetPlayer[];
    onAddTarget: (player: Player) => void;
    onRemoveTarget: (playerId: number) => void;
    onTargetBidChange: (playerId: number, newBid: number) => void;
}

export const MainView: React.FC<MainViewProps> = ({ leagueSettings, players, roleBudget, onRoleBudgetChange, targetPlayers, onAddTarget, onRemoveTarget, onTargetBidChange }) => {
  const [activeView, setActiveView] = useState<ActiveView>('explorer');

  const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center justify-center w-full px-4 py-3 font-semibold text-base md:text-lg rounded-t-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary
        ${
          isActive
            ? 'bg-base-200 text-brand-primary'
            : 'bg-transparent text-content-200 hover:bg-base-300/50'
        }`}
    >
      {icon}
      <span className="ml-2 md:ml-3">{label}</span>
    </button>
  );

  return (
    <div>
      <div className="border-b border-base-300 mb-6 sticky top-[65px] z-20 bg-base-100/80 backdrop-blur-lg">
          <div className="flex">
            <TabButton
              label="Esplora Giocatori"
              icon={<Compass className="w-5 h-5 md:w-6 md:h-6" />}
              isActive={activeView === 'explorer'}
              onClick={() => setActiveView('explorer')}
            />
            <TabButton
              label="Ricerca Mirata"
              icon={<Search className="w-5 h-5 md:w-6 md:h-6" />}
              isActive={activeView === 'search'}
              onClick={() => setActiveView('search')}
            />
            <TabButton
              label="Tavolo Strategia"
              icon={<ClipboardList className="w-5 h-5 md:w-6 md:h-6" />}
              isActive={activeView === 'strategy'}
              onClick={() => setActiveView('strategy')}
            />
          </div>
      </div>


      <div>
        {activeView === 'explorer' && <PlayerExplorerView 
            leagueSettings={leagueSettings} 
            players={players} 
            targetPlayers={targetPlayers}
            onAddTarget={onAddTarget}
            onRemoveTarget={onRemoveTarget}
        />}
        {activeView === 'search' && <TargetedSearchView players={players} />}
        {activeView === 'strategy' && <StrategyBoardView 
            players={players} 
            leagueSettings={leagueSettings} 
            roleBudget={roleBudget}
            onRoleBudgetChange={onRoleBudgetChange}
            targetPlayers={targetPlayers}
            onAddTarget={onAddTarget}
            onRemoveTarget={onRemoveTarget}
            onBidChange={onTargetBidChange}
        />}
      </div>
    </div>
  );
};