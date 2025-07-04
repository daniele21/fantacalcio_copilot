import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { SetupWizard } from './components/SetupWizard';
import { MainView } from './components/MainView';
import { LiveAuctionView } from './components/LiveAuctionView';
import { usePlayerApi } from './services/playerService';
import { loadStrategy, saveStrategy, clearStrategy } from './services/strategyService';
import { useAuth } from './services/AuthContext';
import { DEFAULT_LEAGUE_SETTINGS } from './defaults';
import { LeagueSettings, Player, MyTeamPlayer, AuctionResult, Role, TargetPlayer } from './types';
import { ShieldCheck, LogOut, Loader2 } from 'lucide-react';
import { UpgradeView } from './components/UpgradeView';
import { FeatureGuard } from './components/FeatureGuard';
import { SuccessPage } from './components/SuccessPage';
import { AIGenerativeBadge } from './components/shared/AIGenerativeBadge';

// Helper to map feature keys to user-friendly names
const FEATURE_LABELS: Record<string, string> = {
  liveAuction: 'Assistente Live',
  strategyPrep: 'Strategia',
  leagueAnalytics: 'Analisi Lega',
};

const App: React.FC = () => {
    const { isLoggedIn, idToken, profile, handleSignOut, isGoogleAuthReady } = useAuth();
    const { fetchPlayers } = usePlayerApi();
    const [view, setView] = useState<'home' | 'app'>('home');

    const [leagueSettings, setLeagueSettings] = useState<LeagueSettings>(DEFAULT_LEAGUE_SETTINGS);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [targetPlayers, setTargetPlayers] = useState<TargetPlayer[]>([]);
    const [roleBudget, setRoleBudget] = useState<Record<Role, number>>({ [Role.GK]: 10, [Role.DEF]: 20, [Role.MID]: 35, [Role.FWD]: 35 });
    
    // Live Auction State
    const [myTeam, setMyTeam] = useState<MyTeamPlayer[]>([]);
    const [auctionLog, setAuctionLog] = useState<Record<number, AuctionResult>>({});
    
    const [isSaving, setIsSaving] = useState(false);
    const [userPlan, setUserPlan] = useState<string | null>(null);

    const googleSignInRef = useRef<HTMLDivElement>(null);

    // Effect to set view based on login state
    useEffect(() => {
        if (isLoggedIn) {
            setView('app');
        } else {
            setView('home');
        }
    }, [isLoggedIn]);

    // Initial data loading (players and saved strategy)
    useEffect(() => {
        if (!isLoggedIn || view !== 'app') {
            setIsLoading(false);
            return;
        }

        const loadInitialData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedPlayers = await fetchPlayers();
                // console.log('[App.tsx] fetchedPlayers:', fetchedPlayers);
                setPlayers(fetchedPlayers);

                if (idToken) {
                    const savedStrategy = await loadStrategy(idToken);
                    if (savedStrategy) {
                        setRoleBudget(savedStrategy.roleBudget);
                        const savedTargets: TargetPlayer[] = savedStrategy.targetPlayerIds
                            .map(savedTarget => {
                                const player = fetchedPlayers.find((p: Player) => p.id === savedTarget.id);
                                return player ? { ...player, maxBid: savedTarget.maxBid } : null;
                            })
                            .filter((p): p is TargetPlayer => p !== null);
                        setTargetPlayers(savedTargets);
                    }
                }
            } catch (err: any) {
                setError('Failed to load initial application data.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, [isLoggedIn, idToken, view]);
    
    const handleLogin = (plan?: string) => {
        setView('app');
        if (plan) setUserPlan(plan);
    };
    
    const handleGoHome = () => {
        const homeUrl = new URL(window.location.href);
        homeUrl.hash = '#pricing';
        window.location.href = homeUrl.toString();
        setView('home');
    }

    const handleSetupConfirm = (settings: Pick<LeagueSettings, 'participants' | 'budget' | 'participantNames' | 'roster' | 'useCleanSheetBonus' | 'useDefensiveModifier'>) => {
        setLeagueSettings(prev => ({ ...prev, ...settings }));
        setView('app');
    };
    
    // Target Player Handlers
    const handleAddTarget = useCallback((player: Player | TargetPlayer) => {
        setTargetPlayers(prev => [
            ...prev,
            { ...player, maxBid: (player as TargetPlayer).maxBid ?? 1 }
        ]);
    }, []);

    const handleRemoveTarget = useCallback((playerId: number) => {
        setTargetPlayers(prev => prev.filter(p => p.id !== playerId));
    }, []);

    const handleTargetBidChange = useCallback((playerId: number, newBid: number) => {
        setTargetPlayers(prev => prev.map(p => p.id === playerId ? { ...p, maxBid: newBid } : p));
    }, []);

    // Live Auction Handlers
    const handlePlayerAuctioned = (player: Player, purchasePrice: number, buyer: string) => {
        const newAuctionResult = { playerId: player.id, purchasePrice, buyer };
        setAuctionLog(prev => ({ ...prev, [player.id]: newAuctionResult }));
        if (buyer.toLowerCase() === 'io') {
            setMyTeam(prev => [...prev, { ...player, purchasePrice }]);
        }
    };
    
    const handleUpdateAuctionResult = (playerId: number, newPrice: number) => {
        setAuctionLog(prev => {
            const updatedLog = { ...prev };
            if(updatedLog[playerId]) {
                updatedLog[playerId].purchasePrice = newPrice;
            }
            return updatedLog;
        });

        setMyTeam(prev => {
            return prev.map(p => {
                if(p.id === playerId) {
                    return { ...p, purchasePrice: newPrice };
                }
                return p;
            });
        });
    };

    // Strategy Save/Reset Handlers
    const handleSaveChanges = async () => {
        if (!idToken) {
            alert("Devi essere loggato per salvare la strategia.");
            return;
        }
        setIsSaving(true);
        try {
            await saveStrategy(roleBudget, targetPlayers, idToken);
            alert("Strategia salvata con successo!");
        } catch (error) {
            alert("Errore nel salvataggio della strategia. Riprova più tardi.");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetChanges = async () => {
        if (confirm('Sei sicuro di voler resettare la strategia? Tutti gli obiettivi e i budget personalizzati saranno persi.')) {
            // Reset state
            setRoleBudget({ [Role.GK]: 10, [Role.DEF]: 20, [Role.MID]: 35, [Role.FWD]: 35 });
            setTargetPlayers([]);
            
            // Clear from backend
            if(idToken) {
                try {
                    await clearStrategy(idToken);
                    alert('Strategia resettata e rimossa dal server.');
                } catch(error) {
                    alert('Errore nella rimozione della strategia salvata.');
                    console.error(error);
                }
            } else {
                 alert('Strategia resettata.');
            }
        }
    };

    // Google Sign-In button effect
    useEffect(() => {
        if (!isLoggedIn && isGoogleAuthReady && googleSignInRef.current) {
            if (googleSignInRef.current.childNodes.length === 0 && window.google && window.google.accounts && window.google.accounts.id) {
                try {
                    window.google.accounts.id.renderButton(googleSignInRef.current, {
                        theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', width: '220px'
                    });
                    googleSignInRef.current.setAttribute('data-gsi-button', 'true');
                } catch (err) {
                    console.error('[App] Error rendering Google Sign-In button:', err);
                }
            }
        }
    }, [isLoggedIn, isGoogleAuthReady]);

    // Keep userPlan in sync with profile.plan
    useEffect(() => {
        if (profile && profile.plan) {
            setUserPlan(profile.plan);
            console.log('[App] Sync userPlan with profile.plan:', profile.plan);
        }
    }, [profile]);

    return (
        <BrowserRouter>
            <div>
                {/* Header - always visible */}
                <header className="bg-base-100 shadow-sm sticky top-0 z-40">
                  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-7 h-7 text-brand-primary" />
                      <span className="font-extrabold text-xl tracking-tight text-content-100">FantaCopilot</span>
                    <div className="text-brand-primary text-lg font-semibold tracking-wide text-center md:text-center">
                        La tua asta, potenziata dall’<strong>AI</strong>
                    </div>
                      <AIGenerativeBadge className="ml-2" />
                    </div>
                    <div className="flex items-center gap-4">
                       {profile && (
                            <div className="flex items-center gap-3">
                                <img src={profile.picture} alt={profile.name} className="w-8 h-8 rounded-full"/>
                                <div className="hidden sm:block">
                                    <p className="text-sm font-semibold">{profile.name}</p>
                                    <p className="text-xs text-content-200 capitalize">{profile.plan || 'Free'} Plan</p>
                                </div>
                            </div>
                       )}
                       {/* Show Google Sign-In badge if not logged in */}
                       {!isLoggedIn && (
                           <div ref={googleSignInRef}></div>
                       )}
                       {/* Settings and logout only if logged in */}
                       {isLoggedIn && (
                         <>
                           <button onClick={() => { handleSignOut(); window.location.reload(); }} className="px-3 py-1.5 text-sm font-semibold text-content-200 bg-base-200 rounded-md hover:bg-base-300">
                               <LogOut className="w-4 h-4"/>
                           </button>
                         </>
                       )}
                    </div>
                  </div>
                </header>
                <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Loading and error states */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-screen bg-base-100 text-content-100">
                            <Loader2 className="w-12 h-12 animate-spin text-brand-primary mb-4" />
                            <p className="text-lg">Caricamento dati e strategia...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-500 py-20">{error}</div>
                    ) : !isLoggedIn || !profile ? (
                        <HomePage onLogin={handleLogin} userPlan={userPlan} setUserPlan={setUserPlan}/>
                    ) : (
                        <Routes>
                            <Route path="/" element={<HomePage onLogin={handleLogin} userPlan={userPlan} setUserPlan={setUserPlan}/>} />
                            <Route path="/success" element={<SuccessPage />} />
                            <Route path="/setup" element={<SetupWizard onConfirm={handleSetupConfirm} initialSettings={leagueSettings} />} />
                            <Route path="/preparation" element={
                                <FeatureGuard feature="strategyPrep" fallback={<UpgradeView featureName={FEATURE_LABELS['strategyPrep']} onNavigateHome={handleGoHome} />}>
                                    <MainView
                                        leagueSettings={leagueSettings}
                                        players={players}
                                        roleBudget={roleBudget}
                                        onRoleBudgetChange={setRoleBudget}
                                        targetPlayers={targetPlayers}
                                        onAddTarget={handleAddTarget}
                                        onRemoveTarget={handleRemoveTarget}
                                        onTargetBidChange={handleTargetBidChange}
                                        onSaveChanges={handleSaveChanges}
                                        onResetChanges={handleResetChanges}
                                        isSaving={isSaving}
                                    />
                                </FeatureGuard>
                            } />
                            <Route path="/search" element={
                                <FeatureGuard feature="strategyPrep" fallback={<UpgradeView featureName={FEATURE_LABELS['strategyPrep']} onNavigateHome={handleGoHome} />}>
                                    <MainView
                                        leagueSettings={leagueSettings}
                                        players={players}
                                        roleBudget={roleBudget}
                                        onRoleBudgetChange={setRoleBudget}
                                        targetPlayers={targetPlayers}
                                        onAddTarget={handleAddTarget}
                                        onRemoveTarget={handleRemoveTarget}
                                        onTargetBidChange={handleTargetBidChange}
                                        onSaveChanges={handleSaveChanges}
                                        onResetChanges={handleResetChanges}
                                        isSaving={isSaving}
                                    />
                                </FeatureGuard>
                            } />
                            <Route path="/strategy" element={
                                <FeatureGuard feature="strategyPrep" fallback={<UpgradeView featureName={FEATURE_LABELS['strategyPrep']} onNavigateHome={handleGoHome} />}>
                                    <MainView
                                        leagueSettings={leagueSettings}
                                        players={players}
                                        roleBudget={roleBudget}
                                        onRoleBudgetChange={setRoleBudget}
                                        targetPlayers={targetPlayers}
                                        onAddTarget={handleAddTarget}
                                        onRemoveTarget={handleRemoveTarget}
                                        onTargetBidChange={handleTargetBidChange}
                                        onSaveChanges={handleSaveChanges}
                                        onResetChanges={handleResetChanges}
                                        isSaving={isSaving}
                                    />
                                </FeatureGuard>
                            } />
                            <Route path="/auction" element={
                                <FeatureGuard feature="liveAuction" fallback={<UpgradeView featureName={FEATURE_LABELS['liveAuction']} onNavigateHome={handleGoHome} />}>
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
                                </FeatureGuard>
                            } />
                            {/* <Route path="/upgrade" element={<UpgradeView featureName={FEATURE_LABELS['strategyPrep']} onNavigateHome={handleGoHome} />} /> */}
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    )}
                </main>
            </div>
        </BrowserRouter>
    );
};

export default App;
