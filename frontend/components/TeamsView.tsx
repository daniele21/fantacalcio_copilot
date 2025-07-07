import React, { useMemo, useState } from 'react';
import { AuctionResult, Player, LeagueSettings, MyTeamPlayer, Role } from '../types';
import { ROLES_ORDER, ROLE_NAMES } from '../constants';
import { Users, Wallet, Trophy, Edit, Coins, X } from 'lucide-react';


interface TeamData {
    name: string;
    players: MyTeamPlayer[];
    totalSpent: number;
    remainingBudget: number;
}

interface TeamsViewProps {
    auctionLog: Record<number, AuctionResult>;
    players: Player[];
    leagueSettings: LeagueSettings;
    onUpdateAuctionResult: (playerId: number, newPrice: number) => void;
    onAuctionLogChange: (newAuctionLog: Record<number, AuctionResult>) => void;
}

interface EditPriceModalProps {
    player: MyTeamPlayer;
    participantNames: string[];
    onSave: (newPrice: number, newOwner: string) => void;
    onRemove: () => void;
    onClose: () => void;
}

const EditPriceModal: React.FC<EditPriceModalProps> = ({ player, participantNames, onSave, onRemove, onClose }) => {
    const [price, setPrice] = useState<number | ''>(player.purchasePrice);
    const [owner, setOwner] = useState<string>(player.buyer || participantNames[0]);

    const handleSave = () => {
        if (typeof price === 'number' && price > 0 && owner) {
            onSave(price, owner);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-base-200 w-full max-w-md rounded-2xl shadow-2xl border border-base-300/50 p-6 transform transition-all animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-content-100">Modifica Giocatore</h2>
                    <button onClick={onClose} className="p-2 text-content-200 hover:text-content-100 rounded-full hover:bg-base-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="mb-4">
                    <p className="text-lg font-semibold">{player.name}</p>
                    <p className="text-sm text-content-200">{player.team} - {player.role}</p>
                </div>
                <div className="mb-4">
                    <label htmlFor="edit_owner" className="flex items-center text-sm font-medium text-content-200 mb-2">
                        <Users className="w-4 h-4 mr-2" />
                        Proprietario
                    </label>
                    <select
                        id="edit_owner"
                        value={owner}
                        onChange={e => setOwner(e.target.value)}
                        className="w-full bg-base-100 border border-base-300 rounded-lg px-4 py-2 text-base font-bold text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition mb-2"
                    >
                        {participantNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                <div className="mb-4">
                    <label htmlFor="edit_price" className="flex items-center text-sm font-medium text-content-200 mb-2">
                        <Coins className="w-4 h-4 mr-2" />
                        Nuovo Prezzo di Acquisto
                    </label>
                    <input
                        type="number"
                        id="edit_price"
                        value={price}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                                setPrice('');
                            } else {
                                const num = parseInt(val, 10);
                                if (!isNaN(num) && num >= 0) {
                                    setPrice(num);
                                }
                            }
                        }}
                        className="w-full bg-base-100 border border-base-300 rounded-lg px-4 py-3 text-2xl font-bold text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition"
                        autoFocus
                    />
                </div>
                <div className="mt-6 flex flex-wrap justify-between gap-2">
                    <button onClick={onRemove} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                        Rimuovi Giocatore
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-content-100 hover:bg-base-300 transition-colors">
                            Annulla
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={typeof price !== 'number' || price <= 0 || !owner}
                            className="px-6 py-2 rounded-lg bg-brand-primary text-white font-semibold hover:bg-brand-secondary transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Salva
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

const TeamCard: React.FC<{ teamData: TeamData, leagueSettings: LeagueSettings, onPlayerEdit: (player: MyTeamPlayer) => void }> = ({ teamData, leagueSettings, onPlayerEdit }) => {
    const isMyTeam = teamData.name.trim().toLowerCase() === 'io';
    const totalSlots = Object.values(leagueSettings.roster).reduce((sum, count) => sum + count, 0);

    const playersByRole = useMemo(() => {
        const grouped: Record<Role, MyTeamPlayer[]> = {
            [Role.GK]: [],
            [Role.DEF]: [],
            [Role.MID]: [],
            [Role.FWD]: [],
        };
        for (const player of teamData.players) {
            grouped[player.role].push(player);
        }
        return grouped;
    }, [teamData.players]);

    return (
        <div className={`bg-base-200 rounded-lg shadow-lg border-2 ${isMyTeam ? 'border-brand-primary' : 'border-base-300'} flex flex-col`}>
            <div className="p-4 border-b border-base-300">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-content-100 flex items-center">
                       {isMyTeam && <Trophy className="w-6 h-6 mr-2 text-yellow-400" />}
                       {teamData.name}
                    </h3>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                        <p className="text-content-200">Giocatori</p>
                        <p className="font-bold text-content-100 text-base">{teamData.players.length} / {totalSlots}</p>
                    </div>
                    <div>
                        <p className="text-content-200">Spesi</p>
                        <p className="font-bold text-red-400 text-base">{teamData.totalSpent} Cr</p>
                    </div>
                    <div>
                        <p className="text-content-200">Rimanenti</p>
                        <p className="font-bold text-green-400 text-base">{teamData.remainingBudget} Cr</p>
                    </div>
                </div>
            </div>
            <div className="p-4 flex-grow overflow-y-auto space-y-4 min-h-[200px] max-h-[400px]">
                 {teamData.players.length > 0 ? (
                    ROLES_ORDER.map(role => {
                        const rolePlayers = playersByRole[role];
                        if (rolePlayers.length === 0) return null;

                        return (
                            <div key={role}>
                                <h4 className="font-bold text-sm text-brand-primary pb-1 border-b-2 border-brand-primary/20 mb-2">
                                    {ROLE_NAMES[role]} ({rolePlayers.length})
                                </h4>
                                <div className="space-y-1">
                                    {rolePlayers.map(player => (
                                        <div key={player.id} className="group flex justify-between items-center bg-base-100 p-2 rounded-md text-sm">
                                            <div>
                                                <p className="font-bold text-content-100">{player.name}</p>
                                                <p className="text-xs text-content-200">{player.team}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold bg-brand-primary/20 text-brand-primary px-2 py-1 rounded">
                                                    {player.purchasePrice}
                                                </span>
                                                <button
                                                    onClick={() => onPlayerEdit(player)}
                                                    className="p-1 rounded-full text-content-200 opacity-0 group-hover:opacity-100 hover:bg-base-300 hover:text-content-100 transition-all duration-200 focus:opacity-100"
                                                    aria-label={`Modifica prezzo per ${player.name}`}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                 ) : (
                    <div className="flex items-center justify-center h-full text-content-200 text-sm">
                        Nessun giocatore acquistato.
                    </div>
                )}
            </div>
        </div>
    );
};

export const TeamsView: React.FC<TeamsViewProps> = ({ auctionLog, players, leagueSettings, onUpdateAuctionResult, onAuctionLogChange }) => {
    const [editingPlayer, setEditingPlayer] = useState<MyTeamPlayer | null>(null);
    const [editModalOwner, setEditModalOwner] = useState<string | null>(null);

    const teamsData = useMemo(() => {
        const teamNames = leagueSettings.participantNames;
        const allPlayersMap = new Map(players.map(p => [p.id, p]));
        const teamsMap = new Map<string, TeamData>();
        teamNames.forEach(name => {
            teamsMap.set(name, {
                name,
                players: [],
                totalSpent: 0,
                remainingBudget: leagueSettings.budget,
            });
        });
        Object.entries(auctionLog).forEach(([playerId, result]) => {
            const player = players.find(p => String(p.id) === String(result.playerId));
            const team = teamsMap.get(result.buyer);
            if (player && team) {
                const teamPlayer: MyTeamPlayer = {
                    ...player,
                    purchasePrice: result.purchasePrice,
                    buyer: result.buyer,
                };
                team.players.push(teamPlayer);
            }
        });
        teamsMap.forEach(teamData => {
            teamData.totalSpent = teamData.players.reduce((sum, p) => sum + p.purchasePrice, 0);
            teamData.remainingBudget = leagueSettings.budget - teamData.totalSpent;
            teamData.players.sort((a, b) => {
                const roleComparison = ROLES_ORDER.indexOf(a.role) - ROLES_ORDER.indexOf(b.role);
                if (roleComparison !== 0) return roleComparison;
                return b.purchasePrice - a.purchasePrice;
            });
        });
        return Array.from(teamsMap.values()).sort((a, b) => {
            if (a.name.toLowerCase() === 'io') return -1;
            if (b.name.toLowerCase() === 'io') return 1;
            return a.name.localeCompare(b.name);
        });
    }, [auctionLog, players, leagueSettings]);

    const handleEditClick = (player: MyTeamPlayer) => {
        setEditingPlayer(player);
        setEditModalOwner(player.buyer || leagueSettings.participantNames[0]);
    };

    const handleModalSave = (newPrice: number, newOwner: string) => {
        if (editingPlayer) {
            const updated = { ...auctionLog };
            updated[editingPlayer.id] = {
                playerId: editingPlayer.id,
                purchasePrice: newPrice,
                buyer: newOwner,
            };
            onAuctionLogChange(updated);
            onUpdateAuctionResult(editingPlayer.id, newPrice); // parent can sync
        }
        setEditingPlayer(null);
        setEditModalOwner(null);
    };

    const handleModalRemove = () => {
        if (editingPlayer) {
            const updated = { ...auctionLog };
            delete updated[editingPlayer.id];
            onAuctionLogChange(updated);
        }
        setEditingPlayer(null);
        setEditModalOwner(null);
    };

    const handleModalClose = () => {
        setEditingPlayer(null);
        setEditModalOwner(null);
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {teamsData.map(teamData => (
                    <TeamCard key={teamData.name} teamData={teamData} leagueSettings={leagueSettings} onPlayerEdit={handleEditClick} />
                ))}
            </div>
            {editingPlayer && (
                <EditPriceModal 
                    player={editingPlayer}
                    participantNames={leagueSettings.participantNames}
                    onSave={handleModalSave}
                    onRemove={handleModalRemove}
                    onClose={handleModalClose}
                />
            )}
        </>
    );
};