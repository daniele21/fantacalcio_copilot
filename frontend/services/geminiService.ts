import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Player, Role, AggregatedAnalysisResult, GroundingSource, LeagueSettings, MyTeamPlayer, DetailedAnalysisResult, BiddingAdviceResult } from "../types";
import { computeGeminiCost, GEMINI_25_FLASH_LITE_PREVIEW_0617 } from "./geminiPricing";

// L'API Key viene gestita come variabile d'ambiente, come da requisiti.
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  // In un'app reale, potresti voler disabilitare le feature AI o mostrare un errore.
  // Per questo esempio, ci limitiamo a un avviso in console.
  console.warn("API Key di Gemini non trovata. Le funzionalità AI non saranno disponibili.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const ROLE_NAMES: Record<Role, string> = { [Role.GK]: 'Portieri', [Role.DEF]: 'Difensori', [Role.MID]: 'Centrocampisti', [Role.FWD]: 'Attaccanti' };

export const getAggregatedAnalysis = async (players: Player[], role: Role | null): Promise<{ result: AggregatedAnalysisResult, cost: number }> => {
    const errorResult = (analysis: string): { result: AggregatedAnalysisResult, cost: number } => ({ result: { analysis, sources: [] }, cost: 0 });
    if (!API_KEY) return errorResult("Analisi AI non disponibile (API Key mancante).");
    if (!Array.isArray(players) || players.length === 0) return errorResult("Nessun giocatore selezionato per l'analisi. Modifica i filtri.");
    const roleName = role ? `del ruolo '${ROLE_NAMES[role] || role}'` : 'di tutti i ruoli';
    const playerList = players.map(p => p?.name || "(sconosciuto)").slice(0, 15).join(', ');
    const prompt = `Agisci come un esperto di Fantacalcio che analizza le tendenze del mercato per un'asta.\nUsa la ricerca Google per trovare le analisi e i consigli più recenti sui giocatori di Serie A per il Fantacalcio.\n\nIl segmento di mercato da analizzare è: ${roleName}.\nI giocatori in questo segmento includono: ${playerList}.\n\nBasandoti sui risultati della ricerca web, fornisci un'analisi strategica concisa che includa:\n- Un riassunto del trend generale per questo segmento (es. "costosi", "sottovalutati", "poche opzioni valide", ...).\n- I 2-3 giocatori "più caldi" o consigliati dalle guide online, con una breve motivazione del perché.\n- Una potenziale "trappola" o giocatore sopravvalutato da evitare.\n\nRispondi in italiano. Formatta usando Markdown. Sii diretto e strategico. Attieniti al massimo alle prime 5 fonti`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_25_FLASH_LITE_PREVIEW_0617,
            contents: prompt,
            config: {
                temperature: 0.7,
                tools: [{googleSearch: {}}],
            }
        });
        // Extract token usage from usageMetadata (new Gemini API)
        const usageMeta = (response as any).usageMetadata;
        const inputTokens = usageMeta?.promptTokenCount ?? 0;
        const outputTokens = usageMeta?.candidatesTokenCount ?? 0;
        const groundingSearches = 1;
        const cost = computeGeminiCost(GEMINI_25_FLASH_LITE_PREVIEW_0617, inputTokens, outputTokens, "default", groundingSearches);
        if (!response.text || typeof response.text !== 'string' || response.text.trim().length === 0) {
            let errorMessage = "L'analisi aggregata non è disponibile: il modello non ha fornito una risposta.";
            if ((response as any).promptFeedback?.blockReason) {
                errorMessage = `L'analisi è stata bloccata per motivo di '${(response as any).promptFeedback.blockReason}'.`;
                if ((response as any).promptFeedback.blockReason === 'SAFETY') {
                    errorMessage += " Prova a modificare i filtri.";
                }
            }
            console.warn("Analisi aggregata fallita. Risposta da Gemini:", response);
            return errorResult(errorMessage);
        }
        const text = response.text.trim();
        const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
        let sources: GroundingSource[] = [];
        if (groundingMetadata?.groundingChunks) {
            sources = groundingMetadata.groundingChunks
                .filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title)
                .map((chunk: any) => ({
                    uri: chunk.web!.uri as string,
                    title: chunk.web!.title as string,
                }));
        }
        return { result: { analysis: text, sources }, cost };
    } catch (error) {
        console.error("Errore durante la chiamata API per analisi aggregata:", error);
        return errorResult("Impossibile generare l'analisi aggregata a causa di un errore di rete o del server.");
    }
};

export const getDetailedPlayerAnalysis = async (playerName: string, playerTeam: string, playerRole: Role): Promise<{ result: DetailedAnalysisResult, cost: number }> => {
  if (!API_KEY) {
    return { result: { strengths: [], weaknesses: [], advice: "Analisi AI non disponibile (API Key mancante)." }, cost: 0 };
  }
  const prompt = `Sei un data analyst e un esperto di Fantacalcio di fama mondiale.\nUsa la Ricerca Google per ottenere le informazioni più aggiornate possibili (statistiche recenti, stato di forma, ultime notizie) sul giocatore ${playerName} (${playerTeam}, ${playerRole}).\n\nBasandoti sui dati trovati, restituisci SOLO un oggetto JSON che segua questa interfaccia TypeScript, senza aggiungere testo o markdown:\n\`\`\`\ninterface DetailedAnalysisResult {\n    strengths: string[]; // Un array di 2-3 stringhe che descrivono i punti di forza chiave.\n    weaknesses: string[]; // Un array di 1-2 stringhe che descrivono i punti deboli o i rischi.\n    advice: string; // Una stringa singola con il verdetto finale e il consiglio strategico per l'asta.\n}\n\`\`\`\nSii specifico, incisivo e vai dritto al punto. Evita frasi generiche. Rispondi in italiano.`;
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_25_FLASH_LITE_PREVIEW_0617,
        contents: prompt,
        config: {
          temperature: 0.5,
          tools: [{googleSearch: {}}],
        }
    });
    // Use both usageMetadata (new API) and usage (fallback for old API)
    let inputTokens = 0, outputTokens = 0;
    if ((response as any).usageMetadata) {
      const usageMeta = (response as any).usageMetadata;
      inputTokens = usageMeta?.promptTokenCount ?? 0;
      outputTokens = usageMeta?.candidatesTokenCount ?? 0;
    } else if ((response as any).usage) {
      const usage = (response as any).usage;
      inputTokens = usage?.promptTokens ?? 0;
      outputTokens = usage?.candidatesTokens ?? 0;
    }
    const groundingSearches = 1;
    const cost = computeGeminiCost(GEMINI_25_FLASH_LITE_PREVIEW_0617, inputTokens, outputTokens, "default", groundingSearches);
    if (!response.text || typeof response.text !== 'string') {
      return { result: { strengths: [], weaknesses: [], advice: "La risposta dell'AI non è disponibile o non è in formato testo." }, cost };
    }
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    let result: DetailedAnalysisResult;
    try {
      result = JSON.parse(jsonStr);
    } catch (e) {
      return { result: { strengths: [], weaknesses: [], advice: "La risposta dell'AI non è un oggetto JSON di analisi valido." }, cost };
    }
    if (result && Array.isArray(result.strengths) && Array.isArray(result.weaknesses) && typeof result.advice === 'string') {
        return { result, cost };
    }
    return { result: { strengths: [], weaknesses: [], advice: "La risposta dell'AI non è un oggetto JSON di analisi valido." }, cost };
  } catch (error) {
    console.error("Errore durante la chiamata all'API di Gemini per l'analisi dettagliata:", error);
    return { result: { strengths: [], weaknesses: [], advice: "Impossibile generare l'analisi AI dettagliata a causa di un errore di rete, del server o di un formato di risposta non valido." }, cost: 0 };
  }
};

export const getBiddingAdvice = async (
  player: Player,
  myTeam: MyTeamPlayer[],
  settings: LeagueSettings,
  currentBid: number,
  roleBudget: Record<Role, number>,
  allPlayers?: Player[],
  auctionLog?: Record<number, any>
): Promise<{ result: BiddingAdviceResult, cost: number }> => {
    if (!API_KEY) {
        return { result: {
            roleBudgetAdvice: "Consiglio AI non disponibile (API Key mancante).",
            roleSlotAdvice: "",
            recommendedPriceAdvice: "",
            opportunityAdvice: "",
            finalAdvice: ""
        }, cost: 0 };
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
    let alternativesList: Player[] = [];
    if (allPlayers && auctionLog) {
        const auctionedIds = new Set(Object.keys(auctionLog).map(Number));
        alternativesList = allPlayers.filter(p => 
            p.id !== player.id &&
            p.role === player.role &&
            !auctionedIds.has(p.id)
        ).sort((a, b) => (b.recommendation ?? 0) - (a.recommendation ?? 0)).slice(0, 5);
    }
    const alternativesStr = alternativesList.length > 0 ? alternativesList.map(p => `${p.name} (${p.team})`).join(", ") : "Nessuna alternativa di rilievo";
    const prompt = `Sei un copilota esperto per un'asta di Fantacalcio. Devo decidere se fare un'offerta per un giocatore. Analizza la situazione e restituisci SOLO un oggetto JSON con consigli strategici separati, seguendo questa interfaccia TypeScript, senza aggiungere testo o markdown:\n\ninterface BiddingAdviceResult {\n    roleBudgetAdvice: string;\n    roleSlotAdvice: string;\n    recommendedPriceAdvice: string;\n    opportunityAdvice: string;\n    finalAdvice: string;\n}\n**1. GIOCATORE IN ESAME:**\n*   Nome: ${player.name || "(sconosciuto)"} (${player.role || "?"}, ${player.team || "?"})\n*   Punteggio Copilot: ${player.recommendation ?? "?"}/5\n\n**2. LA MIA SITUAZIONE DI BUDGET GLOBALE:**\n*   Budget Rimanente Totale: ${remainingBudget} crediti.\n*   Slot da riempire: ${totalSlotsLeft}.\n\n**3. IL MIO PIANO PER IL RUOLO '${ROLE_NAMES[player.role] || player.role}':**\n*   Budget Allocato: ${allocatedBudgetForRole} crediti (${roleBudget[player.role]}%).\n*   Spesa Attuale: ${spentOnRole} crediti.\n*   Budget Rimanente per questo Ruolo: ${remainingBudgetForRole} crediti.\n*   Slot da riempire per questo Ruolo: **${slotsLeftForRole}**.\n*   Alternative ancora disponibili per questo ruolo: ${alternativesStr}.\n\n**4. OFFERTA ATTUALE:**\n*   Offerta: ${currentBid} crediti.\n\nAnalizza tutti questi dati per formulare i 5 consigli richiesti nel JSON. Per il consiglio sull'opportunità, valuta se l'offerta attuale è un affare, un prezzo giusto o un'esagerazione rispetto al valore e potenziale del giocatore. Per il verdetto finale, sii strategico, considera il trade-off tra la qualità del giocatore e la necessità di completare la squadra. Rispondi in italiano.`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_25_FLASH_LITE_PREVIEW_0617,
            contents: prompt,
            config: {
                temperature: 0.8,
                maxOutputTokens: 600,
            }
        });
        // Compute cost if available
        let cost = 0;
        if ((response as any).usageMetadata) {
            const usageMeta = (response as any).usageMetadata;
            const inputTokens = usageMeta?.promptTokenCount ?? 0;
            const outputTokens = usageMeta?.candidatesTokenCount ?? 0;
            cost = computeGeminiCost(GEMINI_25_FLASH_LITE_PREVIEW_0617, inputTokens, outputTokens, "default", 0);
        } else if ((response as any).usage) {
            // fallback for older API
            const usage = (response as any).usage;
            const inputTokens = usage?.promptTokens ?? 0;
            const outputTokens = usage?.candidatesTokens ?? 0;
            cost = computeGeminiCost(GEMINI_25_FLASH_LITE_PREVIEW_0617, inputTokens, outputTokens, "default", 0);
        }
        if (!response.text || typeof response.text !== 'string') {
            return { result: {
                roleBudgetAdvice: "La risposta dell'AI non è disponibile o non è in formato testo.",
                roleSlotAdvice: "",
                recommendedPriceAdvice: "",
                opportunityAdvice: "",
                finalAdvice: ""
            }, cost };
        }
        let jsonStr = response.text.trim();
        // No need to strip code fences, should always be pure JSON
        let result: BiddingAdviceResult;
        try {
            result = JSON.parse(jsonStr);
        } catch (e) {
            return { result: {
                roleBudgetAdvice: "La risposta dell'AI non è un oggetto JSON di consiglio valido.",
                roleSlotAdvice: "",
                recommendedPriceAdvice: "",
                opportunityAdvice: "",
                finalAdvice: ""
            }, cost };
        }
        if (result && result.roleBudgetAdvice && result.roleSlotAdvice && result.recommendedPriceAdvice && result.opportunityAdvice && result.finalAdvice) {
            return { result, cost };
        }
        return { result: {
            roleBudgetAdvice: "La risposta dell'AI non è un oggetto JSON di consiglio valido.",
            roleSlotAdvice: "",
            recommendedPriceAdvice: "",
            opportunityAdvice: "",
            finalAdvice: ""
        }, cost };
    } catch (error) {
        console.error("Errore durante la chiamata API per consiglio sull'offerta:", error);
        return { result: {
            roleBudgetAdvice: "Impossibile ottenere un consiglio a causa di un errore di rete, del server o di un formato di risposta non valido.",
            roleSlotAdvice: "",
            recommendedPriceAdvice: "",
            opportunityAdvice: "",
            finalAdvice: ""
        }, cost: 0 };
    }
};