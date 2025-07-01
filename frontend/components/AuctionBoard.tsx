
import React, { useState, useMemo } from 'react';
import { Player, Role, AuctionResult, LeagueSettings, TargetPlayer } from '../types';
import { Search, Star } from 'lucide-react';

interface AuctionBoardProps {
    players: Player[];
    auctionLog: Record<number, AuctionResult>;
    leagueSettings: LeagueSettings;
    targetPlayers: TargetPlayer[];
    onPlayerSelect: (player: Player) => void;
}

const ROLES_ORDER: Role[] = [Role.GK, Role.DEF, Role.MID, Role.FWD];
const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'Portieri', [Role.DEF]: 'Difensori', [Role.MID]: 'Centrocampisti', [Role.FWD]: 'Attaccanti' };
const ROLE_ICONS: Record<Role, string> = { [Role.GK]: '🧤', [Role.DEF]: '🛡️', [Role.MID]: '⚽', [Role.FWD]: '🎯' };

export const AuctionBoard: React.FC<AuctionBoardProps> = ({ players, auctionLog, leagueSettings, targetPlayers, onPlayerSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'available' | 'taken'>('all');
    const [selectedRole, setSelectedRole] = useState<Role>(ROLES_ORDER[0]);

    const targetPlayersMap = useMemo(() => new Map(targetPlayers.map(p => [p.id, p])), [targetPlayers]);

    const playersByRole = useMemo(() => {
        const grouped: Record<Role, Player[]> = {
            [Role.GK]: [],
            [Role.DEF]: [],
            [Role.MID]: [],
            [Role.FWD]: [],
        };
        
        for (const player of players) {
            grouped[player.role].push(player);
        }

        for (const role of ROLES_ORDER) {
            grouped[role].sort((a,b) => a.name.localeCompare(b.name));
        }

        return grouped;
    }, [players]);

    const filteredPlayers = useMemo(() => {
        const q = searchQuery.toLowerCase();
        
        if (!playersByRole[selectedRole]) return [];
        
        return playersByRole[selectedRole].filter(p => {
            const isTaken = !!auctionLog[p.id];
            const matchesFilter = 
                filter === 'all' || 
                (filter === 'available' && !isTaken) || 
                (filter === 'taken' && isTaken);

            const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);

            return matchesFilter && matchesSearch;
        });

    }, [playersByRole, auctionLog, searchQuery, filter, selectedRole]);


    const FilterButton: React.FC<{label: string, value: 'all' | 'available' | 'taken'}> = ({label, value}) => (
        <button
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === value ? 'bg-brand-primary text-white' : 'bg-base-300 text-content-200 hover:bg-base-300/70'}`}
        >
            {label}
        </button>
    );

    const RoleTabButton: React.FC<{role: Role}> = ({role}) => (
        <button
            onClick={() => setSelectedRole(role)}
            className={`flex-1 text-center font-bold p-3 transition-colors duration-200 border-b-4 ${selectedRole === role ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
        >
           <span className="hidden sm:inline-block mr-2">{ROLE_ICONS[role]}</span>{ROLE_NAMES[role]}
        </button>
    )

    return (
        <>
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-200" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cerca giocatore nel ruolo selezionato..."
                        className="w-full bg-base-100 border border-base-300 rounded-md pl-10 pr-4 py-2 text-content-100 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition"
                    />
                </div>
                <div className="flex items-center gap-2 bg-base-100 p-1 rounded-lg">
                   <FilterButton label="Tutti" value="all" />
                   <FilterButton label="Liberi" value="available" />
                   <FilterButton label="Presi" value="taken" />
                </div>
            </div>

            {/* Role Tabs */}
            <div className="flex bg-base-100 rounded-t-lg border-b-2 border-base-300">
                {ROLES_ORDER.map(role => <RoleTabButton key={role} role={role} />)}
            </div>

            {/* Board */}
            <div className="bg-base-100 rounded-b-lg overflow-y-auto max-h-[70vh]">
                 <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                        <thead className="border-b border-base-300 bg-base-200/80 backdrop-blur-sm sticky top-0">
                            <tr>
                                <th className="p-2 font-semibold text-content-200 w-2/5">Giocatore</th>
                                <th className="p-2 font-semibold text-content-200 text-center" title="Costo Base">C. Base</th>
                                <th className="p-2 font-semibold text-content-200 text-center" title="Offerta Massima Consigliata">Cons.</th>
                                <th className="p-2 font-semibold text-content-200 text-center" title="Mio Max Bid">Mio Bid</th>
                                <th className="p-2 font-semibold text-content-200 text-center">Esito Asta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300/50">
                            {filteredPlayers.map(player => {
                                const result = auctionLog[player.id];
                                const isTaken = !!result;
                                const targetInfo = targetPlayersMap.get(player.id);
                                const scaleFactor = leagueSettings.budget / 500;
                                const baseCost = Math.round(player.baseCost * scaleFactor);
                                const recommendedBid = Math.round(baseCost * 1.15);

                                return (
                                    <tr 
                                        key={player.id} 
                                        className={`transition-colors ${isTaken ? 'opacity-60 bg-base-300/10' : 'hover:bg-brand-primary/20 cursor-pointer'}`}
                                        onClick={() => !isTaken && onPlayerSelect(player)}
                                    >
                                        <td className="p-2">
                                            <div className="flex items-center">
                                                {targetInfo && <span title="Giocatore obiettivo"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-2 flex-shrink-0"/></span>}
                                                <div>
                                                    <p className={`font-semibold ${isTaken ? 'line-through' : 'text-content-100'}`}>{player.name}</p>
                                                    <p className={`text-xs ${isTaken ? 'line-through' : 'text-content-200'}`}>{player.team}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`p-2 text-center font-mono ${isTaken ? 'line-through' : ''}`}>{baseCost}</td>
                                        <td className={`p-2 text-center font-mono ${isTaken ? 'line-through' : ''}`}>{recommendedBid}</td>
                                        <td className={`p-2 text-center font-mono font-bold ${isTaken ? 'line-through' : targetInfo ? 'text-brand-primary' : 'text-content-200'}`}>
                                            {targetInfo ? targetInfo.maxBid : '-'}
                                        </td>
                                        <td className="p-2 text-center">
                                            {result ? (
                                                <div>
                                                    <p className="font-bold text-brand-primary text-sm">{result.purchasePrice} Cr</p>
                                                    <p className="text-xs text-content-100 truncate max-w-[100px] mx-auto">{result.buyer}</p>
                                                </div>
                                            ) : (
                                                <span className="text-content-200">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                     {filteredPlayers.length === 0 && (
                        <p className="text-center text-sm text-content-200 py-8">Nessun giocatore corrisponde ai filtri.</p>
                    )}
                </div>
            </div>
        </>
    );
};
