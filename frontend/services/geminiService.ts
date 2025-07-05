import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Player, Role, AggregatedAnalysisResult, GroundingSource, LeagueSettings, MyTeamPlayer, DetailedAnalysisResult, BiddingAdviceResult } from "../types";

// L'API Key viene gestita come variabile d'ambiente, come da requisiti.
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  // In un'app reale, potresti voler disabilitare le feature AI o mostrare un errore.
  // Per questo esempio, ci limitiamo a un avviso in console.
  console.warn("API Key di Gemini non trovata. Le funzionalità AI non saranno disponibili.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'Portieri', [Role.DEF]: 'Difensori', [Role.MID]: 'Centrocampisti', [Role.FWD]: 'Attaccanti' };

export const getAggregatedAnalysis = async (players: Player[], role: Role | null): Promise<AggregatedAnalysisResult> => {
    const errorResult = (analysis: string): AggregatedAnalysisResult => ({ analysis, sources: [] });

    if (!API_KEY) return errorResult("Analisi AI non disponibile (API Key mancante).");
    if (!Array.isArray(players) || players.length === 0) return errorResult("Nessun giocatore selezionato per l'analisi. Modifica i filtri.");

    const roleName = role ? `del ruolo '${ROLE_NAMES[role] || role}'` : 'di tutti i ruoli';
    const playerList = players.map(p => p?.name || "(sconosciuto)").slice(0, 15).join(', ');

    const prompt = `Agisci come un esperto di Fantacalcio che analizza le tendenze del mercato per un'asta.
Usa la ricerca Google per trovare le analisi e i consigli più recenti sui giocatori di Serie A per il Fantacalcio.

Il segmento di mercato da analizzare è: ${roleName}.
I giocatori in questo segmento includono: ${playerList}.

Basandoti sui risultati della ricerca web, fornisci un'analisi strategica concisa che includa:
- Un riassunto del trend generale per questo segmento (es. "costosi", "sottovalutati", "poche opzioni valide", ...).
- I 2-3 giocatori "più caldi" o consigliati dalle guide online, con una breve motivazione del perché.
- Una potenziale "trappola" o giocatore sopravvalutato da evitare.

Rispondi in italiano. Formatta usando Markdown. Sii diretto e strategico.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                temperature: 0.7,
                tools: [{googleSearch: {}}],
            }
        });
        
        // Log the full Gemini response and cost for debugging
        const cost = (response as any).usage ? (response as any).usage.totalTokens : undefined;
        console.log("Gemini response (AggregatedAnalysis):", response, "Cost (totalTokens):", cost);
        
        if (!response.text || typeof response.text !== 'string' || response.text.trim().length === 0) {
            let errorMessage = "L'analisi aggregata non è disponibile: il modello non ha fornito una risposta.";
            if (response.promptFeedback?.blockReason) {
                errorMessage = `L'analisi è stata bloccata per motivo di '${response.promptFeedback.blockReason}'.`;
                if (response.promptFeedback.blockReason === 'SAFETY') {
                    errorMessage += " Prova a modificare i filtri.";
                }
            }
            console.warn("Analisi aggregata fallita. Risposta da Gemini:", response);
            return errorResult(errorMessage);
        }

        const text = response.text.trim();
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        let sources: GroundingSource[] = [];
        if (groundingMetadata?.groundingChunks) {
            sources = groundingMetadata.groundingChunks
                .filter(chunk => chunk.web && chunk.web.uri && chunk.web.title)
                .map(chunk => ({
                    uri: chunk.web!.uri as string,
                    title: chunk.web!.title as string,
                }));
        }
        return { analysis: text, sources };
    } catch (error) {
        console.error("Errore durante la chiamata API per analisi aggregata:", error);
        if (error instanceof Error && error.message.includes('RESOURCE_EXHAUSTED')) {
            return errorResult("Impossibile generare l'analisi: Quota API superata. Controlla il tuo piano e la fatturazione sull'account Google AI.");
        }
        return errorResult("Impossibile generare l'analisi aggregata a causa di un errore di rete o del server.");
    }
};

export const getDetailedPlayerAnalysis = async (playerName: string, playerTeam: string, playerRole: Role): Promise<DetailedAnalysisResult> => {
  if (!API_KEY) {
    throw new Error("Analisi AI non disponibile (API Key mancante).");
  }

  const prompt = `Sei un data analyst e un esperto di Fantacalcio di fama mondiale.
Usa la Ricerca Google per ottenere le informazioni più aggiornate possibili (statistiche recenti, stato di forma, ultime notizie) sul giocatore ${playerName} (${playerTeam}, ${playerRole}).

Basandoti sui dati trovati, restituisci SOLO un oggetto JSON che segua questa interfaccia TypeScript, senza aggiungere testo o markdown:
\`\`\`
interface DetailedAnalysisResult {
    strengths: string[]; // Un array di 2-3 stringhe che descrivono i punti di forza chiave.
    weaknesses: string[]; // Un array di 1-2 stringhe che descrivono i punti deboli o i rischi.
    advice: string; // Una stringa singola con il verdetto finale e il consiglio strategico per l'asta.
}
\`\`\`
Sii specifico, incisivo e vai dritto al punto. Evita frasi generiche. Rispondi in italiano.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: {
          temperature: 0.5,
          responseMimeType: "application/json"
        }
    });

    // Log the full Gemini response and cost for debugging
    const cost = (response as any).usage ? (response as any).usage.totalTokens : undefined;
    console.log("Gemini response (DetailedPlayerAnalysis):", response, "Cost (totalTokens):", cost);

    if (!response.text || typeof response.text !== 'string') {
      throw new Error("La risposta dell'AI non è disponibile o non è in formato testo.");
    }
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const result = JSON.parse(jsonStr);
    if (result && Array.isArray(result.strengths) && Array.isArray(result.weaknesses) && typeof result.advice === 'string') {
        return result;
    }
    throw new Error("La risposta dell'AI non è un oggetto JSON di analisi valido.");

  } catch (error) {
    console.error("Errore durante la chiamata all'API di Gemini per l'analisi dettagliata:", error);
    if (error instanceof Error && error.message.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("Impossibile generare l'analisi: Quota API superata.");
    }
    throw new Error("Impossibile generare l'analisi AI dettagliata a causa di un errore di rete, del server o di un formato di risposta non valido.");
  }
};

export const getBiddingAdvice = async (player: Player, myTeam: MyTeamPlayer[], settings: LeagueSettings, currentBid: number, roleBudget: Record<Role, number>, allPlayers?: Player[], auctionLog?: Record<number, any>): Promise<BiddingAdviceResult> => {
    if (!API_KEY) {
        throw new Error("Consiglio AI non disponibile (API Key mancante).");
    }

    const spentBudget = myTeam.reduce((sum, p) => sum + p.purchasePrice, 0);
    const remainingBudget = settings.budget - spentBudget;
    
    const totalSlotsLeft = Object.values(settings.roster).reduce((sum, count) => sum + count, 0) - myTeam.length;
    const avgCreditPerSlot = totalSlotsLeft > 0 ? Math.round(remainingBudget / totalSlotsLeft) : 0;
    
    const slotsFilledForRole = myTeam.filter(p => p.role === player.role).length;
    const totalSlotsForRole = settings.roster[player.role];
    const slotsLeftForRole = totalSlotsForRole - slotsFilledForRole;

    const spentByRole = myTeam.reduce((acc, p) => {
        acc[p.role] = (acc[p.role] || 0) + p.purchasePrice;
        return acc;
    }, {} as Record<Role, number>);

    const allocatedBudgetForRole = Math.round((settings.budget * roleBudget[player.role]) / 100);
    const spentOnRole = spentByRole[player.role] || 0;
    const remainingBudgetForRole = allocatedBudgetForRole - spentOnRole;

    // --- NEW: Find alternative players still available for this role ---
    console.log('getBiddingAdvice allPlayers:', allPlayers ? allPlayers.length : allPlayers, 'auctionLog:', auctionLog ? Object.keys(auctionLog).length : auctionLog);
    let alternativesList: Player[] = [];
    if (allPlayers && auctionLog) {
        const auctionedIds = new Set(Object.keys(auctionLog).map(Number));
        alternativesList = allPlayers.filter(p => 
            p.id !== player.id &&
            p.role === player.role &&
            !auctionedIds.has(p.id)
        ).sort((a, b) => (b.recommendation ?? 0) - (a.recommendation ?? 0)).slice(0, 5);
        console.log('AI BiddingAdvice alternativesList:', alternativesList);
    }
    const alternativesStr = alternativesList.length > 0 ? alternativesList.map(p => `${p.name} (${p.team})`).join(", ") : "Nessuna alternativa di rilievo";

    const prompt = `Sei un copilota esperto per un'asta di Fantacalcio. Devo decidere se fare un'offerta per un giocatore. Analizza la situazione e restituisci SOLO un oggetto JSON con consigli strategici separati, seguendo questa interfaccia TypeScript, senza aggiungere testo o markdown:

\`\`\`
interface BiddingAdviceResult {
    roleBudgetAdvice: string; // Consiglio relativo allo stato del budget per questo ruolo. (Es: "Hai ancora molto budget per questo ruolo, puoi essere aggressivo.") [Breve descrizione]
    roleSlotAdvice: string; // Consiglio relativo all'appeal del giocatore in asta e le alternative disponibili ancora per questo ruolo. (Es: "Ti mancano X posti da riempire. Questo giocatore è uno dei migliori disponibili per il ruolo, ma ci sono anche queste alternative valide: xxxx, xxxx.") [Breve descrizione]
    recommendedPriceAdvice: string; // Consiglio sul prezzo massimo da spendere sulla basa dei giocatori gia in squadra attuale. (Es: "Considerando la tua rosa, un prezzo giusto sarebbe intorno a 75-80 crediti.") [Breve Descrizione]
    opportunityAdvice: string; // Consiglio sull'opportunità di mercato, tra prezzo asta, valore giocatore e alternative valide ancora disponibili. (Es: "A questo prezzo è un affare. Il suo potenziale giustifica una spesa anche maggiore.") [Breve Descrizione]
    finalAdvice: string; // Il consiglio finale e definitivo, secco e diretto, con un range massimo di puntata. (Es: "Sì, rilancia fino a 85. È un'occasione da cogliere, ma non superare questa soglia per non compromettere gli acquisti futuri.")
}
\`\`\`
**1. GIOCATORE IN ESAME:**
*   Nome: ${player.name || "(sconosciuto)"} (${player.role || "?"}, ${player.team || "?"})
*   Punteggio Copilot: ${player.recommendation ?? "?"}/5

**2. LA MIA SITUAZIONE DI BUDGET GLOBALE:**
*   Budget Rimanente Totale: ${remainingBudget} crediti.
*   Slot da riempire: ${totalSlotsLeft}.

**3. IL MIO PIANO PER IL RUOLO '${ROLE_NAMES[player.role] || player.role}':**
*   Budget Allocato: ${allocatedBudgetForRole} crediti (${roleBudget[player.role]}%).
*   Spesa Attuale: ${spentOnRole} crediti.
*   Budget Rimanente per questo Ruolo: ${remainingBudgetForRole} crediti.
*   Slot da riempire per questo Ruolo: **${slotsLeftForRole}**.
*   Alternative ancora disponibili per questo ruolo: ${alternativesStr}.

**4. OFFERTA ATTUALE:**
*   Offerta: ${currentBid} crediti.

Analizza tutti questi dati per formulare i 5 consigli richiesti nel JSON. Per il consiglio sull'opportunità, valuta se l'offerta attuale è un affare, un prezzo giusto o un'esagerazione rispetto al valore e potenziale del giocatore. Per il verdetto finale, sii strategico, considera il trade-off tra la qualità del giocatore e la necessità di completare la squadra. Rispondi in italiano.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                temperature: 0.8,
                maxOutputTokens: 600,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        
        // Log the full Gemini response and cost for debugging
        const cost = (response as any).usage ? (response as any).usage.totalTokens : undefined;
        console.log("Gemini response (BiddingAdvice):", response, "Cost (totalTokens):", cost);
        
        if (!response.text || typeof response.text !== 'string') {
            throw new Error("La risposta dell'AI non è disponibile o non è in formato testo.");
        }
        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }

        const result = JSON.parse(jsonStr);
        if (result && result.roleBudgetAdvice && result.roleSlotAdvice && result.recommendedPriceAdvice && result.opportunityAdvice && result.finalAdvice) {
            return result as BiddingAdviceResult;
        }
        throw new Error("La risposta dell'AI non è un oggetto JSON di consiglio valido.");

    } catch (error) {
        console.error("Errore durante la chiamata API per consiglio sull'offerta:", error);
        if (error instanceof Error && error.message.includes('RESOURCE_EXHAUSTED')) {
            throw new Error("Impossibile ottenere un consiglio: Quota API superata.");
        }
        throw new Error("Impossibile ottenere un consiglio a causa di un errore di rete, del server o di un formato di risposta non valido.");
    }
};