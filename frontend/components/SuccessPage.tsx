import React, { useEffect, useState } from 'react';
import { useApi } from '../services/useApi';

export const SuccessPage: React.FC = () => {
  const [plan, setPlan] = useState<string>('');
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  const { call } = useApi();

  useEffect(() => {
    if (!sessionId) return;
    call<any>(`/api/checkout-session?sessionId=${sessionId}`)
      .then(data => {
        setPlan(data.metadata.plan);
      })
      .catch(console.error);
  }, [sessionId]);

  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold">Grazie per il tuo acquisto!</h1>
      {plan && <p className="mt-4">Hai scelto il piano <strong>{plan}</strong>.</p>}
    </div>
  );
};
