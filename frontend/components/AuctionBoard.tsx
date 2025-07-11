import React, { useState, useMemo } from 'react';
import { Player, AuctionResult, LeagueSettings, TargetPlayer, Role } from '../types';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';
import { Search, Star } from 'lucide-react';

interface AuctionBoardProps {
    players: Player[];
    auctionLog: Record<number, AuctionResult>;
    leagueSettings: LeagueSettings;
    targetPlayers: TargetPlayer[];
    onPlayerSelect: (player: Player) => void;
}

const ROLE_ICONS: Record<Role, string> = { [Role.GK]: '🧤', [Role.DEF]: '🛡️', [Role.MID]: '⚽', [Role.FWD]: '🎯' };

export const AuctionBoard: React.FC<AuctionBoardProps> = ({ players, auctionLog, leagueSettings, targetPlayers, onPlayerSelect }) => {
    // Fix: Add type for auctionLog index (move this to the top before any use)
    const getAuctionLogResult = (id: number) => (auctionLog[id as keyof typeof auctionLog] || auctionLog[String(id) as keyof typeof auctionLog]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'available' | 'taken' | 'favourite'>('all');
    const [selectedRole, setSelectedRole] = useState<Role | 'ALL'>('ALL');

    const targetPlayersMap = useMemo(() => new Map(targetPlayers.map(p => [p.id, p])), [targetPlayers]);

    const playersByRole = useMemo(() => {
        const grouped = players.reduce((acc, player) => {
            if (!acc[player.role]) {
                acc[player.role] = [];
            }
            acc[player.role].push(player);
            return acc;
        }, {} as Record<Role, Player[]>);

        for (const role of ROLES_ORDER) {
            if (grouped[role]) {
              grouped[role].sort((a, b) => a.name.localeCompare(b.name));
            } else {
              grouped[role] = [];
            }
        }
        return grouped;
    }, [players]);


    // Ensure auctionLog lookup is robust (string/number)
    const filteredPlayers = useMemo(() => {
        const q = searchQuery.toLowerCase();
        let playersToFilter: Player[] = [];
        if (selectedRole === 'ALL') {
            playersToFilter = players;
        } else {
            playersToFilter = playersByRole[selectedRole] || [];
        }
        return playersToFilter.filter((p: Player) => {
            // Robustly check if player is taken
            const isTaken = !!getAuctionLogResult(p.id);
            const isFavourite = !!targetPlayersMap.get(p.id);
            const matchesFilter =
                filter === 'all' ||
                (filter === 'available' && !isTaken) ||
                (filter === 'taken' && isTaken) ||
                (filter === 'favourite' && isFavourite);
            const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
            return matchesFilter && matchesSearch;
        });
    }, [players, playersByRole, auctionLog, searchQuery, filter, selectedRole, targetPlayersMap]);

    const RoleTabButton: React.FC<{role: Role}> = ({role}) => (
        <button
            onClick={() => setSelectedRole(role)}
            className={`flex-1 text-center font-bold p-3 transition-colors duration-200 border-b-4 ${selectedRole === role ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
        >
           <span className="hidden sm:inline-block mr-2">{ROLE_ICONS[role]}</span>{ROLE_NAMES[role]}
        </button>
    );

    const FilterButton: React.FC<{label: string, value: 'all' | 'available' | 'taken' | 'favourite', icon?: React.ReactNode}> = ({label, value, icon}) => (
        <button
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1 ${filter === value ? 'bg-brand-primary text-white' : 'bg-base-300 text-content-200 hover:bg-base-300/70'}`}
        >
            {icon}
            {label}
        </button>
    );

    // Fix: Only check playersByRole[selectedRole] if selectedRole !== 'ALL'
    React.useEffect(() => {
        if (selectedRole !== 'ALL' && (!playersByRole[selectedRole] || playersByRole[selectedRole].length === 0)) {
            const firstNonEmpty = ROLES_ORDER.find(role => playersByRole[role] && playersByRole[role].length > 0);
            if (firstNonEmpty && firstNonEmpty !== selectedRole) {
                setSelectedRole(firstNonEmpty);
            }
        }
    }, [playersByRole, selectedRole]);

    const [sortBy, setSortBy] = useState<'name'|'baseCost'|'recommendedBid'|'maxBid'|'result'>("name");
    const [sortDir, setSortDir] = useState<'asc'|'desc'>("asc");

    const handleSort = (col: typeof sortBy) => {
        if (sortBy === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('asc');
        }
    };

    // Also update isTaken and result lookup in sortedPlayers
    const sortedPlayers = React.useMemo(() => {
        const arr = [...filteredPlayers];
        arr.sort((a, b) => {
            let aVal: any, bVal: any;
            const scaleFactor = leagueSettings.budget / 500;
            if (sortBy === 'name') {
                aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase();
            } else if (sortBy === 'baseCost') {
                aVal = a.baseCost ?? 0; bVal = b.baseCost ?? 0;
            } else if (sortBy === 'recommendedBid') {
                aVal = Math.round((a.baseCost ?? 0) * scaleFactor * 1.15);
                bVal = Math.round((b.baseCost ?? 0) * scaleFactor * 1.15);
            } else if (sortBy === 'maxBid') {
                aVal = targetPlayersMap.get(a.id)?.maxBid ?? 0;
                bVal = targetPlayersMap.get(b.id)?.maxBid ?? 0;
            } else if (sortBy === 'result') {
                aVal = (getAuctionLogResult(a.id)?.purchasePrice) ?? 0;
                bVal = (getAuctionLogResult(b.id)?.purchasePrice) ?? 0;
            }
            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return arr;
    }, [filteredPlayers, sortBy, sortDir, targetPlayersMap, auctionLog, leagueSettings.budget]);

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
                   <FilterButton label="Preferiti" value="favourite" icon={<Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />} />
                </div>
            </div>

            {/* Role Tabs */}
            <div className="flex bg-base-100 rounded-t-lg border-b-2 border-base-300">
                <button
                    onClick={() => setSelectedRole('ALL')}
                    className={`flex-1 text-center font-bold p-3 transition-colors duration-200 border-b-4 ${selectedRole === 'ALL' ? 'text-brand-primary border-brand-primary' : 'text-content-200 border-transparent hover:bg-base-300/50'}`}
                >
                    <span className="hidden sm:inline-block mr-2">★</span>Tutti
                </button>
                {ROLES_ORDER.map(role => <RoleTabButton key={role} role={role} />)}
            </div>

            {/* Board */}
            <div className="bg-base-100 rounded-b-lg overflow-y-auto max-h-[70vh]">
                 <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                        <thead className="border-b border-base-300 bg-base-200/80 backdrop-blur-sm sticky top-0">
                            <tr>
                                <th className="p-2 font-semibold text-content-200 w-2/5 cursor-pointer select-none" onClick={() => handleSort('name')}>
                                    Giocatore {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="p-2 font-semibold text-content-200 text-center">Ruolo</th>
                                <th className="p-2 font-semibold text-content-200 text-center cursor-pointer select-none" title="Costo Base" onClick={() => handleSort('baseCost')}>
                                    C. Base {sortBy === 'baseCost' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="p-2 font-semibold text-content-200 text-center cursor-pointer select-none" title="Offerta Massima Consigliata" onClick={() => handleSort('recommendedBid')}>
                                    Cons. {sortBy === 'recommendedBid' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="p-2 font-semibold text-content-200 text-center cursor-pointer select-none" title="Mio Max Bid" onClick={() => handleSort('maxBid')}>
                                    Mio Bid {sortBy === 'maxBid' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                                <th className="p-2 font-semibold text-content-200 text-center cursor-pointer select-none" title="Esito Asta" onClick={() => handleSort('result')}>
                                    Esito Asta {sortBy === 'result' && (sortDir === 'asc' ? '▲' : '▼')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300/50">
                            {sortedPlayers.map(player => {
                                // Robustly get result and isTaken
                                const result = getAuctionLogResult(player.id);
                                const isTaken = !!result;
                                const targetInfo = targetPlayersMap.get(player.id);
                                const scaleFactor = leagueSettings.budget / 500;
                                const baseCost = Math.round((player.baseCost ?? player.price ?? 0) * scaleFactor);
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
                                        <td className="p-2 text-center font-mono font-bold">{player.role}</td>
                                        <td className={`p-2 text-center font-mono ${isTaken ? 'line-through' : ''}`}>{baseCost}</td>
                                        <td className={`p-2 text-center font-mono ${isTaken ? 'line-through' : ''}`}>{recommendedBid}</td>
                                        <td className={`p-2 text-center font-mono font-bold ${isTaken ? 'line-through' : targetInfo ? 'text-brand-primary' : 'text-content-200'}`}> {targetInfo ? targetInfo.maxBid : '-'} </td>
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