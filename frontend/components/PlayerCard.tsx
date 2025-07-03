import React from 'react';
import { Player, Role, LeagueSettings } from '../types';
import { Badge } from './shared/Badge';
import {
  Star,
  Crosshair,
  User,
  BarChart2,
  HeartPulse,
  ThumbsUp,
} from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  leagueSettings: LeagueSettings;
  isTarget: boolean;
  onAddTarget: (player: Player) => void;
  onRemoveTarget: (playerId: number) => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  leagueSettings,
  isTarget,
  onAddTarget,
  onRemoveTarget,
}) => {
  const getRoleColor = (role: Role) => {
    switch (role) {
      case Role.GK:
        return 'dark:bg-yellow-900 dark:text-yellow-300';
      case Role.DEF:
        return 'dark:bg-blue-900 dark:text-blue-300';
      case Role.MID:
        return 'dark:bg-green-900 dark:text-green-300';
      case Role.FWD:
        return 'dark:bg-red-900 dark:text-red-300';
    }
  };

  const getIconColor = (label: string) => {
    if (label.startsWith('FM')) return 'text-purple-300';
    if (label.includes('Presenze')) return 'text-indigo-300';
    if (label.includes('Rischio')) return 'text-red-300';
    if (label.startsWith('x')) return 'text-yellow-300';
    if (label.includes('Buon')) return 'text-green-300';
    return 'text-content-400';
  };

  const { min, max } = React.useMemo(() => {
    const scale = leagueSettings.budget / 500;
    const cost = player.baseCost * scale;
    return { min: Math.round(cost * 0.9), max: Math.round(cost * 1.15) };
  }, [leagueSettings.budget, player.baseCost]);

  const toggleTarget = (e: React.MouseEvent) => {
    e.stopPropagation();
    isTarget ? onRemoveTarget(player.id) : onAddTarget(player);
  };

  // Prepare stats, ensure xAssist, xGoal, xPresenze are treated as text
  const stats = [
    { label: 'FM 23/24', icon: BarChart2, value: player.stats?.fm1y },
    { label: 'FM 22/23', icon: BarChart2, value: player.stats?.fm2y },
    { label: 'Presenze 23/24', icon: User, value: player.stats?.presenze1y },
    { label: 'Rischio Infortuni', icon: HeartPulse, value: player.stats?.injury_score },
    { label: 'xAssist', icon: Crosshair, value: player.stats?.exp_assist?.toString() ?? '-' },
    { label: 'xGoal', icon: Crosshair, value: player.stats?.exp_goal?.toString() ?? '-' },
    { label: 'xPresenze', icon: Crosshair, value: player.stats?.exp_presenze?.toString() ?? '-' },
    { label: 'Buon Investimento', icon: ThumbsUp, value: player.stats?.good_bet },
  ];

  return (
    <article className="flex flex-col h-full border dark:border-base-600 border-base-300 shadow-lg rounded-xl dark:bg-base-800 bg-base-200 overflow-hidden">
      <header className="flex items-center justify-between p-4">
        <Badge className={getRoleColor(player.role)}>{player.role}</Badge>
        <button
          onClick={toggleTarget}
          aria-label={isTarget ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          className="p-2 rounded-full dark:bg-base-700 bg-base-100/50 hover:dark:bg-base-600 transition-colors"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              isTarget ? 'text-yellow-300 fill-yellow-300' : 'text-gray-400 hover:text-yellow-300'
            }`}
          />
        </button>
      </header>

      <section className="px-4">
        <h1 className="font-bold text-2xl">
          {player.name}
        </h1>
        <p className="text-lg font-semibold dark:text-content-200 text-content-200 mb-2">{player.team}</p>

        {/* Skills: show first 3 always, extras collapsible */}
{/* Skills: first 3 always visible, extras collapsible inline */}
{/* Skills */}
{/* Skills: first 3 always visible, extras collapsible */}
<div className="flex flex-wrap gap-1 text-sm mb-4">
  {player.skills?.slice(0, 2).map(skill => (
    <Badge key={skill} className="dark:bg-base-700 bg-base-100 text-content-200 text-xs px-2 py-1">
      {skill}
    </Badge>
  ))}
  {player.skills && player.skills.length > 2 && (
    <details className="relative">
      <summary className="cursor-pointer text-sm text-content-600 dark:text-content-200 px-2 py-1 rounded-md hover:bg-base-100 dark:hover:bg-base-700">
        +{player.skills.length - 2} more
      </summary>
      <div className="absolute mt-1 bg-base-200 dark:bg-base-800 p-2 rounded shadow-lg flex flex-wrap gap-1 z-10">
        {player.skills.slice(2).map(skill => (
          <Badge key={skill} className="dark:bg-base-700 bg-base-100 text-content-200 text-xs px-2 py-1">
            {skill}
          </Badge>
        ))}
      </div>
    </details>
  )}
</div>
      </section>

      <section className="px-4">
        <div className="dark:bg-base-700 bg-base-100/50 p-3 rounded-md text-center mb-4">
          <p className="text-s dark:text-content-200 text-content-200 mb-1">Range di spesa suggerito</p>
          <p className="text-lg font-bold dark:text-brand-primary text-brand-primary tracking-wide">
            {min} - {max} <span className="text-m">Cr</span>
          </p>
        </div>
      </section>

      <section className="px-4 flex items-center gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-6 h-6 ${
              i < player.recommendation
                ? 'text-yellow-300 fill-yellow-300'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          />
        ))}
        <span className="text-sm font-medium dark:text-content-200 text-content-200">
          {player.recommendation >= 4 ? 'Top Pick' : `${player.recommendation}/5`}
        </span>
      </section>

      <details className="mt-auto px-4 pb-4 dark:border-t dark:border-base-600 border-t border-base-300" open>
        <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-semibold dark:text-content-200 text-content-200">
          <div className="flex items-center gap-1">
            <BarChart2 className="w-4 h-4" />
            <span className="text-lg font-bold">Statistiche Chiave</span>
          </div>
          <span aria-hidden>▾</span>
        </summary>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {stats.map(({ label, icon: Icon, value }) => (
            <div
              key={label}
              className="flex items-center justify-between p-2 rounded-lg dark:bg-base-700"
            >
              <div className="flex items-center gap-1 text-sm dark:text-content-300 text-content-600">
                <Icon className={`w-4 h-4 ${getIconColor(label)}`} />
                <span>{label}</span>
              </div>
              <span className={` ${label.startsWith('x') ? 'font-normal' : 'font-mono font-semibold'} dark:text-content-50 text-content-100`}>
                {value ?? '-'}
              </span>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
};
