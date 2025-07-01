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
                btn.click();
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
                    <div className="flex items-center justify-between h-16 border-b border-base-300">
                        <div className="flex items-center space-x-3">
                            <ShieldCheck className="w-8 h-8 text-brand-primary" />
                            <h1 className="text-2xl font-bold tracking-tight">
                                Fantacalcio <span className="text-brand-primary">Copilot</span>
                            </h1>
                        </div>
                        {isLoggedIn ? (
                            <div className="flex items-center space-x-3">
                                {profile && profile.picture ? (
                                    <img src={profile.picture} alt="User" className="w-8 h-8 rounded-full border-2 border-brand-primary" />
                                ) : profile ? (
                                    <span className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-brand-primary font-bold">{profile.name?.[0] || '?'}</span>
                                ) : null}
                                {profile && <span className="font-semibold text-content-100">{profile.name || profile.email}</span>}
                                {profile && profile.plan && (
                                    <span className="ml-2 px-2 py-1 rounded bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase">
                                        {profile.plan}
                                    </span>
                                )}
                                <button onClick={handleSignOut} className="ml-2 bg-red-600 text-white font-semibold px-3 py-1 rounded-lg hover:bg-red-700 transition-colors text-sm">Logout</button>
                            </div>
                        ) : (
                            <div
                              ref={signInButtonRef}
                              className="flex flex-col items-center justify-center py-2 min-h-[50px]"
                              id="signInDivRef"
                            >
                              {/* Google Sign-In button will be rendered here by GSI */}
                              {!isGoogleAuthReady && !showFallbackLogin && (
                                <p className="text-xs text-content-200 mt-2">Caricamento login Google...</p>
                              )}
                              {showFallbackLogin && (
                                <button
                                  onClick={() => {
                                    if (window.google && window.google.accounts && window.google.accounts.id && typeof window.google.accounts.id.prompt === 'function') {
                                      window.google.accounts.id.prompt();
                                    } else {
                                      alert('Impossibile avviare il login Google. Ricarica la pagina o disabilita eventuali ad blocker.');
                                      onLogin();
                                    }
                                  }}
                                  className="mt-2 px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary transition"
                                >
                                  Accedi con Google (fallback)
                                </button>
                              )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Hero Section */}
                <section className="text-center py-20 sm:py-24 lg:py-32">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-content-100">
                        Il tuo <span className="text-brand-primary">vantaggio strategico</span> per l'asta del Fantacalcio.
                    </h2>
                    <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-content-200">
                        Sfrutta la potenza dell'AI di Gemini per dominare la tua lega. Analisi pre-asta, suggerimenti live e strategie personalizzate.
                    </p>
                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={() => onLogin()} 
                            className="group flex items-center bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300 shadow-lg hover:shadow-brand-primary/40 transform hover:scale-105"
                        >
                            Inizia Ora
                            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </section>

                {/* Pricing Section */}
                <section className="py-16 text-center">
                  <h3 className="text-3xl font-bold mb-6">Scegli il tuo piano</h3>
                  <div className="flex flex-wrap justify-center gap-8">
                    {plans.map(p => (
                      <div key={p.key} className="p-6 border rounded-lg w-64">
                        <h4 className="text-2xl font-semibold mb-2">{p.name}</h4>
                        <p className="text-lg mb-4">{p.price}</p>
                        <button
                          onClick={() => handleSubscribe(p.key)}
                          disabled={!isGoogleAuthReady}
                          className="flex items-center justify-center bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-secondary transition disabled:opacity-50"
                        >
                          Sottoscrivi {p.name}
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-16">
                     <div className="text-center mb-12">
                        <h3 className="text-3xl font-bold">Tutto ciò di cui hai bisogno per vincere</h3>
                        <p className="text-content-200 mt-2">Funzionalità intelligenti per ogni fase della tua preparazione.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard icon={<BarChart2 className="w-6 h-6 text-brand-primary" />} title="Analisi Approfondita">
                            Esplora i giocatori con filtri avanzati e ottieni analisi strategiche sui segmenti di mercato, potenziate da dati web recenti.
                        </FeatureCard>
                        <FeatureCard icon={<ClipboardList className="w-6 h-6 text-brand-primary" />} title="Strategia Personalizzata">
                            Crea la tua lista di obiettivi, alloca il budget per ruolo e pianifica ogni mossa per costruire una squadra imbattibile.
                        </FeatureCard>
                        <FeatureCard icon={<Zap className="w-6 h-6 text-brand-primary" />} title="Assistente Asta Live">
                            Ricevi consigli in tempo reale durante l'asta. Il Copilota analizza la tua squadra e il budget per suggerirti l'offerta perfetta.
                        </FeatureCard>
                    </div>
                </section>
            </main>
            
            {/* Footer */}
            <footer className="text-center py-6 mt-8 border-t border-base-300 text-sm text-content-200/50">
                <p>Fantacalcio Copilot AI &copy; {new Date().getFullYear()}. Realizzato con passione per i fantallenatori.</p>
            </footer>
        </div>
    );
};
