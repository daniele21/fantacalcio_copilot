import React, { useState } from "react";
import { useCookie } from "../services/CookieContext";
import { Link } from "react-router-dom";

export const CookieBanner: React.FC = () => {
  const { consent, setConsent } = useCookie();
  const [showDialog, setShowDialog] = useState(false);

  // Show dialog if cookies are denied
  React.useEffect(() => {
    if (consent === "rejected") {
      setShowDialog(true);
    } else {
      setShowDialog(false);
    }
  }, [consent]);

  if (consent === "unset") {
    // Block all interaction with a fullscreen overlay
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
        <div className="bg-base-200 border border-base-300 rounded-xl shadow-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-4 text-content-100">Consenso ai Cookie</h2>
          <p className="mb-4 text-content-200">
            Usiamo cookie tecnici e, previo consenso, cookie di analisi per migliorare l’esperienza.
            <Link to="/privacy" className="underline ml-1">Maggiori informazioni</Link>
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <button onClick={() => setConsent("rejected")}
                    className="btn btn-ghost">Rifiuta</button>
            <button onClick={() => setConsent("accepted")}
                    className="btn btn-primary">Accetta tutti</button>
          </div>
        </div>
      </div>
    );
  }

  // Show dialog if cookies are denied and consent is not unset
  return (
    <>
      {showDialog && consent !== "unset" && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-base-200 rounded-xl shadow-lg p-6 max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-4 text-content-100">Consenso ai Cookie Necessario</h2>
            <p className="mb-4 text-content-200">
              Alcune funzionalità dell'app richiedono il consenso ai cookie di analisi/statistica. Puoi accettare per continuare, oppure rivedere le tue preferenze.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <button className="btn btn-primary" onClick={() => { setConsent("accepted"); setShowDialog(false); }}>
                Accetta e continua
              </button>
              <button
                className="btn btn-ghost flex-1 px-6 py-2 rounded-lg font-semibold border border-base-300 shadow hover:bg-base-300/40 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
                onClick={() => {
                  setShowDialog(false); // Hide dialog immediately
                  setConsent("unset");
                  window.location.href = "/privacy";
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <svg className="w-5 h-5 text-content-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Rivedi preferenze
                </span>
              </button>
            </div>
            <div className="mt-4">
              <Link to="/privacy" className="underline text-brand-primary">Scopri di più sulla privacy</Link>
            </div>
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 w-full bg-base-200 text-content-200 text-center text-xs py-2 z-[10000] border-t border-base-300">
        © {new Date().getFullYear()} FantaPilot · Tutti i diritti riservati · <a href="/privacy" className="underline text-brand-primary">Privacy</a>
      </div>
    </>
  );
};
