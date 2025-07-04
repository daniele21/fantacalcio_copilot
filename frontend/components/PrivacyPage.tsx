import React from "react";
import { useCookie } from "../services/CookieContext";

const PrivacyPage: React.FC = () => {
  const { setConsent } = useCookie();

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 text-content-100">
      <h1 className="text-3xl font-bold mb-6">Informativa sulla Privacy e Cookie</h1>
      <p className="mb-4">
        La tua privacy è importante per noi. Questa pagina descrive quali dati raccogliamo, come li utilizziamo
        e in che modo gestiamo i cookie su Fantacalcio Copilot.
      </p>
      {/* --- COOKIE SECTION --------------------------------------------------- */}
      <h2 className="text-xl font-semibold mt-8 mb-2">Cookie</h2>
      <p className="mb-4">
        Usiamo cookie tecnici indispensabili al funzionamento della piattaforma e, solo previo consenso,
        cookie di analisi (Google Analytics 4) per statistiche aggregate e anonimizzate.
      </p>
      <button
        onClick={() => setConsent("unset")}
        className="btn btn-outline btn-sm mb-4"
      >
        Rivedi le mie preferenze cookie
      </button>
      {/* --- DATA SECTION ----------------------------------------------------- */}
      <h2 className="text-xl font-semibold mt-8 mb-2">Dati raccolti</h2>
      <ul className="list-disc ml-6 space-y-2">
        <li>Email e Google ID per l’autenticazione.</li>
        <li>Preferenze di lega (budget, partecipanti) salvate su Firestore/SQLite.</li>
        <li>Eventi d’asta (giocatore, offerta, acquirente) per garantire la cronologia.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-8 mb-2">Finalità del trattamento</h2>
      <p className="mb-4">
        I dati vengono trattati esclusivamente per fornire le funzionalità dell’app, generare
        statistiche interne e garantire il recupero della sessione d’asta.
      </p>
      <h2 className="text-xl font-semibold mt-8 mb-2">Conservazione & sicurezza</h2>
      <p className="mb-4">
        Conserviamo i dati fintanto che l’account rimane attivo. Backup giornalieri, cifratura in transito
        (HTTPS) e a riposo (Firestore / SQLite crittografato).
      </p>
      <h2 className="text-xl font-semibold mt-8 mb-2">Diritti dell’utente</h2>
      <p className="mb-4">
        Puoi richiedere accesso, rettifica o cancellazione dei tuoi dati scrivendoci all’indirizzo sotto.
      </p>
      <h2 className="text-xl font-semibold mt-8 mb-2">Contatti</h2>
      <p>support@fantacopilot.app</p>
    </div>
  );
};

export default PrivacyPage;
