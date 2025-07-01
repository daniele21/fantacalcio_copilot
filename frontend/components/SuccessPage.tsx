import React, { useEffect, useState } from 'react';

const BASE_URL = 'http://127.0.0.1:5000';

export const SuccessPage: React.FC = () => {
  const [plan, setPlan] = useState<string>('');
  const sessionId = new URLSearchParams(window.location.search).get('session_id');

  useEffect(() => {
    if (!sessionId) return;
    // Call your backend to retrieve the session
    fetch(`${BASE_URL}/api/checkout-session?sessionId=${sessionId}`, {
      headers: { 'Content-Type': 'application/json' }
    })
      .then(r => r.json())
      .then(data => {
        // `data.metadata.plan` was set when creating the session
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
