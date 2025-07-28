import React, { useState } from "react";
import {
  ShieldCheck,
  BarChart2,
  Zap,
  ClipboardList,
  ArrowRight,
  Check
} from "lucide-react";
import clsx from "clsx";
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
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 text-center max-w-5xl">

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-green-500">
        <span className="block">Punta meglio.</span>
        <span className="block">Rilancia più veloce.</span>
          </h1>
            <h2 className="text-6xl leading-[1.15] md:text-8xl md:leading-[1.15] font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-green-600">
              Vinci la tua lega.
            </h2>
          <br></br>
          <div className="flex justify-center mb-4">
            <PoweredByGeminiBadge />
          </div>
          <div className="h-8" />
          <p className="mt-6 text-lg md:text-2xl font-semibold text-content-200">
            FantaCopilot usa dati in tempo reale e <strong>intelligenza artificiale</strong> per guidare ogni scelta e ogni <strong>rilancio</strong>.
          </p>

          <div className="mt-10 flex flex-col items-center gap-2">
            {!isLoggedIn ? (
              <>
                <button
                  onClick={() => handleSubscribe("free")}
                  className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300"
                >
                  Prova gratis. Accedi con Google
                </button>
                {/* Google Sign-In badge directly under the button */}
                {/* <VerifiedGoogleSignInBadge className="mt-2" /> */}
              </>
            ) : (
              <button
                onClick={() => {
                  onLogin(profile?.plan || undefined);
                  navigate("/setup");
                }}
                className="bg-brand-primary text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-secondary transition-all duration-300 flex items-center justify-center gap-2"
              >
                Entra nell'App <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </section>

        {/* ------------------------------------------------ FEATURE SECTION */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard icon={<Zap className="w-6 h-6 text-brand-primary" />} title="Vinci ogni rilancio">
              Consigli in tempo reale su chi comprare e a che prezzo in base al budget rimanente.
            </FeatureCard>
            <FeatureCard icon={<BarChart2 className="w-6 h-6 text-brand-primary" />} title="Scova gemme nascoste">
              Analisi istantanea dei punti di forza e debolezza di ogni calciatore.
            </FeatureCard>
            <FeatureCard icon={<ClipboardList className="w-6 h-6 text-brand-primary" />} title="Arriva preparato all'asta">
              Crea la tua watch-list, filtra per ruolo e ottieni strategie aggregate.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="w-6 h-6 text-brand-primary" />} title="Decidi con dati freschi">
              Infortuni, stato di forma e news aggiornate grazie a Google Search.
            </FeatureCard>
          </div>
        </section>
        {/* Video below */}
        <div className="w-[70%] mx-auto flex justify-center my-12">
          <div className="bg-base-200 border-2 border-brand-primary/30 rounded-2xl shadow-lg w-full flex justify-center items-center aspect-[19/9] overflow-hidden">
            <img
              src="/asta_live_demo.gif"
              alt="Demo Asta Live"
              className="w-full h-full object-contain rounded-xl border border-base-300"
              style={{ borderRadius: '1rem' }}
            />
          </div>
        </div>

        {/* ------------------------------------------------ PRICING SECTION */}
        <section id="pricing" className="container mx-auto px-4 sm:px-6 lg:px-8 mt-32">
          <h2 className="text-3xl font-bold text-center text-content-100">Piani & Prezzi</h2>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-center items-stretch mt-12">
            {visiblePlans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} onSelect={handleSubscribe} currentPlan={userPlan || undefined} />
            ))}
          </div>
        </section>
      </main>
      <div className="h-32" />
    </div>
  );
};

export default HomePage;
