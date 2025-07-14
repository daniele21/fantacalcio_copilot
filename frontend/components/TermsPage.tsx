import React from "react";

/**
 * TermsPage.tsx – Termini & Condizioni d'Uso
 * Versione 1.0 · 14 luglio 2025
 */

const TermsPage: React.FC = () => (
  <div className="max-w-3xl mx-auto py-16 px-4 leading-relaxed text-content-100">
    <h1 className="text-3xl font-bold mb-4">Termini & Condizioni di Servizio</h1>
    <p className="text-sm text-content-200 mb-8">Versione 1.0 · In vigore dal 14 luglio 2025</p>

    {/* 1. Oggetto */}
    <h2 className="text-xl font-semibold mt-6 mb-2">1. Oggetto</h2>
    <p>
      I presenti Termini regolano l’accesso e l’utilizzo di <strong>FantaCopilot</strong>
      (la “<strong>Piattaforma</strong>”), offerta da <strong>[Nome / Ragione Sociale] – P. IVA [xxx] – REA [xxx] – PEC [xxx]</strong>
      (il “<strong>Fornitore</strong>”). La Piattaforma è destinata esclusivamente a <strong>consumatori</strong> (persone fisiche che agiscono per scopi estranei alla propria attività professionale).
    </p>

    {/* 2. Account */}
    <h2 className="text-xl font-semibold mt-6 mb-2">2. Account e requisiti</h2>
    <ul className="list-disc ml-6 space-y-2">
      <li>Accesso tramite Google Sign‑In; l’Utente dichiara di avere almeno 16 anni.</li>
      <li>L’account è personale; vietati condivisione, rivendita, scraping e reverse engineering.</li>
      <li>Il Fornitore può sospendere l’account in caso di violazione sicurezza, abuso, frode o chargeback.</li>
    </ul>

    {/* 3. Prezzi / validità */}
    <h2 className="text-xl font-semibold mt-6 mb-2">3. Prezzi, pagamento e fatturazione</h2>
    <p>
      Prezzi in Euro IVA inclusa. Il pagamento è one‑off tramite Stripe; nessun rinnovo automatico.<br />
      Ricevuta/fattura elettronica inviata all’e‑mail dell’Utente al momento del pagamento.<br />
      <strong>Tutti i piani e i crediti restano validi fino al 31 dicembre 2025</strong>; oltre tale data il servizio potrà
      essere dismesso o rinnovato con nuove condizioni.
      <em>(Ai sensi dell’art. 51 §2 Codice del Consumo, prima del pagamento l’Utente visualizzerà un riepilogo dell’ordine con prezzo totale, funzionalità incluse e informazioni sul diritto di recesso.)</em>
    </p>

    {/* 4. Crediti AI */}
    <h2 className="text-xl font-semibold mt-6 mb-2">4. Crediti AI</h2>
    <ul className="list-disc ml-6 space-y-2">
      <li>I crediti sono utilizzabili fino al <strong>31 dicembre 2025</strong>; alla mezzanotte eventuali residui decadono senza rimborso, salvo quanto previsto al punto 9.</li>
      <li>Il consumo avviene all’esecuzione della chiamata AI o all’avvio di una sessione d’asta live ed è irreversibile.</li>
    </ul>

    {/* 5. Recesso e rimborsi */}
    <h2 className="text-xl font-semibold mt-6 mb-2">5. Recesso e rimborsi</h2>
    <p>
      L’Utente può recedere entro 14 giorni dall’acquisto inviando e‑mail a <a className="underline" href="mailto:support@fantacopilot.app">support@fantacopilot.app</a>
      con oggetto “Recesso” e l’ID ordine. Il rimborso sarà effettuato tramite Stripe entro 14 giorni dalla richiesta.
    </p>
    <ul className="list-disc ml-6 space-y-2">
      <li><strong>Nessun utilizzo</strong> → rimborso totale.</li>
      <li><strong>Utilizzo parziale</strong> → rimborso proporzionale ai crediti residui; la quota di accesso (<em>access fee</em>) non è rimborsabile.</li>
      <li><strong>Utilizzo completo</strong> o richiesta oltre il 31 dicembre 2025 → nessun rimborso (art. 59 l Codice Consumo).</li>
    </ul>
    <p className="mt-2 text-sm">
      Al checkout l’Utente fornisce consenso espresso all’esecuzione immediata del contenuto digitale e riconosce di perdere il diritto di recesso una volta iniziato l’utilizzo del servizio.
    </p>

    {/* 6. Limitazione responsabilità */}
    <h2 className="text-xl font-semibold mt-6 mb-2">6. Limitazione di responsabilità</h2>
    <p>
      Salvo dolo o colpa grave, il Fornitore non risponde di danni indiretti; la responsabilità complessiva è limitata alla
      somma pagata dall’Utente negli ultimi 12 mesi.
    </p>

    {/* 7. AI Disclaimer */}
    <h2 className="text-xl font-semibold mt-6 mb-2">7. Disclaimer Intelligenza Artificiale</h2>
    <p>I suggerimenti AI sono forniti “as‑is” e non costituiscono consulenza professionale né garanzia di risultato sportivo.</p>

    {/* 8. Proprietà intellettuale */}
    <h2 className="text-xl font-semibold mt-6 mb-2">8. Proprietà intellettuale</h2>
    <p>Codice, design e database sono proprietà del Fornitore; licenza d’uso limitata e non esclusiva all’Utente.</p>

    {/* 9. Disponibilità / cessazione */}
    <h2 className="text-xl font-semibold mt-6 mb-2">9. Disponibilità del servizio e cessazione</h2>
    <p>
      Il servizio è offerto in modalità “best‑effort”; possibili downtime per manutenzione o forza maggiore.<br />
      Se il servizio fosse cessato <em>prima</em> del 31 dicembre 2025, il Fornitore rimborserà i crediti AI non utilizzati.
    </p>

    {/* 10. Legge */}
    <h2 className="text-xl font-semibold mt-6 mb-2">10. Legge applicabile e foro competente</h2>
    <p>
      Il contratto è regolato dalla legge italiana. Per qualunque controversia sarà competente in via esclusiva il
      <strong>Tribunale del luogo di residenza o domicilio dell’Utente consumatore</strong>, ai sensi dell’art. 66‑bis Codice Consumo.
    </p>

    {/* 11. Modifiche */}
    <h2 className="text-xl font-semibold mt-6 mb-2">11. Modifiche ai Termini</h2>
    <p>Preavviso 30 giorni; l’Utente può recedere se non accetta le nuove condizioni.</p>

    {/* 12. Risoluzione controversie */}
    <h2 className="text-xl font-semibold mt-6 mb-2">12. Risoluzione delle controversie (ADR/ODR)</h2>
    <p>
      L’Utente può avviare una procedura alternativa (ADR) o utilizzare la piattaforma ODR europea:
      <a className="underline" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer"> ec.europa.eu/consumers/odr</a>.
    </p>

    {/* 13. Contatti */}
    <h2 className="text-xl font-semibold mt-6 mb-2">13. Contatti</h2>
    <p>E‑mail: <a className="underline" href="mailto:support@fantacopilot.app">support@fantacopilot.app</a> – PEC: [PEC]</p>

    <p className="text-xs mt-8 text-content-200">
      Ai sensi degli artt. 1341‑1342 c.c. l’Utente approva espressamente le clausole: 3 (scadenza piani), 4 (decadenza crediti), 5 (limitazioni rimborso), 6 (limitazione responsabilità), 9 (cessazione servizio), 10 (foro competente).
    </p>
  </div>
);

export default TermsPage;
