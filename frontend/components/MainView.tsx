import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LeagueSettings, Player, Role, TargetPlayer } from '../types';
import { PlayerExplorerView } from './PreparationView';
import { TargetedSearchView } from './TargetedSearchView';
import { StrategyBoardView } from './StrategyBoardView';
import { Compass, Search, ClipboardList } from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { getStrategyBoard, saveStrategyBoard } from '../services/strategyBoardService';
import { getStrategyBoardBudget } from '../services/strategyBoardBudgetService';

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
    onSaveChanges: () => void;
    onResetChanges: () => void;
    isSaving: boolean;
}

export const MainView: React.FC<MainViewProps> = ({ 
    leagueSettings, 
    players, 
    roleBudget, 
    onRoleBudgetChange, 
    targetPlayers, 
    onAddTarget, 
    onRemoveTarget, 
    onTargetBidChange,
    onSaveChanges,
    onResetChanges,
    isSaving
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { idToken, isLoggedIn } = useAuth();
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [isSavingFavourites, setIsSavingFavourites] = useState(false);

  // Set initial activeView based on the current path
  const getViewFromPath = () => {
    if (location.pathname === '/search') return 'search';
    if (location.pathname === '/strategy') return 'strategy';
    return 'explorer';
  };
  const [activeView, setActiveView] = useState<ActiveView>(getViewFromPath());

  // Sync activeView with route changes
  useEffect(() => {
    setActiveView(getViewFromPath());
  }, [location.pathname]);

  const handleTabClick = (view: ActiveView) => {
    if (view === 'explorer') navigate('/preparation');
    else if (view === 'search') navigate('/search');
    else if (view === 'strategy') navigate('/strategy');
  };

  const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center justify-center w-full px-3 sm:px-4 py-2 sm:py-3 font-semibold text-base md:text-lg rounded-t-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary
        ${
          isActive
            ? 'bg-base-200 text-brand-primary'
            : 'bg-transparent text-content-200 hover:bg-base-300/50'
        }`}
    >
      <span className="block sm:hidden">{icon}</span>
      <span className="hidden sm:flex items-center">{icon}<span className="ml-2 md:ml-3">{label}</span></span>
    </button>
  );

  // Load targetPlayers from localStorage if available, otherwise from backend
  useEffect(() => {
    if (!isLoggedIn || !idToken) return;
    const saved = localStorage.getItem('fantacalcio_targetPlayers');
    let loadedFromLocal = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
          const validPlayers = parsed.filter((p: any) => players.some(pl => pl.id === p.id));
          validPlayers.forEach((p: any) => {
            if (!targetPlayers.some(tp => tp.id === p.id)) {
              onAddTarget(players.find(pl => pl.id === p.id)!);
            }
          });
          loadedFromLocal = true;
        }
      } catch {}
    }
    if (!loadedFromLocal) {
      (async () => {
        try {
          const board = await getStrategyBoard(idToken);
          if (board && board.target_players) {
            // board.target_players is an array of { id, max_bid }
            const validPlayers = board.target_players
              .map((p: any) => {
                const player = players.find(pl => pl.id === p.id);
                if (player) {
                  return { ...player, maxBid: p.max_bid };
                }
                return null;
              })
              .filter(Boolean);
            validPlayers.forEach((p: any) => {
              if (!targetPlayers.some(tp => tp.id === p.id)) {
                onAddTarget(p);
              }
            });
          }
        } catch (e) {
          // Ignore if not found or not logged in
        }
      })();
    }
    // eslint-disable-next-line
  }, [isLoggedIn, idToken]);

  // Save targetPlayers to localStorage on change
  useEffect(() => {
    localStorage.setItem('fantacalcio_targetPlayers', JSON.stringify(targetPlayers));
  }, [targetPlayers]);

  // Save favourites to API only when user clicks the button
  const handleSaveFavourites = async () => {
    if (!isLoggedIn || !idToken) return;
    setIsSavingFavourites(true);
    try {
      await saveStrategyBoard(idToken, targetPlayers);
    } finally {
      setIsSavingFavourites(false);
    }
  };

  // --- NEW: Load role budget and target players from backend on mount ---
  useEffect(() => {
    if (!isLoggedIn || !idToken) return;
    (async () => {
      // Load role budget
      try {
        const budgetResp = await getStrategyBoardBudget(idToken);
        if (budgetResp && budgetResp.role_budget_gk !== undefined) {
          onRoleBudgetChange({
            [Role.GK]: budgetResp.role_budget_gk,
            [Role.DEF]: budgetResp.role_budget_def,
            [Role.MID]: budgetResp.role_budget_mid,
            [Role.FWD]: budgetResp.role_budget_fwd,
          });
        }
      } catch {}
      // Load target players
      try {
        const board = await getStrategyBoard(idToken);
        if (board && board.target_players) {
          const validPlayers = board.target_players
            .map((p: any) => {
              const player = players.find(pl => pl.id === p.id);
              if (player) {
                return { ...player, maxBid: p.max_bid };
              }
              return null;
            })
            .filter(Boolean);
          // Remove all current targets first
          targetPlayers.forEach(tp => onRemoveTarget(tp.id));
          // Deduplicate loaded players by id
          const uniquePlayers = [];
          const seenIds = new Set();
          for (const p of validPlayers) {
            if (!seenIds.has(p.id)) {
              uniquePlayers.push(p);
              seenIds.add(p.id);
            }
          }
          uniquePlayers.forEach((p: any) => {
            onAddTarget(p);
          });
        }
      } catch {}
    })();
    // eslint-disable-next-line
  }, [isLoggedIn, idToken]);

  // Deduplicate targetPlayers by id before rendering
  const dedupedTargetPlayers = React.useMemo(() => {
    const seen = new Set();
    return targetPlayers.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [targetPlayers]);

  return (
    <div className="min-h-screen bg-base-100">
      {/* Sticky header with horizontal scroll for tab bar on mobile */}
  <div className="border-b border-base-300 mb-4 sticky top-0 z-20 bg-base-100/95 backdrop-blur-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0 px-2 sm:px-0 py-2">
          <button
            onClick={() => navigate('/setup')}
            className="mb-1 sm:mb-0 sm:mr-4 px-2 py-1 text-xs sm:text-sm font-semibold text-content-200 bg-base-200 rounded-md hover:bg-base-300"
          >
            ← Setup
          </button>
          {/* Tab bar: horizontal scroll on mobile, row on desktop */}
          <div className="flex flex-row sm:flex-row flex-1 items-stretch sm:items-center overflow-x-auto scrollbar-hide gap-1 sm:gap-0">
            <TabButton
              label="Esplora Giocatori"
              icon={<Compass className="w-5 h-5 md:w-6 md:h-6" />} 
              isActive={activeView === 'explorer'}
              onClick={() => handleTabClick('explorer')}
            />
            <TabButton
              label="Tavolo Strategia"
              icon={<ClipboardList className="w-5 h-5 md:w-6 md:h-6" />} 
              isActive={activeView === 'strategy'}
              onClick={() => handleTabClick('strategy')}
            />
            <TabButton
              label="Ricerca Mirata"
              icon={<Search className="w-5 h-5 md:w-6 md:h-6" />} 
              isActive={activeView === 'search'}
              onClick={() => handleTabClick('search')}
            />
          </div>
        </div>
      </div>

      {/* Main content area, padding for mobile */}
      <div className="px-1 sm:px-0">
        {activeView === 'explorer' && (
          <PlayerExplorerView 
            leagueSettings={leagueSettings} 
            players={players} 
            targetPlayers={dedupedTargetPlayers}
            onAddTarget={onAddTarget}
            onRemoveTarget={onRemoveTarget}
            showFavouritesOnly={showFavouritesOnly}
            setShowFavouritesOnly={setShowFavouritesOnly}
            onSaveFavourites={handleSaveFavourites}
            isSavingFavourites={isSavingFavourites}
          />
        )}
        {activeView === 'search' && <TargetedSearchView players={players} />}
        {activeView === 'strategy' && (
          <StrategyBoardView 
            players={players} 
            leagueSettings={leagueSettings} 
            roleBudget={roleBudget}
            onRoleBudgetChange={onRoleBudgetChange}
            targetPlayers={dedupedTargetPlayers}
            onAddTarget={onAddTarget}
            onRemoveTarget={onRemoveTarget}
            onBidChange={onTargetBidChange}
            onSaveChanges={onSaveChanges}
            onResetChanges={onResetChanges}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
};
