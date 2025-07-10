import React, { useState } from 'react';
import { base_url } from '../services/api';
import { useApi } from '../services/useApi';

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
        body: JSON.stringify({ plan: effectivePlan, credits: 5 }) // Use plan from prop or fetched
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
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 p-8 rounded-xl shadow-2xl max-w-sm w-full border-2 border-red-400 flex flex-col items-center">
        <span className="text-4xl mb-2">💳</span>
        <h3 className="text-lg font-bold text-red-600 mb-2">Crediti AI esauriti</h3>
        <p className="text-content-100 mb-4 text-center">Hai esaurito i crediti AI. Acquista un nuovo pacchetto per continuare a usare le funzioni avanzate.</p>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          onClick={handleBuyCredits}
          className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-lg mt-2 hover:bg-brand-secondary transition disabled:bg-gray-400"
          disabled={loading}
        >
          {loading ? 'Attendi...' : 'Compra Crediti'}
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
