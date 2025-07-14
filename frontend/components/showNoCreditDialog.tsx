import React, { useState } from 'react';
import { base_url } from '../services/api';
import { useApi } from '../services/useApi';
import PlanDialog from './PlanDialog';

export interface ShowNoCreditDialogProps {
  open: boolean;
  onClose: () => void;
  plan: string; // Add plan prop
}

export default function ShowNoCreditDialog({ open, onClose, plan }: ShowNoCreditDialogProps) {
  const { call } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedPlan, setFetchedPlan] = useState<string | undefined>(undefined);
  const [creditsToBuy, setCreditsToBuy] = useState(5);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const creditPrice = 0.5;
  const totalCost = (creditsToBuy * creditPrice).toFixed(2);

  React.useEffect(() => {
    // Log the plan prop for debugging
    // eslint-disable-next-line no-console
    console.log('[ShowNoCreditDialog] plan prop:', plan);
    if (!plan) {
      // Try to fetch plan from /api/me if not provided
      (async () => {
        try {
          const idToken = localStorage.getItem('idToken');
          const headers: Record<string, string> = idToken ? { Authorization: `Bearer ${idToken}` } : {};
          const resp = await fetch(`${base_url}/api/me`, { credentials: 'include', headers });
          const data = await resp.json();
          if (data?.data?.plan) {
            setFetchedPlan(data.data.plan);
            // eslint-disable-next-line no-console
            console.log('[ShowNoCreditDialog] fetched plan from /api/me:', data.data.plan);
          } else {
            // eslint-disable-next-line no-console
            console.error('[ShowNoCreditDialog] Could not fetch plan from /api/me');
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[ShowNoCreditDialog] Error fetching plan from /api/me:', err);
        }
      })();
    }
  }, [plan]);

  const effectivePlan = plan || fetchedPlan;

  const handleBuyCredits = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await call<any>(`${base_url}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: effectivePlan, credits: creditsToBuy })
      });
      const sessionUrl = resp?.data?.sessionUrl;
      const apiError = resp?.error;
      if (sessionUrl) {
        onClose();
        window.location.href = sessionUrl;
      } else if (apiError) {
        setError('Errore: ' + apiError);
      } else {
        setError('Errore sconosciuto: ' + JSON.stringify(resp));
      }
    } catch (e: any) {
      setError(e?.message || 'Errore di rete.');
    } finally {
      setLoading(false);
      setShowPlanDialog(false);
    }
  };

  if (!open) return null;

  // Prepare a pseudo-plan for credits purchase
  const creditPlan = {
    name: `Acquisto Crediti AI`,
    price: Number(totalCost),
    features: [
      `${creditsToBuy} Crediti AI`,
      'Utilizzabili su tutte le funzioni avanzate',
      'Pagamento una tantum',
      'Nessun rinnovo automatico'
    ],
    cta: `Compra Crediti`
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {showPlanDialog && (
        <PlanDialog
          plan={creditPlan}
          onClose={() => setShowPlanDialog(false)}
          onConfirm={handleBuyCredits}
        />
      )}
      <div className="bg-base-100 p-8 rounded-xl shadow-2xl max-w-sm w-full border-2 border-red-400 flex flex-col items-center">
        <span className="text-4xl mb-2">💳</span>
        <h3 className="text-lg font-bold text-red-600 mb-2">Crediti AI esauriti</h3>
        <p className="text-content-100 mb-4 text-center">Hai esaurito i crediti AI. Acquista nuovi crediti per continuare a usare le funzioni avanzate.</p>
        <div className="mb-4 w-full flex flex-col items-center">
          <label htmlFor="creditsToBuy" className="text-sm font-semibold mb-1">Quanti crediti vuoi acquistare?</label>
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              type="button"
              aria-label="Diminuisci crediti"
              className="bg-base-300 hover:bg-base-400 text-lg rounded-l-lg px-3 py-2 border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              onClick={() => setCreditsToBuy(c => Math.max(1, c - 1))}
              disabled={creditsToBuy <= 1 || loading}
            >
              -
            </button>
            <input
              id="creditsToBuy"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={creditsToBuy}
              onChange={e => {
                const val = e.target.value;
                if (val === '') return;
                if (/^\d+$/.test(val)) {
                  const num = parseInt(val, 10);
                  if (!isNaN(num)) {
                    setCreditsToBuy(Math.max(1, Math.min(100, num)));
                  }
                }
              }}
              className="w-24 text-center bg-base-100 border-2 border-base-300 text-2xl font-bold text-content-100 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition px-2 py-2"
              style={{ appearance: 'textfield' }}
              disabled={loading}
            />
            <button
              type="button"
              aria-label="Aumenta crediti"
              className="bg-base-300 hover:bg-base-400 text-lg rounded-r-lg px-3 py-2 border border-base-300 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              onClick={() => setCreditsToBuy(c => Math.min(100, c + 1))}
              disabled={creditsToBuy >= 100 || loading}
            >
              +
            </button>
          </div>
          <span className="text-xs text-content-200">1 credito = 0,50 €</span>
          <span className="text-base font-semibold mt-1">Totale: <span className="text-brand-primary">{totalCost} €</span></span>
          {effectivePlan === 'free' && (
            <div className="mt-3 text-xs text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-2 text-center">
              <b>Demo:</b> I crediti acquistati manterranno il profilo in modalità demo, <strong>con giocatori limitati</strong>.<br />
              Per sbloccare tutte le funzionalità e i giocatori, è necessario abbonarsi a uno dei piani disponibili.
            </div>
          )}
        </div>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          onClick={() => setShowPlanDialog(true)}
          className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-lg mt-2 hover:bg-brand-secondary transition disabled:bg-gray-400"
          disabled={loading}
        >
          {loading ? `Attendi...` : `Compra ${creditsToBuy} Crediti`}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 py-2 px-4 rounded-lg border border-base-300 text-content-200 hover:bg-base-200"
          disabled={loading}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
