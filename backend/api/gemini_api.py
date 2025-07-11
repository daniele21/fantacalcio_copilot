import os
import logging
import google.generativeai as genai
from flask import Blueprint, request, current_app
from backend.api.utils import require_auth, jsonify_success, jsonify_error
import time

# --- GEMINI AI ENDPOINTS ---
gemini_api = Blueprint('gemini_api', __name__)

# Set up logging
logger = logging.getLogger("gemini_api")
logging.basicConfig(level=logging.INFO)

def get_limiter():
    try:
        return current_app.limiter
    except Exception:
        return None

GEMINI_MODEL = "gemini-2.5-flash-lite-preview-06-17"
ROLE_NAMES = {
    "GK": "Portieri",
    "DEF": "Difensori",
    "MID": "Centrocampisti",
    "FWD": "Attaccanti"
}

def get_gemini_api_key():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set.")
    return api_key

def get_gemini_model():
    api_key = get_gemini_api_key()
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(GEMINI_MODEL)

# --- Gemini pricing logic (ported from frontend) ---
GEMINI_PRICING = {
    "gemini-2.5-pro": {
        "input": {"<=200k_tokens": 1.25, ">200k_tokens": 2.5},
        "output": {"<=200k_tokens": 10.0, ">200k_tokens": 15.0},
        "unit": "per 1 million tokens"
    },
    "gemini-2.5-flash-lite-preview-06-17": {
        "input": {"default": 0.10, "audio": 0.50},
        "output": 0.40,
        "unit": "per 1 million tokens"
    },
    "gemini-2.5-flash": {
        "input": {"default": 0.30, "audio": 1.00},
        "output": 2.50,
        "unit": "per 1 million tokens"
    },
    "gemini-2.0-flash": {
        "input": {"default": 0.10, "audio": 0.70},
        "output": 0.40,
        "unit": "per 1 million tokens"
    }
}
GROUNDING_SEARCH_COST = 0.035  # USD per search

def compute_gemini_cost(model, input_tokens, output_tokens, input_type="default", grounding_searches=0):
    pricing = GEMINI_PRICING.get(model, {})
    if not pricing:
        return 0
    # Input cost
    if model == "gemini-2.5-pro":
        input_cost_per_m = pricing["input"]["<=200k_tokens"] if input_tokens <= 200_000 else pricing["input"][">200k_tokens"]
    else:
        input_cost_per_m = pricing["input"].get(input_type, pricing["input"].get("default", 0))
    input_cost = (input_tokens / 1_000_000) * input_cost_per_m
    # Output cost
    if model == "gemini-2.5-pro":
        output_cost_per_m = pricing["output"]["<=200k_tokens"] if output_tokens <= 200_000 else pricing["output"][">200k_tokens"]
    elif isinstance(pricing["output"], (int, float)):
        output_cost_per_m = pricing["output"]
    else:
        output_cost_per_m = pricing["output"].get("default", 0)
    output_cost = (output_tokens / 1_000_000) * output_cost_per_m
    grounding_cost = grounding_searches * GROUNDING_SEARCH_COST
    total = round(input_cost + output_cost + grounding_cost, 4)
    return total

@gemini_api.route('/aggregated-analysis', methods=['POST'])
@require_auth
def gemini_aggregated_analysis():
    limiter = get_limiter()
    if limiter:
        limiter.limit("20/minute")(lambda: None)()
    data = request.get_json() or {}
    players = data.get('players', [])
    role = data.get('role')
    if not isinstance(players, list) or not all(isinstance(p, dict) and 'name' in p for p in players):
        logger.warning(f"Malformed input for aggregated-analysis: {data}")
        return jsonify_error("bad_request", "Input non valido: 'players' deve essere una lista di oggetti giocatore.")
    if len(players) == 0:
        return jsonify_error("bad_request", "Nessun giocatore selezionato per l'analisi. Modifica i filtri.")
    role_name = f"del ruolo '{ROLE_NAMES.get(role, role)}'" if role else 'di tutti i ruoli'
    player_list = ', '.join([p.get('name', '(sconosciuto)') for p in players][:15])
    prompt = (
        "Agisci come un esperto di Fantacalcio che analizza le tendenze del mercato per un'asta.\n"
        "Usa la ricerca Google per trovare le analisi e i consigli più recenti sui giocatori di Serie A per il Fantacalcio.\n\n"
        f"Il segmento di mercato da analizzare è: {role_name}.\n"
        f"I giocatori in questo segmento includono: {player_list}.\n\n"
        "Basandoti sui risultati della ricerca web, fornisci un'analisi strategica concisa che includa:\n"
        "- Un riassunto del trend generale per questo segmento (es. 'costosi', 'sottovalutati', 'poche opzioni valide', ...).\n"
        "- I 2-3 giocatori 'più caldi' o consigliati dalle guide online, con una breve motivazione del perché.\n"
        "- Una potenziale 'trappola' o giocatore sopravvalutato da evitare.\n\n"
        "Rispondi in italiano. Formatta usando Markdown. Sii diretto e strategico. Attieniti al massimo alle prime 5 fonti"
    )
    try:
        start_time = time.time()
        model = get_gemini_model()
        response = model.generate_content(prompt, generation_config={"temperature": 0.1, "max_output_tokens": 600}, tools=[{"google_search": {}}])
        elapsed = time.time() - start_time
        logger.info(f"Gemini aggregated-analysis call time: {elapsed:.2f}s")
        text = response.text.strip() if hasattr(response, 'text') and response.text else ""
        # Extract sources if available
        sources = []
        try:
            grounding_metadata = getattr(response, 'candidates', [{}])[0].get('grounding_metadata')
            if grounding_metadata and 'grounding_chunks' in grounding_metadata:
                for chunk in grounding_metadata['grounding_chunks']:
                    web = chunk.get('web')
                    if web and web.get('uri') and web.get('title'):
                        sources.append({"uri": web['uri'], "title": web['title']})
        except Exception:
            pass
        # Extract cost if available
        usage_meta = getattr(response, 'usage_metadata', None)
        input_tokens = usage_meta.prompt_token_count if usage_meta and hasattr(usage_meta, 'prompt_token_count') else 0
        output_tokens = usage_meta.candidates_token_count if usage_meta and hasattr(usage_meta, 'candidates_token_count') else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)
        if not text:
            return jsonify_error("gemini_error", "L'analisi aggregata non è disponibile: il modello non ha fornito una risposta.")
        logger.info(f"Gemini aggregated-analysis called for role={role}, players={[p.get('name') for p in players]}")
        return jsonify_success({
            'result': {
                'analysis': text,
                'sources': sources
            },
            'cost': cost
        })
    except Exception as e:
        logger.error(f"Gemini aggregated-analysis error: {e}")
        return jsonify_error("gemini_error", f"Impossibile generare l'analisi aggregata: {str(e)}")

@gemini_api.route('/detailed-analysis', methods=['POST'])
@require_auth
def gemini_detailed_analysis():
    limiter = get_limiter()
    if limiter:
        limiter.limit("20/minute")(lambda: None)()
    data = request.get_json() or {}
    player_name = data.get('playerName')
    player_team = data.get('playerTeam')
    player_role = data.get('playerRole')
    if not (isinstance(player_name, str) and isinstance(player_team, str) and isinstance(player_role, str)):
        logger.warning(f"Malformed input for detailed-analysis: {data}")
        return jsonify_error("bad_request", "Input non valido: specificare nome, squadra e ruolo del giocatore.")
    prompt = (
        f"Sei un data analyst e un esperto di Fantacalcio di fama mondiale.\n"
        f"Usa la Ricerca Google per ottenere le informazioni più aggiornate possibili (statistiche recenti, stato di forma, ultime notizie) sul giocatore {player_name} ({player_team}, {player_role}).\n\n"
        "Basandoti sui dati trovati, restituisci SOLO un oggetto JSON che segua questa interfaccia TypeScript, senza aggiungere testo o markdown:\n"
        "```\ninterface DetailedAnalysisResult {\n    strengths: string[]; // Un array di 2-3 stringhe che descrivono i punti di forza chiave.\n    weaknesses: string[]; // Un array di 1-2 stringhe che descrivono i punti deboli o i rischi.\n    advice: string; // Una stringa singola con il verdetto finale e il consiglio strategico per l'asta.\n}\n```\nSii specifico, incisivo e vai dritto al punto. Evita frasi generiche. Rispondi in italiano in formato json valido."
    )
    try:
        start_time = time.time()
        model = get_gemini_model()
        response = model.generate_content(prompt, generation_config={"temperature": 0.5}, tools=[{"google_search": {}}])
        elapsed = time.time() - start_time
        logger.info(f"Gemini detailed-analysis call time: {elapsed:.2f}s")
        text = response.text.strip() if hasattr(response, 'text') and response.text else ""
        logger.info(f"[Gemini detailed-analysis raw response]: {text}")
        import re
        import json
        # Remove code fences if present (robust extraction)
        code_fence_pattern = r"^```(?:json)?\s*([\s\S]*?)\s*```$"
        code_fence_match = re.match(code_fence_pattern, text.strip(), re.IGNORECASE)
        if code_fence_match:
            json_str = code_fence_match.group(1).strip()
        else:
            json_str = text
        # Try direct JSON parse
        try:
            result = json.loads(json_str)
        except Exception:
            # Fallback: extract first JSON object with regex
            match = re.search(r'{[\s\S]*}', json_str)
            if match:
                try:
                    result = json.loads(match.group(0))
                except Exception:
                    return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di analisi valido (estrazione fallback fallita).")
            else:
                return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di analisi valido (nessun JSON trovato).")
        if not (isinstance(result, dict) and 'strengths' in result and 'weaknesses' in result and 'advice' in result):
            return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di analisi valido (chiavi mancanti).")
        # Extract cost if available
        usage_meta = getattr(response, 'usage_metadata', None)
        input_tokens = usage_meta.prompt_token_count if usage_meta and hasattr(usage_meta, 'prompt_token_count') else 0
        output_tokens = usage_meta.candidates_token_count if usage_meta and hasattr(usage_meta, 'candidates_token_count') else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)
        logger.info(f"Gemini detailed-analysis called for {player_name} ({player_team}, {player_role})")
        return jsonify_success({
            'result': result,
            'cost': cost
        })
    except Exception as e:
        logger.error(f"Gemini detailed-analysis error: {e}")
        return jsonify_error("gemini_error", f"Impossibile generare l'analisi dettagliata: {str(e)}")

@gemini_api.route('/bidding-advice', methods=['POST'])
@require_auth
def gemini_bidding_advice():
    limiter = get_limiter()
    if limiter:
        limiter.limit("20/minute")(lambda: None)()
    data = request.get_json() or {}
    player = data.get('player')
    my_team = data.get('myTeam', [])
    settings = data.get('settings', {})
    current_bid = data.get('currentBid')
    role_budget = data.get('roleBudget', {})
    all_players = data.get('allPlayers', [])  # Ensure always defined
    auction_log = data.get('auctionLog', {})  # Ensure always defined
    # Validate input
    if not (isinstance(player, dict) and isinstance(my_team, list) and isinstance(settings, dict) and isinstance(role_budget, dict)):
        logger.warning(f"Malformed input for bidding-advice: {data}")
        return jsonify_error("bad_request", "Input non valido per il consiglio sull'offerta.")
    if current_bid is None or not isinstance(current_bid, (int, float)):
        return jsonify_error("bad_request", "Input non valido: specificare l'offerta attuale come numero.")
    spent_budget = sum(p.get('purchasePrice', 0) for p in my_team)
    remaining_budget = settings.get('budget', 0) - spent_budget
    total_slots_left = sum(settings.get('roster', {}).values()) - len(my_team)
    avg_credit_per_slot = round(remaining_budget / total_slots_left) if total_slots_left > 0 else 0
    slots_filled_for_role = len([p for p in my_team if p.get('role') == player.get('role')])
    total_slots_for_role = settings.get('roster', {}).get(player.get('role'), 0)
    slots_left_for_role = total_slots_for_role - slots_filled_for_role
    spent_by_role = {}
    for p in my_team:
        r = p.get('role')
        spent_by_role[r] = spent_by_role.get(r, 0) + p.get('purchasePrice', 0)
    allocated_budget_for_role = round(settings.get('budget', 0) * role_budget.get(player.get('role'), 0) / 100)
    spent_on_role = spent_by_role.get(player.get('role'), 0)
    remaining_budget_for_role = allocated_budget_for_role - spent_on_role
    alternatives_list = []
    if all_players and auction_log:
        auctioned_ids = set(int(k) for k in auction_log.keys())
        alternatives_list = [p for p in all_players if p.get('id') != player.get('id') and p.get('role') == player.get('role') and p.get('id') not in auctioned_ids]
        alternatives_list = sorted(alternatives_list, key=lambda p: p.get('recommendation', 0), reverse=True)[:5]
    alternatives_str = ", ".join(f"{p.get('name')} ({p.get('team')})" for p in alternatives_list) if alternatives_list else "Nessuna alternativa di rilievo"
    prompt = (
        "Sei un copilota esperto per un'asta di Fantacalcio. Devo decidere se fare un'offerta per un giocatore. "
        "Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo, senza markdown, senza spiegazioni, senza commenti, senza blocchi di codice. "
        "Non includere alcun testo prima o dopo il JSON. "
        "L'oggetto JSON deve seguire questa interfaccia TypeScript:\n"
        "interface BiddingAdviceResult {\n    roleBudgetAdvice: string;\n    roleSlotAdvice: string;\n    recommendedPriceAdvice: string;\n    opportunityAdvice: string;\n    finalAdvice: string;\n}\n"
        f"1. GIOCATORE IN ESAME: Nome: {player.get('name', '(sconosciuto)')} ({player.get('role', '?')}, {player.get('team', '?')}) | Punteggio Copilot: {player.get('recommendation', '?')}/5\n"
        f"2. LA MIA SITUAZIONE DI BUDGET GLOBALE: Budget Rimanente Totale: {remaining_budget} crediti. Slot da riempire: {total_slots_left}.\n"
        f"3. IL MIO PIANO PER IL RUOLO '{ROLE_NAMES.get(player.get('role'), player.get('role'))}': Budget Allocato: {allocated_budget_for_role} crediti ({role_budget.get(player.get('role'), 0)}%). Spesa Attuale: {spent_on_role} crediti. Budget Rimanente per questo Ruolo: {remaining_budget_for_role} crediti. Slot da riempire per questo Ruolo: {slots_left_for_role}. Alternative ancora disponibili per questo ruolo: {alternatives_str}.\n"
        f"4. OFFERTA ATTUALE: Offerta: {current_bid} crediti.\n"
        "Analizza tutti questi dati per formulare i 5 consigli richiesti nel JSON. Per il consiglio sull'opportunità, valuta se l'offerta attuale è un affare, un prezzo giusto o un'esagerazione rispetto al valore e potenziale del giocatore. Per il verdetto finale, sii strategico, considera il trade-off tra la qualità del giocatore e la necessità di completare la squadra. Rispondi in italiano. Sii breve e conciso."
    )
    try:
        start_time = time.time()
        model = get_gemini_model()
        response = model.generate_content(prompt, generation_config={"temperature": 0.1, "max_output_tokens": 600})
        elapsed = time.time() - start_time
        logger.info(f"Gemini bidding-advice call time: {elapsed:.2f}s")
        text = response.text.strip() if hasattr(response, 'text') and response.text else ""
        logger.info(f"[Gemini bidding-advice raw response]: {text}")
        import re
        import json
        # Remove code fences if present
        code_fence_pattern = r"^```(?:json)?\s*([\s\S]*?)\s*```$"
        code_fence_match = re.match(code_fence_pattern, text.strip(), re.IGNORECASE)
        if code_fence_match:
            json_str = code_fence_match.group(1).strip()
        else:
            json_str = text
        # Try direct JSON parse
        try:
            result = json.loads(json_str)
        except Exception:
            # Fallback: extract first JSON object with regex
            match = re.search(r'{[\s\S]*}', json_str)
            if match:
                try:
                    result = json.loads(match.group(0))
                except Exception:
                    return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di consiglio valido (estrazione fallback fallita).")
            else:
                return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di consiglio valido (nessun JSON trovato).")
        required_keys = ["roleBudgetAdvice", "roleSlotAdvice", "recommendedPriceAdvice", "opportunityAdvice", "finalAdvice"]
        if not (isinstance(result, dict) and all(k in result for k in required_keys)):
            return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di consiglio valido (chiavi mancanti).")
        # Extract cost if available
        usage_meta = getattr(response, 'usage_metadata', None)
        input_tokens = usage_meta.prompt_token_count if usage_meta and hasattr(usage_meta, 'prompt_token_count') else 0
        output_tokens = usage_meta.candidates_token_count if usage_meta and hasattr(usage_meta, 'candidates_token_count') else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=0)
        logger.info(f"Gemini bidding-advice called for player={player.get('name')}, bid={current_bid}")
        return jsonify_success({
            'result': result,
            'cost': cost
        })
    except Exception as e:
        logger.error(f"Gemini bidding-advice error: {e}")
        return jsonify_error("gemini_error", f"Impossibile generare il consiglio sull'offerta: {str(e)}")
