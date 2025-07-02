import React from 'react';
import { ShieldCheck, BarChart2, Zap, ClipboardList, ArrowRight } from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { SuccessPage } from './SuccessPage';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const BASE_URL = "http://127.0.0.1:5000";
const plans = [
  { key: 'basic',      name: 'Basic',      price: '€9.99 / mese' },
  { key: 'pro',        name: 'Pro',        price: '€19.99 / mese' },
  { key: 'enterprise', name: 'Enterprise', price: '€49.99 / mese' },
];

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
    const { isLoggedIn, profile, handleSignOut, isGoogleAuthReady, idToken } = useAuth();
    const signInButtonRef = React.useRef<HTMLDivElement>(null);
    const [showSuccess, setShowSuccess] = React.useState<boolean>(false);
    const [showFallbackLogin, setShowFallbackLogin] = React.useState<boolean>(false);

    // Add a function to refresh the profile after payment
    const refreshProfile = React.useCallback(async () => {
        if (!idToken) return;
        try {
            const resp = await fetch(`${BASE_URL}/api/me`, {
                headers: { Authorization: `Bearer ${idToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                // Use AuthContext's setProfile if available, otherwise reload page
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new Event('profile:refresh'));
                }
            }
        } catch (e) {
            // ignore
        }
    }, [idToken]);

    React.useEffect(() => {
        // Listen for profile:refresh event to trigger context reload if needed
        const handler = () => {
            // This will be handled in AuthContext if you wire it up
        };
        window.addEventListener('profile:refresh', handler);
        return () => window.removeEventListener('profile:refresh', handler);
    }, []);

    React.useEffect(() => {
        if (!isLoggedIn && isGoogleAuthReady && signInButtonRef.current) {
            // Only render if not already rendered
            if (signInButtonRef.current.childNodes.length === 0 && window.google && window.google.accounts && window.google.accounts.id) {
                try {
                    window.google.accounts.id.renderButton(signInButtonRef.current, {
                        theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', width: '220px'
                    });
                    console.log("[HomePage] Google Sign-In button rendered.");
                } catch (err) {
                    console.error("[HomePage] Error rendering Google Sign-In button:", err);
                }
            }
        }

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

    // Handler to trigger Google Sign-In button click programmatically
    const handleGoogleLogin = () => {
        if (signInButtonRef.current) {
            const btn = signInButtonRef.current.querySelector('div[role="button"], button');
            if (btn) {
                (btn as HTMLElement).click();
            } else {
                signInButtonRef.current.style.display = 'block';
                alert('Il pulsante di accesso Google non è ancora pronto. Riprova tra qualche secondo o clicca direttamente il pulsante qui sotto.');
            }
        }
    };

    const handleSubscribe = async (planKey: string) => {
      if (!isLoggedIn) return alert('Devi prima effettuare il login.');
      if (!isGoogleAuthReady) return alert('Il login Google non è ancora pronto. Attendi che il pulsante sia disponibile.');
      const stripe = await stripePromise;
      const resp = await fetch(`${BASE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('idToken')}`,
        },
        body: JSON.stringify({ plan: planKey }),
      });
      const { sessionId, error } = await resp.json();
      if (error) {
        if (error === 'Invalid Google ID token') {
          alert('La sessione di login è scaduta o non valida. Effettua nuovamente il login con Google.');
          return;
        }
        return alert('Errore: ' + error);
      }
      const { error: stripeError } = await stripe!.redirectToCheckout({ sessionId });
      if (stripeError) {
        console.error(stripeError);
        alert(stripeError.message);
      }
    };

    // Quando l'utente effettua il login, recupera il piano e aggiorna lo stato globale
    const handleGoogleLoginSuccess = async (idToken: string) => {
        try {
            const resp = await fetch("http://127.0.0.1:5000/api/me", {
                headers: { Authorization: `Bearer ${idToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setUserPlan(data.plan);
                onLogin(data.plan);
            } else {
                onLogin();
            }
        } catch (e) {
            onLogin();
        }
    };

    React.useEffect(() => {
      if (isLoggedIn && idToken) {
        fetch(`${BASE_URL}/api/me`, {
          headers: { Authorization: `Bearer ${idToken}` }
        })
          .then(resp => resp.json())
          .then(data => {
            if (data.plan) {
              setUserPlan(data.plan);
              // Only call onLogin if userPlan is not set or has changed
              if (!userPlan || userPlan !== data.plan) {
                onLogin(data.plan);
              }
            }
          });
      }
    }, [isLoggedIn, idToken, setUserPlan, onLogin]);

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
                            ×
                        </button>
                        <SuccessPage />
                    </div>
                </div>
            )}
            {/* Header */}
            <header className="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-lg">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between border-b border-base-300">
                        <div className="flex items-center">
                            <ShieldCheck className="w-8 h-8 text-brand-primary" />
                            <h1 className="ml-2 text-xl font-bold">Fantacalcio Copilot</h1>
                        </div>
                        <div className="flex items-center gap-4">
                           {isLoggedIn && profile ? (
                                <div className="flex items-center gap-3">
                                    <img src={profile.picture} alt={profile.name} className="w-8 h-8 rounded-full"/>
                                    <div className="hidden sm:block">
                                        <p className="text-sm font-semibold">{profile.name}</p>
                                        <p className="text-xs text-content-200 capitalize">{profile.plan || 'Free'} Plan</p>
                                    </div>
                                    <button onClick={handleSignOut} className="px-3 py-1.5 text-sm font-semibold text-content-200 bg-base-200 rounded-md hover:bg-base-300">Esci</button>
                                </div>
                           ) : (
                                <>
                                 <div ref={signInButtonRef} style={{ display: !showFallbackLogin ? 'block' : 'none' }}></div>
                                 {showFallbackLogin &&
                                    <button onClick={handleGoogleLogin} className="px-4 py-2 text-sm font-semibold text-content-100 bg-blue-600 rounded-md hover:bg-blue-700">
                                      Accedi con Google
                                    </button>
                                  }
                               </>
                           )}
                        </div>
                    </div>
                </div>
            </header>
            <main>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-green-500">
                            Il tuo copilota IA per l'asta del Fantacalcio
                        </h2>
                        <p className="mt-6 text-lg md:text-xl text-content-200">
                            Prepara la tua strategia, analizza i giocatori e domina la tua lega con suggerimenti intelligenti basati su dati aggiornati e analisi di Gemini.
                        </p>
                         <div className="mt-8 flex justify-center gap-4">
                            {!isLoggedIn ? (
                                <button onClick={handleGoogleLogin} className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300">
                                    Inizia Ora con Google
                                </button>
                            ) : (
                                <button onClick={() => onLogin(userPlan)} className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300">
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
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                            {plans.map(plan => (
                                <div key={plan.key} className="bg-base-200 p-8 rounded-lg border border-base-300 text-center">
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
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
