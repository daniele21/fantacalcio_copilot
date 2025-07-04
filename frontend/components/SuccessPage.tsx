import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useApi } from '../services/useApi';
import { useAuth } from '../services/AuthContext';

const BASE_URL = import.meta.env.VITE_API_URL;

export const SuccessPage: React.FC = () => {
  const [plan, setPlan] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  const { call } = useApi();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) return;
    call<any>(`${BASE_URL}/api/checkout-session?sessionId=${sessionId}`)
      .then(data => {
        setPlan(data.data.metadata.plan);
        // Store the new plan state in the backend
        call<any>(`${BASE_URL}/api/checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: data.data.metadata.plan, sessionId }),
        });
        // Refresh user profile to update plan after payment, after 3 seconds
        setTimeout(() => {
          refreshProfile();
        }, 3000);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-6">
      {/* Confetti animation on successful load */}
      {!loading && !error && <Confetti numberOfPieces={400} recycle={false} />}

      <div className="max-w-md w-full text-center shadow-lg rounded-2xl p-6 bg-base-200">
        <div className="mb-4">
          <CheckCircle2 className="mx-auto text-brand-primary" size={48} />
          <h2 className="text-3xl font-semibold mt-4 text-content-100">Grazie per il tuo acquisto!</h2>
        </div>

        <div>
          {loading && <p className="mt-4 text-content-200 animate-pulse">Caricamento dettagli del piano...</p>}
          {error && <p className="mt-4 text-red-400">Si è verificato un errore nel recupero delle informazioni.</p>}
          {!loading && !error && (
            <p className="mt-4 text-lg text-content-200">
              Hai scelto il piano <strong className="text-brand-primary">{plan}</strong>.
            </p>
          )}

          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={() => navigate('/setup')}
              className="bg-brand-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-secondary transition-colors"
            >
              Entra nell'App
            </button>
            <button
              onClick={() => navigate('/')}
              className="border border-brand-primary text-brand-primary px-6 py-2 rounded-lg font-semibold bg-base-200 hover:bg-brand-primary hover:text-white transition-colors"
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
