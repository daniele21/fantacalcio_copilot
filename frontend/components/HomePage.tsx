import React, { useState } from "react";
import {
  ShieldCheck,
  BarChart2,
  Zap,
  ClipboardList,
  ArrowRight,
  Check
} from "lucide-react";
import { Switch } from "@headlessui/react";
import clsx from "clsx";
import { useAuth } from "../services/AuthContext";
import { SuccessPage } from "./SuccessPage";
import { useApi } from "../services/useApi";
import { useNavigate } from "react-router-dom";
import { PoweredByGeminiBadge } from "./shared/PoweredByGeminiBadge";

const BASE_URL = import.meta.env.VITE_API_URL;

/**
 * -----------------------------------------------------------------------------
 *  PLAN CONFIGURATION
 * -----------------------------------------------------------------------------
 *  Move this to /config/plans.ts if you prefer.
 */
interface Plan {
  key: string;
  name: string;
  priceMonthly: number;
  priceYearly: number; // discounted price (per month)
  features: string[];
  recommended?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    key: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
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
    name: "Basic",
    priceMonthly: 9.99,
    priceYearly: 7.99,
    features: [
      "Assistente Asta Live",
      "Esplora Giocatori",
      "Analisi base dei Giocatori",
      "Nessun Crediti AI"
    ],
    cta: "Scegli Basic"
  },
  {
    key: "pro",
    name: "Pro",
    priceMonthly: 19.99,
    priceYearly: 15.99,
    recommended: true,
    features: [
      "Assistente Asta Live",
      "Analisi giocatore avanzata",
      "Analisi Strategica dei Giocatori",
      "50 Crediti AI"
    ],
    cta: "Vai Pro (più scelto)"
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceMonthly: 49.99,
    priceYearly: 39.99,
    features: [
      "Assistente Asta Live",
      "Analisi giocatore avanzata",
      "Analisi Strategica dei Giocatori",
      "Analisi AI Avanzata sui Giocatori",
      "200 Crediti AI"
    ],
    cta: "Scegli Enterprise"
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
  setUserPlan: (plan: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onLogin,
  userPlan,
  setUserPlan
}) => {
  const { isLoggedIn, profile, isGoogleAuthReady, refreshProfile } = useAuth();
  const { call } = useApi();
  const navigate = useNavigate();

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showFallbackLogin, setShowFallbackLogin] = React.useState(false);
  const [isYearly, setIsYearly] = React.useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState<Plan | null>(null);

  /** ------------------------------------------------
   * Handle query params for Stripe success redirect
   * ------------------------------------------------*/
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session_id")) setShowSuccess(true);
  }, [isLoggedIn, isGoogleAuthReady]);

  /** ------------------------------------------------
   * Fallback if GSI fails
   * ------------------------------------------------*/
  React.useEffect(() => {
    if (!isLoggedIn && !isGoogleAuthReady) {
      const timeout = setTimeout(() => setShowFallbackLogin(true), 5000);
      return () => clearTimeout(timeout);
    }
    setShowFallbackLogin(false);
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

  const PlanCard: React.FC<{ plan: Plan }> = ({ plan }) => {
    const price = isYearly ? plan.priceYearly : plan.priceMonthly;
    const priceLabel = price === 0 ? "Gratis" : `€${price.toFixed(2)}`;

    return (
      <div
        className={clsx(
          "relative bg-base-200 p-8 rounded-2xl border border-base-300 w-full max-w-xs flex flex-col",
          plan.recommended && "ring-2 ring-brand-primary scale-105"
        )}
      >
        {plan.recommended && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-xs font-semibold tracking-wide text-white px-3 py-1 rounded-full">
            Più scelto
          </span>
        )}
        <h3 className="text-2xl font-bold text-content-100">{plan.name}</h3>
        <p className="mt-4 text-5xl font-extrabold text-brand-primary">
          {priceLabel}
        </p>
        {price !== 0 && (
          <p className="text-content-200 text-sm">
            {isYearly ? "al mese (fatturazione annuale)" : "/ mese"}
          </p>
        )}

        <ul className="mt-6 space-y-2 text-left flex-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start">
              <Check className="w-4 h-4 text-green-400 mt-1 mr-2" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => handleSubscribe(plan.key)}
          className="mt-8 w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 rounded-lg transition-colors"
          aria-label={`Abbonati al piano ${plan.name}`}
        >
          {plan.cta}
        </button>
      </div>
    );
  };

  // Add PlanDialog component
  const PlanDialog: React.FC<{ plan: Plan; onClose: () => void; onConfirm: () => void }> = ({ plan, onClose, onConfirm }) => {
    const price = isYearly ? plan.priceYearly : plan.priceMonthly;
    const aiCredits = plan.features.find(f => f.toLowerCase().includes("crediti ai")) || "-";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full p-8 relative border-2 border-brand-primary/30 animate-fade-in">
          <button
            className="absolute top-3 right-3 text-content-200 hover:text-brand-primary text-2xl font-bold transition-colors"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
          <div className="flex flex-col items-center mb-6">
            <ShieldCheck className="w-12 h-12 text-brand-primary mb-2" />
            <h2 className="text-2xl font-extrabold mb-1 text-center text-brand-primary">Conferma il tuo acquisto</h2>
            <p className="text-content-200 text-center text-sm">Rivedi i dettagli prima di procedere al pagamento.</p>
          </div>
          <div className="bg-base-200 rounded-xl p-4 mb-6 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-content-100">Piano</span>
              <span className="font-bold text-brand-primary text-lg">{plan.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-content-100">Prezzo</span>
              <span className="font-bold text-lg">{price === 0 ? "Gratis" : `€${price.toFixed(2)} IVA inclusa`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-content-100">Crediti AI</span>
              <span className="font-bold text-green-600">{aiCredits}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-content-100">Durata</span>
              <span className="font-bold">Fino a dicembre 2025</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-content-100">Rinnovo</span>
              <span className="font-bold text-orange-500">Nessun rinnovo automatico</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-content-100">Pagamento</span>
              <span className="font-bold">Una tantum</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-4 text-sm text-content-200 text-center">
            <a href="/terms" target="_blank" className="underline hover:text-brand-primary transition-colors">Termini &amp; Condizioni</a>
            <a href="/privacy" target="_blank" className="underline hover:text-brand-primary transition-colors">Privacy Policy</a>
          </div>
          <button
            className="btn btn-primary w-full mt-2 py-3 text-lg font-bold shadow-lg hover:scale-105 transition-transform"
            onClick={onConfirm}
          >
            Conferma e paga
          </button>
        </div>
      </div>
    );
  };

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

          {/* Toggle billing */}
          <div className="flex justify-center items-center gap-3 mt-8 select-none">
            <span className="font-medium">Mensile</span>
            <Switch
              checked={isYearly}
              onChange={setIsYearly}
              className={clsx(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isYearly ? "bg-brand-primary" : "bg-base-300"
              )}
            >
              <span
                className={clsx(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isYearly ? "translate-x-6" : "translate-x-1"
                )}
              />
            </Switch>
            <span className="font-medium">Annuale (-20%)</span>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-center items-stretch mt-12">
            {visiblePlans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} />
            ))}
          </div>
        </section>
      </main>
      <div className="h-32" />
    </div>
  );
};

export default HomePage;
