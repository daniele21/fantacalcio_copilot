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
  // console.log('PlayerCard injury_risk_band:', player.injury_risk_band);

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
    const scale1000 = leagueSettings.budget / 1000;
    const cost = player.baseCost * scale;
    return { min: Math.round(player.suggestedBidMin * scale), max: Math.round(player.suggestedBidMax * scale) };
    // return { min: Math.round(cost * 0.9), max: Math.round(cost * 1.15) };
  }, [leagueSettings.budget, player.predicted_price]);

  const toggleTarget = (e: React.MouseEvent) => {
    e.stopPropagation();
    isTarget ? onRemoveTarget(player.id) : onAddTarget(player);
  };

  // Prepare stats for player card by role
  const getStatsByRole = (role: Role) => {
    // Group bonus stats with custom icons and highlight font
    const bonusStats = [
      { label: 'xBonus', value: player.xfp_per_game, icon: Crosshair },
      { label: 'Bonus Goal', value: player.gol_bonus, icon: Star },
      { label: 'Bonus Assist', value: player.assist_bonus, icon: ThumbsUp },
      { label: 'Malus', value: player.malus_risk_raw, icon: BarChart2 },
    ];
    switch (role) {
      case Role.FWD:
        return {
          bonusStats,
          otherStats: [
            { label: 'Titolarità', value: player.titolarita, icon: User },
            { label: 'Voto Medio', value: player.rating_average, icon: Star },
            { label: 'Big Chance', value: player.big_chances_created_per_90, icon: Crosshair },
            { label: 'Rischio Infortuni', value: player.injury_risk_band, icon: HeartPulse },
          ]
        };
      case Role.MID:
        return {
          bonusStats,
          otherStats: [
            { label: 'Titolarità', value: player.titolarita, icon: User },
            { label: 'Voto Medio', value: player.rating_average, icon: Star },
            { label: 'Big Chance', value: player.big_chances_created_per_90, icon: Crosshair },
            { label: 'Rischio Infortuni', value: player.injury_risk_band, icon: HeartPulse },
          ]
        };
      case Role.DEF:
        return {
          bonusStats,
          otherStats: [
            { label: 'Titolarità', value: player.titolarita, icon: User },
            { label: 'Voto Medio', value: player.rating_average, icon: Star },
            { label: 'Tackle Riusciti', value: player.tackle_success_rate, icon: BarChart2 },
            { label: 'Rischio Infortuni', value: player.injury_risk_band, icon: HeartPulse },
          ]
        };
      case Role.GK:
        return {
          bonusStats: [
            { label: 'Porta Inviolata', value: player.clean_sheet_bonus, icon: Star },
            { label: 'Pararigori', value: player.pen_save_bonus, icon: ThumbsUp },
            { label: 'Malus', value: player.malus_risk_raw, icon: BarChart2 },
            { label: 'xBonus', value: player.xfp_per_game, icon: Crosshair },
          ],
          otherStats: [
            { label: 'Titolarità', value: player.titolarita, icon: User },
            { label: 'Voto Medio', value: player.rating_average, icon: Star },
            { label: 'Rigori Parati', value: player.penalties_saved, icon: ThumbsUp },
            { label: 'Rischio Infortuni', value: player.injury_risk_band, icon: HeartPulse },
          ]
        };
      default:
        return { bonusStats: [], otherStats: [] };
    }
  };

  // Fix: ensure player.position is cast to Role for getStatsByRole
  const { bonusStats, otherStats } = getStatsByRole(player.position as Role);

  // Add a background color class based on player role
  const cardBgClass = (() => {
    switch (player.position) {
      case Role.GK:
        return 'bg-yellow-100/40 dark:bg-yellow-900/40';
      case Role.DEF:
        return 'bg-blue-100/40 dark:bg-blue-900/40';
      case Role.MID:
        return 'bg-green-100/40 dark:bg-green-900/40';
      case Role.FWD:
        return 'bg-red-100/40 dark:bg-red-900/40';
      default:
        return 'bg-base-200/40 dark:bg-base-800/40';
    }
  })();

  return (
    <article className={`flex flex-col h-full border dark:border-base-600 border-base-300 shadow-lg rounded-xl overflow-hidden ${cardBgClass}`}>
      <section className="px-3 xs:px-4 pt-3">
        {/* Name and favourite star in the same row */}
        <div className="flex flex-row items-center justify-between gap-2">
          <h1 className="font-bold text-xl xs:text-2xl break-words flex-1 min-w-0">
            {player.player_name}
          </h1>
          <button
            onClick={toggleTarget}
            aria-label={isTarget ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            className="p-2 rounded-full dark:bg-base-700 bg-base-100/50 hover:dark:bg-base-600 transition-colors flex-shrink-0"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                isTarget ? 'text-yellow-300 fill-yellow-300' : 'text-gray-400 hover:text-yellow-300'
              }`}
            />
          </button>
        </div>
        {/* Role badge and team below name */}
        <div className="flex flex-row items-center gap-2 mt-1">
          <Badge className={getRoleColor(player.position as Role)}>{player.position}</Badge>
          <span className="text-xs xs:text-base font-semibold text-content-200 dark:text-content-200">{player.current_team}</span>
        </div>
        {/* Skills below role/team */}
        <div className="flex flex-wrap gap-1 text-xs xs:text-sm mt-1 mb-2">
          {(player.skills && player.skills.length > 0
            ? player.skills.slice(0, 2)
            : ['Nessuna Skill']
          ).map(skill => (
            <Badge key={skill} className="dark:bg-base-700 bg-base-100 text-content-200 px-2 py-1">
              {skill}
            </Badge>
          ))}
          {player.skills && player.skills.length > 2 && (
            <details className="relative">
              <summary className="cursor-pointer text-xs xs:text-sm text-content-600 dark:text-content-200 px-2 py-1 rounded-md hover:bg-base-100 dark:hover:bg-base-700">
                +{player.skills.length - 2} more
              </summary>
              <div className="absolute mt-1 bg-base-200 dark:bg-base-800 p-2 rounded shadow-lg flex flex-wrap gap-1 z-10">
                {player.skills.slice(2).map(skill => (
                  <Badge key={skill} className="dark:bg-base-700 bg-base-100 text-content-200 px-2 py-1">
                    {skill}
                  </Badge>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      <section className="px-3 xs:px-4">
        <div className="dark:bg-base-700 bg-base-100/50 p-2 xs:p-3 rounded-md text-center mb-4">
          <p className="text-xs xs:text-s dark:text-content-200 text-content-200 mb-1">Range di spesa suggerito</p>
          <p className="text-base xs:text-lg font-bold dark:text-brand-primary text-brand-primary tracking-wide">
            {min} - {max} <span className="text-m">Cr</span>
          </p>
        </div>
      </section>

      <section className="px-3 xs:px-4 flex items-center gap-1 xs:gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-5 xs:w-6 h-5 xs:h-6 ${
              player.stars && i < player.stars
                ? 'text-yellow-300 fill-yellow-300'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          />
        ))}
        <span className="text-xs xs:text-sm font-medium dark:text-content-200 text-content-200">
          {player.stars && player.stars >= 4 ? 'Top Pick' : `${player.stars ?? 0}/5`}
        </span>
      </section>

      <details className="mt-auto px-3 xs:px-4 pb-4 dark:border-t dark:border-base-600 border-t border-base-300" open>
        <summary className="flex items-center justify-between cursor-pointer py-2 text-xs xs:text-sm font-semibold dark:text-content-200 text-content-200">
          <div className="flex items-center gap-1">
            <BarChart2 className="w-4 h-4" />
            <span className="text-base xs:text-lg font-bold">Statistiche Chiave</span>
          </div>
          <span aria-hidden>▾</span>
        </summary>
        {/* Bonus a partita container */}
        <div className="mb-2">
          <div className="font-extrabold text-base xs:text-lg text-brand-primary dark:text-yellow-300 mb-1 tracking-wide uppercase">Bonus a partita</div>
          <div className="grid grid-cols-1 gap-2">
            {bonusStats.map(({ label, icon: Icon, value }) => {
              let displayValue = '-';
              let bgClass = '';
              let textClass = '';
              // Assign a different color for each bonus stat
              switch (label) {
                case 'xBonus':
                  bgClass = 'bg-gradient-to-r from-yellow-100/60 to-yellow-300/30 dark:from-yellow-900/60 dark:to-yellow-700/30 border-yellow-200 dark:border-yellow-700';
                  textClass = 'text-yellow-700 dark:text-yellow-200';
                  break;
                case 'Bonus Goal':
                  bgClass = 'bg-gradient-to-r from-green-100/60 to-green-300/30 dark:from-green-900/60 dark:to-green-700/30 border-green-200 dark:border-green-700';
                  textClass = 'text-green-700 dark:text-green-200';
                  break;
                case 'Bonus Assist':
                  bgClass = 'bg-gradient-to-r from-blue-100/60 to-blue-300/30 dark:from-blue-900/60 dark:to-blue-700/30 border-blue-200 dark:border-blue-700';
                  textClass = 'text-blue-700 dark:text-blue-200';
                  break;
                case 'Malus':
                  bgClass = 'bg-gradient-to-r from-red-100/60 to-red-300/30 dark:from-red-900/60 dark:to-red-700/30 border-red-200 dark:border-red-700';
                  textClass = 'text-red-700 dark:text-red-200';
                  break;
                default:
                  bgClass = 'bg-gradient-to-r from-yellow-100/60 to-yellow-300/30 dark:from-yellow-900/60 dark:to-yellow-700/30 border-yellow-200 dark:border-yellow-700';
                  textClass = 'text-yellow-700 dark:text-yellow-200';
              }
              if (value !== undefined && value !== null && !isNaN(Number(value))) {
                displayValue = Number(value).toFixed(2);
              }
              return (
                <div
                  key={label}
                  className={`flex flex-row items-center justify-between gap-2 p-2 rounded-lg shadow-sm border min-w-0 ${bgClass}`}
                >
                  <div className={`flex items-center gap-2 text-sm xs:text-base font-bold min-w-0 ${textClass}`}>
                    {Icon && <Icon className="w-4 xs:w-5 h-4 xs:h-5 shrink-0" />}
                    <span className="uppercase tracking-wide truncate max-w-[150px] xs:max-w-[160px]">{label}</span>
                  </div>
                  <span className={`font-mono text-base xs:text-xl font-extrabold break-words ${textClass}`}>
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Other stats */}
        <div className="font-semibold text-xs xs:text-sm text-content-200 dark:text-content-200 mb-1">Altre statistiche</div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {otherStats.map(({ label, icon: Icon, value }) => {
            let displayValue = '-';
            if (label === 'Rischio Infortuni') {
              // console.log('Rischio Infortuni for', player.player_name, ':', value);
              if (value !== undefined && value !== null && value !== '') {
                displayValue = String(value);
              }
            } else if (value !== undefined && value !== null && !isNaN(Number(value))) {
              if (label === 'Voto Medio' || label === 'Big Chance' || label === 'Tackle Riusciti') {
                displayValue = Number(value).toFixed(2);
              } else {
                displayValue = Math.round(Number(value)) + '%';
              }
            }
            return (
              <div
                key={label}
                className="flex flex-row items-center justify-between gap-2 p-2 rounded-lg dark:bg-base-700"
              >
                <div className="flex items-center gap-1 text-xs xs:text-sm dark:text-content-300 text-content-600">
                  {Icon && <Icon className={`w-4 xs:w-4 h-4 xs:h-4 ${getIconColor(label)}`} />}
                  <span>{label}</span>
                </div>
                <span className={` ${label.startsWith('x') ? 'font-normal' : 'font-mono font-semibold'} dark:text-content-50 text-content-100`}>
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
        
      </details>
    </article>
  );
};
