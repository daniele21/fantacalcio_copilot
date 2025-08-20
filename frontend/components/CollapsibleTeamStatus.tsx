import React, { useState } from 'react';
import { TeamStatus } from './TeamStatus';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MyTeamPlayer, LeagueSettings, Role } from '../types';

interface CollapsibleTeamStatusProps {
  myTeam: MyTeamPlayer[];
  leagueSettings: LeagueSettings;
  roleBudget: Record<Role, number>;
  defaultOpen?: boolean;
}

export const CollapsibleTeamStatus: React.FC<CollapsibleTeamStatusProps> = ({
  myTeam,
  leagueSettings,
  roleBudget,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-base-200 rounded-lg shadow-lg mb-2">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex justify-between items-center p-4 text-left rounded-t-lg hover:bg-base-300/50 transition-colors"
        aria-expanded={isOpen}
        aria-controls="team-status-content"
      >
        <h2 className="text-xl font-bold text-brand-primary flex items-center">
          Stato Squadra
        </h2>
        {isOpen ? (
          <ChevronUp className="w-6 h-6 text-content-200" />
        ) : (
          <ChevronDown className="w-6 h-6 text-content-200" />
        )}
      </button>
      {isOpen && (
        <div id="team-status-content" className="p-2 pt-0 transition-all duration-300 ease-in-out">
          <TeamStatus
            myTeam={myTeam}
            leagueSettings={leagueSettings}
            roleBudget={roleBudget}
          />
        </div>
      )}
    </div>
  );
};
