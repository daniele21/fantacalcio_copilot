import React from "react";
import { useCookie } from "../services/CookieContext";

/**
 * PrivacyPage.tsx – Informativa Privacy & Cookie completa
 * Versione 1.2 · aggiornata il 14 luglio 2025
 * NOTE: Sostituisci i campi tra [ ] con i tuoi dati reali prima del deploy.
 */

const PrivacyPage: React.FC = () => {
  const { setConsent } = useCookie();

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 text-content-100 leading-relaxed">
      {/* Logout/Cookie clear button */}
      <div className="flex items-center gap-3 bg-base-200 border border-base-300 rounded-lg p-4 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" /></svg>
        <div className="flex-1">
          <div className="font-semibold text-red-600">Logout & Cancella sessione</div>
          <div className="text-sm text-content-200">Questa azione ti disconnette subito e rimuove i cookie di sessione. Dovrai effettuare nuovamente il login per accedere.</div>
        </div>
        <button
          onClick={() => {
            if (window.confirm('Sei sicuro di voler uscire e cancellare la sessione?')) {
              setConsent("unset");
              localStorage.removeItem("idToken");
              window.location.reload();
            }
          }}
          className="btn btn-error btn-sm px-4 py-2 rounded font-semibold shadow hover:scale-105 transition-transform"
        >
          Esci e cancella sessione
        </button>
      </div>

      {/* HEADER */}
      <h1 className="text-3xl font-bold mb-2">Informativa sulla Privacy</h1>
      <p className="mb-8 text-sm text-content-200">
        Ultimo aggiornamento: 14 luglio 2025 – Versione 1.2
      </p>

      {/* 1 – TITOLARE */}
      <h2 className="text-xl font-semibold mt-6 mb-2">1. Titolare del trattamento</h2>
      <p>
        <strong>[Nome / Ragione Sociale]</strong>, con sede legale in <strong>[Indirizzo completo]</strong>,
        P. IVA/C.F. <strong>[xxx]</strong>, email 
        <a className="underline" href="mailto:privacy@fantacopilot.app"> privacy@fantacopilot.app</a>
        (di seguito, “<strong>Titolare</strong>”).
      </p>

      {/* 2 – DATI TRATTATI */}
      <h2 className="text-xl font-semibold mt-6 mb-2">2. Dati personali trattati</h2>
      <ul className="list-disc ml-6 space-y-2">
        <li><strong>Dati account</strong>: Google ID e indirizzo email forniti tramite Google Sign‑In.</li>
        <li><strong>Dati d’uso</strong>: rose, offerte d’asta, configurazioni di lega, crediti AI consumati.</li>
        <li><strong>Dati di pagamento</strong>: token di pagamento, importo, valuta, esito transazione (gestiti da Stripe Payments Europe Ltd.).</li>
        <li><strong>Dati tecnici</strong>: cookie di sessione, indirizzo IP, user‑agent, log di errore.</li>
      </ul>

      {/* 3 – FINALITÀ */}
      <h2 className="text-xl font-semibold mt-6 mb-2">3. Finalità e basi giuridiche</h2>
      <p className="mb-2"><strong>a)</strong> Creazione e gestione account — esecuzione di un contratto (art. 6‑1‑b GDPR).</p>
      <p className="mb-2"><strong>b)</strong> Pagamenti one‑off e crediti AI — esecuzione di un contratto.</p>
      <p className="mb-2"><strong>c)</strong> Adempimenti fiscali — obbligo legale (art. 6‑1‑c).</p>
      <p className="mb-2"><strong>d)</strong> Sicurezza e prevenzione frodi — legittimo interesse (art. 6‑1‑f).</p>

      {/* 4 – COOKIE */}
      <h2 className="text-xl font-semibold mt-6 mb-2">4. Cookie e storage locale</h2>
      <p className="mb-4">
        Utilizziamo solo <strong>cookie tecnici di sessione</strong> (es. <code>_session</code>) e voci di localStorage per:
      </p>
      <ul className="list-disc ml-6 space-y-2 mb-4">
        <li>mantenere l’utente autenticato dopo il login Google;</li>
        <li>ricordare la preferenza di interfaccia (dark‑mode);</li>
        <li>prevenire accessi fraudolenti (token anti‑CSRF).</li>
      </ul>
      <p>
        Non usiamo cookie di profilazione o analytics, quindi non è richiesto alcun banner di consenso. Puoi comunque
        eliminarli tramite le impostazioni del browser; dovrai però effettuare di nuovo il login.
      </p>

      {/* 5 – CONSERVAZIONE */}
      <h2 className="text-xl font-semibold mt-6 mb-2">5. Periodo di conservazione</h2>
      <p>
        Conserviamo i dati finché l’account rimane attivo. Dopo la cancellazione, i dati vengono anonimizzati o rimossi
        entro 30 giorni, salvo obblighi di legge (fatture 10 anni, log 12 mesi).
      </p>

      {/* 6 – DESTINATARI */}
      <h2 className="text-xl font-semibold mt-6 mb-2">6. Destinatari / Responsabili esterni</h2>
      <ul className="list-disc ml-6 space-y-3">
        <li>
          <strong>Google LLC</strong> — Google Sign‑In e Firebase (Hosting/Firestore)<br />
          <span className="text-sm">Privacy:&nbsp;
            <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              policies.google.com/privacy
            </a>&nbsp;— Trasferimento: SCC 2021/914</span>
        </li>
        <li>
          <strong>Stripe Payments Europe Ltd.</strong> — Elaborazione pagamenti<br />
          <span className="text-sm">Privacy:&nbsp;
            <a className="underline" href="https://stripe.com/it/privacy" target="_blank" rel="noopener noreferrer">
              stripe.com/it/privacy
            </a>&nbsp;— Trasferimento: SCC + TLS</span>
        </li>
        <li>
          <strong>Google AI Studio (Gemini API)</strong> — Elaborazione prompt AI<br />
          <span className="text-sm">Privacy:&nbsp;
            <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              policies.google.com/privacy
            </a>&nbsp;— Trasferimento: SCC 2021/914</span>
        </li>
      </ul>

      {/* 7 – TRASFERIMENTI */}
      <h2 className="text-xl font-semibold mt-6 mb-2">7. Trasferimenti extra‑UE</h2>
      <p>
        Eventuali trasferimenti verso gli Stati Uniti avvengono tramite le SCC della Commissione UE e misure supplementari
        (TLS, cifratura at‑rest).
      </p>

      {/* 8 – DIRITTI */}
      <h2 className="text-xl font-semibold mt-6 mb-2">8. Diritti dell’utente</h2>
      <p>
        Puoi esercitare accesso, rettifica, cancellazione, limitazione, portabilità o opposizione scrivendo a
        <a className="underline" href="mailto:privacy@fantacopilot.app"> privacy@fantacopilot.app</a>. Hai diritto di
        reclamo al Garante Privacy.
      </p>

      {/* 9 – MINORI */}
      <h2 className="text-xl font-semibold mt-6 mb-2">9. Minori</h2>
      <p>Il Servizio è destinato a utenti di età pari o superiore a 16 anni.</p>

      {/* 10 – SICUREZZA */}
      <h2 className="text-xl font-semibold mt-6 mb-2">10. Sicurezza</h2>
      <p>OAuth 2.0, regole Firestore basate sull’UID, backup cifrati su Google Cloud.</p>

      {/* 11 – MODIFICHE */}
      <h2 className="text-xl font-semibold mt-6 mb-2">11. Modifiche all’informativa</h2>
      <p>
        Aggiorneremo questa pagina e, in caso di modifiche sostanziali, invieremo notifica via email o banner in‑app.
      </p>

      {/* 12 – CONTATTI */}
      <h2 className="text-xl font-semibold mt-6 mb-2">12. Contatti</h2>
      <p>
        <a className="underline" href="mailto:privacy@fantacopilot.app">privacy@fantacopilot.app</a>
      </p>
    </div>
  );
};

export default PrivacyPage;
