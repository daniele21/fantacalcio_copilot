import React from 'react';
import { Player, Role, LeagueSettings } from '../types';
import { Badge } from './shared/Badge';
import { Star, TrendingUp, TrendingDown, Crosshair, User, BarChart2, HeartPulse, ThumbsUp } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  leagueSettings: LeagueSettings;
  isTarget: boolean;
  onAddTarget: (player: Player) => void;
  onRemoveTarget: (playerId: number) => void;
}

const StatItem: React.FC<{ icon: React.ReactNode; label: string; value: string | number; className?: string }> = ({ icon, label, value, className }) => (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
        {icon}
        <span className="font-medium text-content-200">{label}:</span>
        <span className="font-bold text-content-100">{value}</span>
    </div>
);


export const PlayerCard: React.FC<PlayerCardProps> = ({ player, leagueSettings, isTarget, onAddTarget, onRemoveTarget }) => {
  const getRoleColor = (role: Role) => {
    switch (role) {
      case Role.GK: return 'bg-yellow-500/20 text-yellow-400';
      case Role.DEF: return 'bg-blue-500/20 text-blue-400';
      case Role.MID: return 'bg-green-500/20 text-green-400';
      case Role.FWD: return 'bg-red-500/20 text-red-400';
    }
  };

  const calculateSpendingRange = () => {
    const scaleFactor = leagueSettings.budget / 500;
    const scaledCost = player.baseCost * scaleFactor;
    const minSpend = Math.round(scaledCost * 0.9);
    const maxSpend = Math.round(scaledCost * 1.15);
    return { min: minSpend, max: maxSpend };
  };

  const spendingRange = calculateSpendingRange();

  const handleToggleTarget = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTarget) {
      onRemoveTarget(player.id);
    } else {
      onAddTarget(player);
    }
  };

  return (
    <div className="bg-base-200 rounded-xl shadow-lg overflow-hidden border border-base-300/50 transition-all duration-300 hover:border-brand-primary hover:scale-[1.02] relative">
       <div className="p-4">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={getRoleColor(player.role)}>{player.role}</Badge>
            <button 
              onClick={handleToggleTarget}
              className="p-2 rounded-full bg-base-100/50 hover:bg-base-100 transition-colors z-10"
              aria-label={isTarget ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            >
              <Star className={`w-6 h-6 transition-all ${isTarget ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500 hover:text-yellow-400'}`} />
            </button>
          </div>
          <h3 className="text-xl font-bold text-content-100">{player.name}</h3>
          <p className="text-sm text-content-200">{player.team}</p>
        </div>

        <div className="mt-3 text-sm text-brand-primary font-semibold">
          {player.skills && player.skills.length > 0 ? player.skills.join(', ') : '-'}
        </div>
      </div>

      <div className="px-4 py-3 bg-base-100/50">
        <div className="text-sm text-content-200 mb-1">Range di spesa suggerito:</div>
        <div className="text-2xl font-bold text-center text-brand-primary tracking-wide">
          {spendingRange.min} - {spendingRange.max}
          <span className="text-lg ml-1">Cr</span>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <h4 className="font-semibold text-content-200 mb-2 flex items-center"><Star className="w-4 h-4 mr-2 text-yellow-400"/>Punteggio Copilot</h4>
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-6 h-6 ${i < player.recommendation ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`} />
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 border-t border-base-300/50">
           <StatItem icon={<TrendingUp className="w-4 h-4 text-green-400"/>} label="Ceiling" value={player.analystCeiling}/>
           <StatItem icon={<TrendingDown className="w-4 h-4 text-red-400"/>} label="Floor" value={player.analystFloor}/>
        </div>

        <div className="pt-4 border-t border-base-300/50">
            <h4 className="font-semibold text-content-200 mb-3 flex items-center"><BarChart2 className="w-4 h-4 mr-2"/>Statistiche Chiave</h4>
            <div className="grid grid-cols-2 gap-2">
                <StatItem icon={<BarChart2 className="w-4 h-4"/>} label="FM 23/24" value={player.stats?.fm1y !== undefined && !isNaN(Number(player.stats.fm1y)) ? Number(player.stats.fm1y).toFixed(2) : '-'} />
                <StatItem icon={<BarChart2 className="w-4 h-4"/>} label="FM 22/23" value={player.stats?.fm2y !== undefined && !isNaN(Number(player.stats.fm2y)) ? Number(player.stats.fm2y).toFixed(2) : '-'} />
                <StatItem icon={<User className="w-4 h-4"/>} label="Presenze 23/24" value={player.stats?.presenze1y ?? '-'} />
                <StatItem icon={<HeartPulse className="w-4 h-4 text-red-400"/>} label="Rischio Infortuni" value={player.stats?.injury_score ?? '-'} />
                <StatItem icon={<Crosshair className="w-4 h-4"/>} label="xAssist" value={player.stats?.exp_assist ?? '-'} />
                <StatItem icon={<Crosshair className="w-4 h-4"/>} label="xGoal" value={player.stats?.exp_goal ?? '-'} />
                <StatItem icon={<Crosshair className="w-4 h-4"/>} label="xPresenze" value={player.stats?.exp_presenze ?? '-'} />
                <StatItem icon={<ThumbsUp className="w-4 h-4 text-green-400"/>} label="Buon Investimento" value={player.stats?.good_bet ?? '-'} />
            </div>
        </div>
      </div>
    </div>
  );
};