import React from 'react';
import { ShieldCheck, BarChart2, Zap, ClipboardList, ArrowRight } from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { SuccessPage } from './SuccessPage';
import { useApi } from '../services/useApi';
import { useNavigate } from 'react-router-dom';

const plans = [
  { key: 'basic',      name: 'Basic',      price: '€9.99' },
  { key: 'pro',        name: 'Pro',        price: '€19.99' },
  { key: 'enterprise', name: 'Enterprise', price: '€49.99' },
];

// Plan order for upgrade logic
const planOrder = ['free', 'basic', 'pro', 'enterprise'];

// @ts-ignore
// eslint-disable-next-line
declare global {
  interface Window {
    google?: any;
  }
}
interface HomePageProps {
    onLogin: (plan?: string) => void;
    userPlan: string | null;
    setUserPlan: (plan: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onLogin, userPlan, setUserPlan }) => {
    const { isLoggedIn, profile, isGoogleAuthReady, refreshProfile } = useAuth();
    const { call } = useApi();
    const navigate = useNavigate();
    const [showSuccess, setShowSuccess] = React.useState<boolean>(false);
    const [showFallbackLogin, setShowFallbackLogin] = React.useState<boolean>(false);

    React.useEffect(() => {
        // Listen for profile:refresh event to trigger context reload if needed
        const handler = () => {
            // This will be handled in AuthContext if you wire it up
        };
        window.addEventListener('profile:refresh', handler);
        return () => window.removeEventListener('profile:refresh', handler);
    }, []);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('session_id')) {
            setShowSuccess(true);
        }
    }, [isLoggedIn, isGoogleAuthReady]);

    // Show fallback login button if GSI script fails to load in 5 seconds
    React.useEffect(() => {
        if (!isLoggedIn && !isGoogleAuthReady) {
            const timeout = setTimeout(() => {
                if (!isGoogleAuthReady) setShowFallbackLogin(true);
            }, 5000);
            return () => clearTimeout(timeout);
        } else {
            setShowFallbackLogin(false);
        }
    }, [isLoggedIn, isGoogleAuthReady]);

    const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
        <div className="bg-base-200 p-6 rounded-lg border border-base-300 transform transition-transform hover:-translate-y-2">
            <div className="flex items-center justify-center w-12 h-12 bg-brand-primary/20 rounded-full mb-4">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-content-100 mb-2">{title}</h3>
            <p className="text-content-200">{children}</p>
        </div>
    );

    const handleSubscribe = async (planKey?: string) => {
      if (!isLoggedIn) {
        alert('Devi prima effettuare il login.');
        return;
      }
      if (!isGoogleAuthReady) {
        alert('Il login Google non è ancora pronto. Attendi che il pulsante sia disponibile.');
        return;
      }
      if (!planKey) {
        alert('Per favore, scegli un piano dalla sezione Piani e Prezzi.');
        return;
      }

      const resp = await call<any>('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      });
      const { sessionUrl, error } = resp;
      if (sessionUrl) {
          // Redirect user to Stripe Checkout
          window.location.href = sessionUrl;
      } else if (error) {
          if (error === 'Invalid Google ID token') {
              alert('La sessione di login è scaduta o non valida. Effettua nuovamente il login con Google.');
          } else {
              alert('Errore: ' + error);
          }
      }
    };

    const handleSignOut = () => {
        // Implement sign out logic here
        alert('Logout functionality is not yet implemented.');
    };

    console.log('[HomePage] userPlan:', userPlan);
    console.log('[HomePage] planOrder:', planOrder);

    // Filter plans to only show upgrades
    let filteredPlans = plans;
    if (userPlan && planOrder.includes(userPlan)) {
        const currentIdx = planOrder.indexOf(userPlan);
        console.log('[HomePage] currentIdx:', currentIdx);
        filteredPlans = plans.filter(plan => {
            const planIdx = planOrder.indexOf(plan.key);
            console.log(`[HomePage] plan.key: ${plan.key}, planIdx: ${planIdx}, currentIdx: ${currentIdx}`);
            return planIdx > currentIdx;
        });
        console.log('[HomePage] filteredPlans:', filteredPlans);
    }

    return (
        <div className="min-h-screen bg-base-100 font-sans text-content-100">
            {/* Success Dialog */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-base-100 rounded-lg shadow-lg max-w-lg w-full relative">
                        <button
                            className="absolute top-2 right-2 text-content-200 hover:text-content-100 text-2xl font-bold"
                            onClick={async () => {
                                setShowSuccess(false);
                                // Remove session_id from URL
                                const url = new URL(window.location.href);
                                url.searchParams.delete('session_id');
                                window.history.replaceState({}, '', url.toString());
                                await refreshProfile();
                            }}
                            aria-label="Chiudi"
                        >
                            x
                        </button>
                        <SuccessPage />
                    </div>
                </div>
            )}
            <main>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    {/* Remove Google Sign-In Button from here */}
                    {/* Remove Header here */}
                    <div className="text-center max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-green-500">
                            Il tuo copilota IA per l'asta del Fantacalcio
                        </h2>
                        <p className="mt-6 text-lg md:text-xl text-content-200">
                            Prepara la tua strategia, analizza i giocatori e domina la tua lega con suggerimenti intelligenti basati su dati aggiornati e analisi di Gemini.
                        </p>
                         <div className="mt-8 flex justify-center gap-4">
                            {!isLoggedIn ? (
                                <button onClick={() => handleSubscribe()} className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300">
                                    Accedi
                                </button>
                            ) : (
                                <button onClick={() => { onLogin(profile?.plan || undefined); navigate('/setup'); }} className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300">
                                    Entra nell'App
                                    <ArrowRight className="inline w-5 h-5 ml-2"/>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <FeatureCard icon={<Zap className="w-6 h-6 text-brand-primary"/>} title="Assistente Asta Live">
                            Ottieni consigli in tempo reale su chi comprare e a quale prezzo, basandoti sul budget rimanente e la composizione della tua rosa.
                        </FeatureCard>
                        <FeatureCard icon={<BarChart2 className="w-6 h-6 text-brand-primary"/>} title="Analisi Dettagliata">
                            Analisi on-demand per ogni giocatore, con punti di forza, debolezze e un verdetto strategico per l'asta.
                        </FeatureCard>
                        <FeatureCard icon={<ClipboardList className="w-6 h-6 text-brand-primary"/>} title="Preparazione Strategica">
                            Esplora i giocatori, filtra per skill e ruolo, e ottieni analisi aggregate per costruire la tua strategia vincente.
                        </FeatureCard>
                         <FeatureCard icon={<ShieldCheck className="w-6 h-6 text-brand-primary"/>} title="Dati Aggiornati">
                            Le analisi sono potenziate da Google Search per darti informazioni sempre fresche su infortuni, stato di forma e news.
                        </FeatureCard>
                    </div>

                    <div id="pricing" className="mt-24">
                        <h2 className="text-3xl font-bold text-center text-content-100">Piani e Prezzi</h2>
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 justify-center items-center place-items-center">
                            {filteredPlans.length === 0 ? (
                              <div className="col-span-3 text-center text-content-200">
                                Hai già il piano più avanzato disponibile!
                              </div>
                            ) : (
                              filteredPlans.map(plan => (
                                <div key={plan.key} className="bg-base-200 p-8 rounded-lg border border-base-300 text-center w-full max-w-xs">
                                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                                    <p className="mt-4 text-4xl font-extrabold text-brand-primary">{plan.price.split(' ')[0]}</p>
                                    <p className="text-content-200">{plan.price.split(' ').slice(1).join(' ')}</p>
                                    <button
                                        onClick={() => handleSubscribe(plan.key)}
                                        className="mt-6 w-full bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-secondary transition-colors"
                                    >
                                        Scegli {plan.name}
                                    </button>
                                </div>
                              ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default HomePage;
