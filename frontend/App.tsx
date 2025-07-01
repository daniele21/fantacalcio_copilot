import React, { useState, useEffect } from 'react';
import { LeagueSettings, Player, AppMode, MyTeamPlayer, Role, AuctionResult, TargetPlayer } from './types';
import { ShieldCheck, Users, Settings, Loader, Frown, LogOut, Coins } from 'lucide-react';
import { SetupWizard } from './components/SetupWizard';
import { MainView } from './components/MainView';
import { LiveAuctionView } from './components/LiveAuctionView';
import { ModeSwitcher } from './components/ModeSwitcher';
import { fetchPlayers } from './services/playerService';
import { DEFAULT_LEAGUE_SETTINGS } from './defaults';
import { HomePage } from './components/HomePage';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'app'>('landing');

  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings>(DEFAULT_LEAGUE_SETTINGS);
  const [isWizardOpen, setIsWizardOpen] = useState(true);
  const [appMode, setAppMode] = useState<AppMode>('preparation');
  const [myTeam, setMyTeam] = useState<MyTeamPlayer[]>([]);
  const [auctionLog, setAuctionLog] = useState<Record<number, AuctionResult>>({});
  const [targetPlayers, setTargetPlayers] = useState<TargetPlayer[]>([]);
  const [roleBudget, setRoleBudget] = useState<Record<Role, number>>({
    [Role.GK]: 8,
    [Role.DEF]: 22,
    [Role.MID]: 35,
    [Role.FWD]: 35,
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState<boolean>(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        setIsLoadingPlayers(true);
        setPlayerError(null);
        const fetchedPlayers = await fetchPlayers();
        setPlayers(fetchedPlayers);
      } catch (e: any) {
        setPlayerError(e.message || 'Impossibile caricare la lista di giocatori.');
        console.error(e);
      } finally {
        setIsLoadingPlayers(false);
      }
    };

    if (view === 'app' && !isWizardOpen) {
        loadPlayers();
    }
  }, [isWizardOpen, view]);

  const handleLogin = (plan?: string) => {
    setView('app');
    if (plan) setUserPlan(plan);
  };

  const handleLogout = () => {
    setView('landing');
    // Reset state for a clean login next time
    setIsWizardOpen(true);
    setLeagueSettings(DEFAULT_LEAGUE_SETTINGS);
    setAppMode('preparation');
    setMyTeam([]);
    setAuctionLog({});
    setTargetPlayers([]);
    setRoleBudget({
      [Role.GK]: 8,
      [Role.DEF]: 22,
      [Role.MID]: 35,
      [Role.FWD]: 35,
    });
    setPlayers([]);
    setPlayerError(null);
  };

  const handlePlayerAuctioned = (player: Player, purchasePrice: number, buyer: string) => {
    setAuctionLog(prev => ({
        ...prev,
        [player.id]: { purchasePrice, buyer }
    }));

    if (buyer.trim().toLowerCase() === 'io') {
        const newPlayer: MyTeamPlayer = { ...player, purchasePrice };
        if (!myTeam.some(p => p.id === newPlayer.id)) {
            setMyTeam(prev => [...prev, newPlayer]);
        }
    }
  };

  const handleUpdateAuctionResult = (playerId: number, newPrice: number) => {
    // Update auctionLog
    setAuctionLog(prev => {
        if (prev[playerId]) {
            return {
                ...prev,
                [playerId]: { ...prev[playerId], purchasePrice: newPrice }
            };
        }
        return prev;
    });

    // If player is in myTeam, update myTeam as well
    setMyTeam(prev => {
        const playerIndex = prev.findIndex(p => p.id === playerId);
        if (playerIndex > -1) {
            const updatedTeam = [...prev];
            updatedTeam[playerIndex].purchasePrice = newPrice;
            return updatedTeam;
        }
        return prev;
    });
  };

  const handleWizardConfirm = (settings: Pick<LeagueSettings, 'participants' | 'budget' | 'participantNames' | 'roster' | 'useCleanSheetBonus' | 'useDefensiveModifier'>, mode: AppMode) => {
    setLeagueSettings(prev => ({
      ...prev,
      ...settings,
    }));
    setAppMode(mode);
    setIsWizardOpen(false);
  };

  const handleAddTarget = (player: Player) => {
    const scaleFactor = leagueSettings.budget / 500;
    const maxSpend = Math.round((player.baseCost * scaleFactor) * 1.15);
    const newTarget: TargetPlayer = { ...player, maxBid: maxSpend };

    setTargetPlayers(prev => {
        if (prev.some(p => p.id === newTarget.id)) return prev;
        return [...prev, newTarget].sort((a, b) => b.maxBid - a.maxBid)
    });
  };

  const handleRemoveTarget = (playerId: number) => {
    setTargetPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleTargetBidChange = (playerId: number, newBid: number) => {
    setTargetPlayers(prev => prev.map(p => p.id === playerId ? { ...p, maxBid: newBid } : p));
  };
  
  // Only allow 'preparation' mode for basic; pro/enterprise can use both modes
  const isBasic = userPlan === 'basic';
  const isProOrEnterprise = userPlan === 'pro' || userPlan === 'enterprise';

  // If user is basic and appMode is 'live_auction', force to 'preparation'
  useEffect(() => {
    if (isBasic && appMode === 'live_auction') {
      setAppMode('preparation');
    }
  }, [userPlan, appMode]);

  // If user is pro/enterprise and appMode is not allowed, default to 'live_auction'
  useEffect(() => {
    if (isProOrEnterprise && appMode === 'preparation') {
      // pro/enterprise can use both, so do nothing
      // (if you want to default to live_auction on login, you can set here)
    }
  }, [userPlan, appMode]);

  if (view === 'landing') {
    return <HomePage onLogin={handleLogin} userPlan={userPlan} setUserPlan={setUserPlan} />;
  }

  if (isWizardOpen) {
      return <SetupWizard 
        onConfirm={handleWizardConfirm} 
        initialSettings={{ 
            participants: leagueSettings.participants,
            budget: leagueSettings.budget,
            participantNames: leagueSettings.participantNames,
            roster: leagueSettings.roster,
            useCleanSheetBonus: leagueSettings.useCleanSheetBonus,
            useDefensiveModifier: leagueSettings.useDefensiveModifier,
        }} 
      />;
  }

  const renderContent = () => {
    console.debug('userPlan:', userPlan, 'isBasic:', isBasic, 'appMode:', appMode);
    // For basic users, only show preparation mode
    if (isBasic) {
      if (appMode !== 'preparation') {
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            alert('La modalità Asta Live è disponibile solo per utenti Pro o Enterprise.');
          }, 0);
        }
        setAppMode('preparation');
        return null;
      }
      return (
        <MainView 
          leagueSettings={leagueSettings} 
          players={players} 
          roleBudget={roleBudget}
          onRoleBudgetChange={setRoleBudget}
          targetPlayers={targetPlayers}
          onAddTarget={handleAddTarget}
          onRemoveTarget={handleRemoveTarget}
          onTargetBidChange={handleTargetBidChange}
        />
      );
    }
    // For pro/enterprise, allow both modes
    switch (appMode) {
      case 'preparation':
        return (
          <MainView 
            leagueSettings={leagueSettings} 
            players={players} 
            roleBudget={roleBudget}
            onRoleBudgetChange={setRoleBudget}
            targetPlayers={targetPlayers}
            onAddTarget={handleAddTarget}
            onRemoveTarget={handleRemoveTarget}
            onTargetBidChange={handleTargetBidChange}
          />
        );
      case 'live_auction':
        return (
          <LiveAuctionView
            players={players}
            myTeam={myTeam}
            auctionLog={auctionLog}
            onPlayerAuctioned={handlePlayerAuctioned}
            leagueSettings={leagueSettings}
            roleBudget={roleBudget}
            targetPlayers={targetPlayers}
            onUpdateAuctionResult={handleUpdateAuctionResult}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-base-100 font-sans">
      <header className="bg-base-200/50 backdrop-blur-lg sticky top-0 z-30 border-b border-base-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-8 h-8 text-brand-primary" />
              <h1 className="text-2xl font-bold text-content-100 tracking-tight">
                Fantacalcio <span className="text-brand-primary">Copilot</span>
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="hidden sm:flex items-center space-x-2 text-sm text-content-200">
                    <Users className="w-4 h-4 text-brand-primary"/>
                    <span>{leagueSettings.participants} Partecipanti</span>
                </div>
                <div className="hidden lg:flex items-center space-x-2 text-sm text-content-200">
                    <Coins className="w-4 h-4 text-brand-primary"/>
                    <span className="font-semibold">
                        {leagueSettings.budget} Cr
                    </span>
                </div>
                 <button 
                    onClick={() => setIsWizardOpen(true)}
                    className="p-2 rounded-full text-content-200 hover:text-content-100 hover:bg-base-300 transition-colors"
                    aria-label="Modifica impostazioni lega"
                 >
                    <Settings className="w-5 h-5" />
                </button>
                <button 
                    onClick={handleLogout}
                    className="flex items-center space-x-1.5 text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-lg transition-colors"
                    aria-label="Esci"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Esci</span>
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6">
        {isLoadingPlayers ? (
            <div className="flex flex-col justify-center items-center h-96">
                <Loader className="w-12 h-12 animate-spin text-brand-primary" />
                <p className="ml-4 text-xl mt-4">Caricamento lista giocatori...</p>
            </div>
        ) : playerError ? (
            <div className="flex flex-col justify-center items-center h-96 text-red-400">
                <Frown className="w-16 h-16 mb-4" />
                <p className="text-2xl">Errore nel caricamento dei giocatori</p>
                <p className="text-content-200 text-center max-w-md">{playerError}</p>
            </div>
        ) : (
            <>
              <ModeSwitcher currentMode={appMode} onModeChange={setAppMode} />
              {renderContent()}
            </>
        )}
      </main>
      
      <footer className="text-center py-6 mt-8 border-t border-base-300 text-sm text-content-200/50">
        <p>Fantacalcio Copilot AI &copy; {new Date().getFullYear()}. Realizzato con passione per i fantallenatori.</p>
      </footer>
    </div>
  );
};

export default App;
