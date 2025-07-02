import React from 'react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useApi } from '../services/useApi';
import { useNavigate } from 'react-router-dom';

const plans = [
  { key: 'basic',      name: 'Basic',      price: '€9.99', order: 1 },
  { key: 'pro',        name: 'Pro',        price: '€19.99', order: 2 },
  { key: 'enterprise', name: 'Enterprise', price: '€49.99', order: 3 },
];
const planOrder: Record<string, number> = { free: 0, basic: 1, pro: 2, enterprise: 3 };

interface UpgradeViewProps {
  featureName: string;
  onNavigateHome: () => void;
}

export const UpgradeView: React.FC<UpgradeViewProps> = ({ featureName, onNavigateHome }) => {
  const { profile, isLoggedIn, isGoogleAuthReady } = useAuth();
  const { call } = useApi();
  const navigate = useNavigate();
  const currentPlan = profile?.plan || 'free';
  const currentOrder = planOrder[currentPlan];
  const upgradePlans = plans.filter(p => planOrder[p.key] > currentOrder);

  const handleSubscribe = async (planKey: string) => {
    if (!isLoggedIn) {
      alert('Devi prima effettuare il login.');
      return;
    }
    if (!isGoogleAuthReady) {
      alert('Il login Google non è ancora pronto. Attendi che il pulsante sia disponibile.');
      return;
    }
    const resp = await call<any>('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planKey }),
    });
    // console.log('Stripe session response:', resp);
    const sessionUrl = resp?.data?.sessionUrl;
    const error = resp?.data?.error;
    if (sessionUrl) {
      window.location.href = sessionUrl;
    } else if (error) {
      alert('Errore: ' + error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8 bg-base-100">
      <div className="bg-base-200 p-8 rounded-2xl shadow-xl max-w-lg border border-brand-primary/20">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Sparkles className="w-20 h-20 text-brand-primary" />
            <div className="absolute -bottom-2 -right-2 bg-base-300 p-2 rounded-full border-4 border-base-200">
              <Lock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-content-100">
          La funzionalità <span className="text-brand-primary">{featureName}</span> è Premium
        </h2>
        <p className="text-content-200 mt-4 text-lg">
          Per accedere a questo e altri potenti strumenti, effettua l'upgrade del tuo piano.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-6">
          {upgradePlans.map(plan => (
            <div key={plan.key} className="bg-base-100 p-6 rounded-lg border border-base-300 text-center">
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <p className="mt-4 text-4xl font-extrabold text-brand-primary">{plan.price}</p>
              <button
                onClick={() => handleSubscribe(plan.key)}
                className="mt-6 w-full bg-brand-primary text-white font-bold py-3 rounded-lg hover:bg-brand-secondary transition-colors"
              >
                Scegli {plan.name}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/')}
          className="group mt-8 flex items-center mx-auto bg-base-200 text-brand-primary font-bold py-3 px-8 rounded-full text-lg hover:bg-base-300 transition-all duration-300 shadow-lg hover:shadow-brand-primary/40 transform hover:scale-105 border border-brand-primary"
        >
          Torna alla Home
          <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
