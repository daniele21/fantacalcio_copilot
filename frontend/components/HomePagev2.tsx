import React, { useState } from "react";
import {
  ShieldCheck,
  BarChart2,
  Zap,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../services/AuthContext";
import { SuccessPage } from "./SuccessPage";
import { useApi } from "../services/useApi";
import { useNavigate } from "react-router-dom";
import { PoweredByGeminiBadge } from "./shared/PoweredByGeminiBadge";
import PlanDialog from "./PlanDialog";
import PlanCard, { Plan } from "./PlanCard";

const BASE_URL = import.meta.env.VITE_API_URL;

/**
 * -----------------------------------------------------------------------------
 *  PLAN CONFIGURATION
 * -----------------------------------------------------------------------------
 *  Move this to /config/plans.ts if you prefer.
 */
const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    features: [
      "Modalità demo: prova tutte le funzioni",
      "Assistente Asta Live",
      "Analisi Strategica dei Giocatori",
      "10 Crediti AI di prova",
    ],
    cta: "Inizia gratis"
  },
  {
    key: "basic",
    name: "Scout",
    price: 9.99,
    originalPrice: 14.90, // 9.99 / 0.7
    features: [
      "Assistente Asta Live",
      "Esplora Giocatori",
      "Analisi base dei Giocatori",
      "Nessun Crediti AI"
    ],
    cta: "Scegli Scout"
  },
  {
    key: "pro",
    name: "Coach",
    price: 19.99,
    originalPrice: 34.90, // 19.99 / 0.7
    recommended: true,
    features: [
      "Assistente Asta Live",
      "Analisi giocatore avanzata",
      "Analisi Strategica dei Giocatori",
      "50 Crediti AI"
    ],
    cta: "Vai Coach (più scelto)"
  },
  {
    key: "enterprise",
    name: "Manager",
    price: 49.99,
    originalPrice: 99.90, // 49.99 / 0.7
    features: [
      "Assistente Asta Live",
      "Analisi giocatore avanzata",
      "Analisi Strategica dei Giocatori",
      "Analisi AI Avanzata sui Giocatori",
      "200 Crediti AI"
    ],
    cta: "Scegli Manager"
  }
];

// Order used to understand upgrade path
const planOrder = ["free", "basic", "pro", "enterprise"];

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------
interface HomePageProps {
  onLogin: (plan?: string) => void;
  userPlan: string | null;
}

export const HomePage: React.FC<HomePageProps> = ({
  onLogin,
  userPlan
}) => {
  const { isLoggedIn, profile, isGoogleAuthReady, refreshProfile } = useAuth();
  const { call } = useApi();
  const navigate = useNavigate();

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState<Plan | null>(null);

  /** ------------------------------------------------
   * Handle query params for Stripe success redirect
   * ------------------------------------------------*/
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session_id")) setShowSuccess(true);
  }, [isLoggedIn, isGoogleAuthReady]);

  /** ------------------------------------------------
   * CTA Subscribe / Upgrade
   * ------------------------------------------------*/
  const handleSubscribe = async (planKey?: string) => {
    if (!isLoggedIn) {
      alert("Per favore, effettua il login con Google prima di procedere.");
      return;
    }
    if (!planKey) return;
    if (planKey === "free") {
      onLogin("free");
      navigate("/setup");
      return;
    }
    // Show dialog before proceeding
    const plan = plans.find((p) => p.key === planKey);
    if (plan) {
      setShowPlanDialog(plan);
      return;
    }
  };

  const confirmSubscribe = async (planKey: string) => {
    if (planKey === "free") {
      onLogin("free");
      navigate("/setup");
      setShowPlanDialog(null);
      return;
    }
    const resp = await call<any>(`${BASE_URL}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey })
    });
    const sessionUrl = resp?.data?.sessionUrl;
    const error = resp?.error;
    if (sessionUrl) window.location.href = sessionUrl;
    else if (error) alert("Errore: " + error);
    else alert("Errore sconosciuto: " + JSON.stringify(resp));
    setShowPlanDialog(null);
  };

  /** ------------------------------------------------
   * Util – calculates visible plans (upgrade only)
   * ------------------------------------------------*/
  const visiblePlans = React.useMemo(() => {
    if (!userPlan || !planOrder.includes(userPlan)) return plans;
    const currentIdx = planOrder.indexOf(userPlan);
    return plans.filter(({ key }) => planOrder.indexOf(key) >= currentIdx);
  }, [userPlan]);

  // ---------------------------------------------------------------------------
  // SMALL REUSABLE UI COMPONENTS
  // ---------------------------------------------------------------------------
  const FeatureCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }> = ({ icon, title, children }) => (
    <div className="bg-base-200 p-6 rounded-2xl border border-base-300 group transition-transform duration-300 hover:-translate-y-2">
      <div className="flex items-center justify-center w-12 h-12 bg-brand-primary/20 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-content-100 group-hover:text-brand-primary">
        {title}
      </h3>
      <p className="text-content-200 leading-relaxed">{children}</p>
    </div>
  );

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-base-100 font-sans text-content-100 flex flex-col">
      {/* Plan confirmation dialog */}
      {showPlanDialog && (
        <PlanDialog
          plan={showPlanDialog}
          onClose={() => setShowPlanDialog(null)}
          onConfirm={() => confirmSubscribe(showPlanDialog.key)}
        />
      )}

      {/* ------------------------------------------------ SUCCESS DIALOG */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-base-100 rounded-lg shadow-lg max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 text-content-200 hover:text-content-100 text-2xl font-bold"
              onClick={async () => {
                setShowSuccess(false);
                const url = new URL(window.location.href);
                url.searchParams.delete("session_id");
                window.history.replaceState({}, "", url.toString());
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

      {/* ------------------------------------------------ MAIN CONTENT */}
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 text-center max-w-4xl flex flex-col items-center">
          <h1 className="text-4xl xs:text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-600 leading-tight mb-2">
            Gestisci l’asta perfetta.<br />Zero errori. Zero stress.
          </h1>
          <h2 className="text-xl xs:text-2xl md:text-3xl font-semibold text-content-200 mb-4 mt-2">
            L’unica app che ti fa risparmiare tempo, elimina il caos e ti aiuta a vincere la tua lega con l’AI.
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mb-4 mt-2">
            <PoweredByGeminiBadge />
          </div>
          {/* Value Bullets */}
          <ul className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center text-base md:text-lg font-semibold text-content-100 mb-6 mt-2">
            <li className="bg-base-200 rounded-full px-4 py-2 border border-brand-primary/30">Tutto live e condiviso</li>
            <li className="bg-base-200 rounded-full px-4 py-2 border border-brand-primary/30">Strategia AI in un click</li>
            <li className="bg-base-200 rounded-full px-4 py-2 border border-brand-primary/30">Zero errori, zero caos</li>
            <li className="bg-base-200 rounded-full px-4 py-2 border border-brand-primary/30">Recupero istantaneo, sempre</li>
          </ul>
          <div className="mt-4 flex flex-col items-center gap-2 w-full">
            {!isLoggedIn ? (
              <>
                <button
                  onClick={() => handleSubscribe("free")}
                  className="w-full max-w-xs bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-xl hover:bg-brand-secondary transition-all duration-300 shadow-lg mb-1"
                >
                  Prova gratis. Accedi con Google
                </button>
                <span className="text-sm text-content-200">Nessuna carta richiesta</span>
              </>
            ) : (
              <button
                onClick={() => {
                  onLogin(profile?.plan || undefined);
                  navigate("/setup");
                }}
                className="w-full max-w-xs bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-xl hover:bg-brand-secondary transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
              >
                Entra nell'App <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </section>

        {/* FEATURE SECTION */}
        <section className="container mx-auto px-2 xs:px-4 sm:px-6 lg:px-8 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            <FeatureCard icon={<Zap className="w-6 h-6 text-brand-primary" />} title="Tutto live, tutto condiviso">
              Ogni rilancio, assegnazione e aggiornamento di rosa è visibile a tutti in tempo reale. La bacheca è unica, aggiornata e condivisa: nessun rischio di perdere dati o confondersi.
            </FeatureCard>
            <FeatureCard icon={<BarChart2 className="w-6 h-6 text-brand-primary" />} title="Strategia AI in un click">
              Filtra, cerca e segna i tuoi favoriti. Consulta analisi e suggerimenti AI per ogni giocatore e costruisci la tua rosa con consapevolezza e velocità.
            </FeatureCard>
            <FeatureCard icon={<ClipboardList className="w-6 h-6 text-brand-primary" />} title="Zero errori, zero caos">
              Addio a calcoli manuali e note perse: budget, slot e ruoli sono aggiornati automaticamente. Ogni azione è salvata e recuperabile su qualsiasi dispositivo.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="w-6 h-6 text-brand-primary" />} title="Asta più veloce, più divertente">
              Dimentica i tempi morti: rilanci e assegnazioni sono rapidissimi, la gestione è fluida e tutti possono concentrarsi solo sulle scelte di gioco.
            </FeatureCard>
          </div>
        </section>
        {/* Video below */}
        <div className="w-full px-2 xs:px-4 flex justify-center my-8 md:my-12">
          <div className="bg-base-200 border-2 border-brand-primary/30 rounded-2xl shadow-lg w-full max-w-2xl md:max-w-4xl flex justify-center items-center aspect-[19/9] overflow-hidden">
            <img
              src="/asta_live_demo.gif"
              alt="Demo Asta Live"
              className="w-full h-full object-contain rounded-xl border border-base-300"
              style={{ borderRadius: '1rem' }}
            />
          </div>
        </div>

        {/* ------------------------------------------------ PRICING SECTION */}
        <section id="pricing" className="container mx-auto px-2 xs:px-4 sm:px-6 lg:px-8 mt-20 md:mt-32">
          <h2 className="text-2xl xs:text-3xl font-bold text-center text-content-100">Piani & Prezzi</h2>

          {/* Plans */}
          <div className="w-full mt-8">
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 justify-center items-stretch">
              {visiblePlans.map((plan) => (
                <div key={plan.key} className="flex w-full">
                  <PlanCard plan={plan} onSelect={handleSubscribe} currentPlan={userPlan || undefined} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <div className="h-24 md:h-32" />
    </div>
  );
};

// export default HomePage;
