
import json
import os
import logging
import google.genai as genai
from google.genai import types
from flask import Blueprint, request, current_app, g
from .util import require_auth, jsonify_success, jsonify_error, get_db
import time
try:
    from google.cloud import firestore
except ImportError:
    firestore = None

# --- GEMINI AI ENDPOINTS ---
gemini_api = Blueprint('gemini_api', __name__)
grounding_tool = types.Tool(google_search=types.GoogleSearch())

# Set up logging
logger = logging.getLogger("gemini_api")
logging.basicConfig(level=logging.INFO)

def get_limiter():
    try:
        return current_app.limiter
    except Exception:
        return None

# GEMINI_MODEL = "gemini-2.5-flash-lite-preview-06-17"
GEMINI_MODEL = "gemini-2.5-flash"
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

api_key = get_gemini_api_key()
genai_client = genai.Client(api_key=api_key)

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
    if not isinstance(players, list):
        logger.warning(f"Malformed input for aggregated-analysis: {data}")
        return jsonify_error("bad_request", "Input non valido: 'players' deve essere una lista di oggetti giocatore.")
    if len(players) == 0:
        return jsonify_error("bad_request", "Nessun giocatore selezionato per l'analisi. Modifica i filtri.")
    role_name = f"del ruolo '{ROLE_NAMES.get(role, role)}'" if role else 'di tutti i ruoli'
    player_list = ', '.join([p for p in players])
    prompt = (
        f"RUOLO\n"
        f"Sei un data analyst ed esperto di Fantacalcio.\n\n"
        f"OBIETTIVO\n"
        f"Usa la Ricerca Google per ottenere informazioni aggiornate sui seguenti giocatori {player_list} "
        f"({role_name}) e sintetizzarle.\n\n"
        f"ISTRUZIONI DI RICERCA\n"
        f"- Dai priorità a notizie/statistiche degli ultimi 90 giorni, relativamente all'ultima stagione completa (2024/2025).\n"
        f"- Disambigua eventuali omonimi usando ruolo fornito.\n"
        f"- Non inventare numeri: se un dato non è certo, segnala l'incertezza.\n\n"
        f"CONSEGNA (OBBLIGATORIA)\n"
        f"Restituisci SOLO un SINGOLO oggetto JSON **valido**. Usa sempre doppi apici per chiavi e stringhe. Rispetta esattamente questa struttura:\n"
        f'{{{{\n'
        f'  "trend": "brevissima descrizione di questi giocatori ",\n'
        f'  "hot_players": ["...", "..."] # giocatori top da prendere tra quelli analizzati e per ognuno aggiungi il perche,\n'
        f'  "trap": "..." # potenziali trappole o giocatori sopravvalutati.\n'
        f'}}}}\n\n'
        f"VINCOLI DI CONTENUTO\n"
        f"- Indica sempre il periodo a cui si riferiscono i dati.\n"
        f"- Non inserire link o citazioni nel JSON.\n\n"
        f"LINGUA\n"
        f"Rispondi in italiano.\n\n"
        f"OUTPUT\n"
        f"Genera ora esclusivamente l'oggetto JSON VALIDO richiesto per il segmento {role_name}."
    )
    try:
        start_time = time.time()
        schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "trend": types.Schema(type=types.Type.STRING),
                "hot_players": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                "trap": types.Schema(type=types.Type.STRING),
            },
            required=["trend", "hot_players", "trap"],
        )
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            thinking_config=types.ThinkingConfig(thinking_budget=1024),
            # response_schema=schema,
            temperature=0.1,
            max_output_tokens=2048,
        )
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        elapsed = time.time() - start_time
        logger.info(f"Gemini aggregated-analysis call time: {elapsed:.2f}s")
        text = response.text
        logger.info(f"[Gemini aggregated-analysis raw response]: {text}")
        result = json.loads(text.replace('```json', '').replace('```', '').strip())
        if not (isinstance(result, dict) and 'trend' in result and 'hot_players' in result and 'trap' in result):
            return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di analisi valido (chiavi mancanti).")
        usage = getattr(response, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
        output_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)
        logger.info(f"Gemini aggregated-analysis called for role={role}, players={[p for p in players]}")
        return jsonify_success({'result': result, 'cost': cost})
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
    # prompt = (
    #     f"Sei un data analyst e un esperto di Fantacalcio di fama mondiale.\n"
    #     f"Usa la Ricerca Google per ottenere le informazioni più aggiornate possibili (statistiche recenti, stato di forma, ultime notizie) sul giocatore {player_name} ({player_team}, {player_role}).\n\n"
    #     "Basandoti sui dati trovati, restituisci SOLO un oggetto JSON VALIDO che segua questa interfaccia TypeScript, senza aggiungere testo o markdown:\n"
    #     "```\ninterface DetailedAnalysisResult {\n    strengths: string[]; // Un array di 2-3 stringhe che descrivono i punti di forza chiave.\n    weaknesses: string[]; // Un array di 1-2 stringhe che descrivono i punti deboli o i rischi.\n    advice: string; // Una stringa singola con il verdetto finale e il consiglio strategico per l'asta.\n}\n```\nSii specifico, incisivo e vai dritto al punto. Evita frasi generiche. Rispondi in italiano in formato json valido."
    # )
    prompt = (
        f"RUOLO\n"
        f"Sei un data analyst ed esperto di Fantacalcio.\n\n"

        f"OBIETTIVO\n"
        f"Usa la Ricerca Google per ottenere informazioni aggiornate su {player_name} "
        f"({player_team}, {player_role}) e sintetizzarle.\n\n"

        f"ISTRUZIONI DI RICERCA\n"
        f"- Dai priorità a notizie/statistiche degli ultimi 90 giorni; in mancanza, usa l'ultima stagione completa.\n"
        f"- Disambigua eventuali omonimi usando squadra e ruolo forniti.\n"
        f"- Non inventare numeri: se un dato non è certo, segnala l'incertezza nella sezione weaknesses.\n\n"

        f"CONSEGNA (OBBLIGATORIA)\n"
        f"Restituisci SOLO un SINGOLO oggetto JSON **valido**, senza testo extra, senza spiegazioni, senza markdown "
        f"e **senza backtick**. Usa sempre doppi apici per chiavi e stringhe. Rispetta esattamente questa struttura:\n"
        f'{{{{\n'
        f'  "strengths": ["...", "..."],\n'
        f'  "weaknesses": ["..."],\n'
        f'  "advice": "..." \n'
        f'}}}}\n\n'

        f"VINCOLI DI CONTENUTO\n"
        f"- strengths: 2–3 frasi brevi e specifiche (forma recente, titolarità, infortuni recuperati, minuti, rigori, ruolo tattico, dati oggettivi come gol/assist/xG).\n"
        f"- weaknesses: 1–2 frasi su rischi/limiti (rotazione, infortunio, calo forma, trasferimento incerto, 'dati recenti limitati/contraddittori' se necessario).\n"
        f"- advice: una sola frase operativa e concisa per l'asta (es.: prezzi/strategia/asta, livello di rischio/ritorno atteso).\n"
        f"- Indica sempre il periodo a cui si riferiscono i dati (es. 'ultime 10 presenze', 'stagione 2024/25').\n"
        f"- Non inserire link o citazioni nel JSON.\n\n"

        f"LINGUA\n"
        f"Rispondi in italiano.\n\n"

        f"OUTPUT\n"
        f"Genera ora esclusivamente l'oggetto JSON VALIDO richiesto per {player_name}."
    )
    try:
        start_time = time.time()
        
        schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "strengths": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                "weaknesses": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                "advice": types.Schema(type=types.Type.STRING),
            },
            required=["strengths", "weaknesses", "advice"],
        )
        
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            # response_mime_type="application/json",
            response_schema=schema,
            temperature=0.5,
        )
        
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        
        elapsed = time.time() - start_time
        
        logger.info(f"Gemini detailed-analysis call time: {elapsed:.2f}s")
        text = response.text
        logger.info(f"[Gemini detailed-analysis raw response]: {text}")
        
        result = json.loads(text)
        if not (isinstance(result, dict) and 'strengths' in result and 'weaknesses' in result and 'advice' in result):
            return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di analisi valido (chiavi mancanti).")

        usage = getattr(response, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
        output_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0

        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)

        logger.info(f"Gemini detailed-analysis called for {player_name} ({player_team}, {player_role})")
        return jsonify_success({'result': result, 'cost': cost})
        
        
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
    initial_budget = data['settings']['budget']
    participant_status = get_participants_status_by_position(auction_log, initial_budget, player['position']) 

    # --- 1) Pre-check credits ---
    import os
    from flask import g
    db = get_db()
    sub = g.user_id
    db_type = os.getenv('DB_TYPE', 'sqlite')
    if db_type == 'firestore':
        user_ref = db.collection('users').document(sub)
        doc = user_ref.get()
        if not doc.exists or doc.to_dict().get('ai_credits', 0) < 1:
            return jsonify_error('no_credits', 'Crediti AI esauriti', 403)
    else:
        row = db.execute("SELECT ai_credits, api_cost, spent_credits FROM users WHERE google_sub = ?", (sub,)).fetchone()
        if not row or row['ai_credits'] < 1:
            return jsonify_error('no_credits', 'Crediti AI esauriti', 403)

    # --- 2) Call Gemini (existing logic) ---
    spent_budget = sum(p.get('purchasePrice', 0) for p in my_team)
    remaining_budget = settings.get('budget', 0) - spent_budget
    total_slots_left = sum(settings.get('roster', {}).values()) - len(my_team)
    avg_credit_per_slot = round(remaining_budget / total_slots_left) if total_slots_left > 0 else 0
    slots_filled_for_role = len([p for p in my_team if p.get('position') == player.get('position')])
    total_slots_for_role = settings.get('roster', {}).get(player.get('position'), 0)
    slots_left_for_role = total_slots_for_role - slots_filled_for_role
    spent_by_role = {}
    for p in my_team:
        r = p.get('position')
        spent_by_role[r] = spent_by_role.get(r, 0) + p.get('purchasePrice', 0)
    allocated_budget_for_role = round(settings.get('budget', 0) * role_budget.get(player.get('position'), 0) / 100)
    spent_on_role = spent_by_role.get(player.get('position'), 0)
    remaining_budget_for_role = allocated_budget_for_role - spent_on_role
    alternatives_list = []
    if all_players and auction_log:
        auctioned_ids = set(int(k) for k in auction_log.keys())
        alternatives_list = [p for p in all_players if p.get('id') != player.get('id') and p.get('position') == player.get('position') and p.get('id') not in auctioned_ids]
        alternatives_list = sorted(alternatives_list, key=lambda p: p.get('stars', 0), reverse=True)[:5]
    alternatives_str = ", ".join(f"{p.get('player_name')} ({p.get('current_team')})" for p in alternatives_list) if alternatives_list else "Nessuna alternativa di rilievo"

    prompt = (
    "CONTESTO\n"
    "Sei un copilota esperto per un'asta di Fantacalcio. Devo decidere se fare un'offerta per un giocatore.\n\n"

    "DATI\n"
    f"Giocatore: {player['player_name']} ({ROLE_NAMES.get(player['position'], player['position'])}, {player['current_team']})\n"
    f"Punteggio Copilot: {player['stars']}/5\n"
    f"Budget iniziale: {initial_budget} crediti | Budget globale rimanente: {remaining_budget} crediti | Slot totali da riempire: {total_slots_left}\n"
    f"Strategia personale di allocazione del budget per ruolo: "
    f"'{ROLE_NAMES.get(player['position'], player['position'])}': "
    f"previsti {allocated_budget_for_role} crediti ({role_budget.get(player['position'], 0)}%), "
    f"spesi {spent_on_role} crediti, rimanenti {remaining_budget_for_role} crediti, "
    f"giocatori ancora da prendere per questo ruolo: {slots_left_for_role}. "
    f"Alternative valide ancora disponibili a parità di ruolo: {alternatives_str}\n"
    f"Offerta attuale sul giocatore: {current_bid} crediti\n\n"

    "OBIETTIVO\n"
    "Fornire 5 consigli che permettono di capire se ha senso o no comprare questo giocatore, quindi se ha senso" +
    "proseguire con l'offerta o se è meglio fermarsi o passare, tenendo in considerazione: budget attuale, slot ancora da riempire, opportunità costo/giocatore, prezzo consigliato di acquisto." +
    f"Tieni in considerazione lo stato di questo reparto degli altri partecipanti: {participant_status}\n\n"

    "REGOLE DI COERENZA\n"
    "- Qualsiasi prezzo consigliato deve rispettare TUTTI i vincoli: "
    "non superare il budget per il ruolo, lasciare ≥1 credito per ciascuno degli slot del ruolo ancora da riempire, "
    "non superare il budget globale rimanente e non essere inferiore all'offerta attuale se consigli di proseguire.\n"
    "- Se i vincoli non permettono rilanci sostenibili, consiglia di passare e imposta prezzo raccomandato a 0.\n"
    "- Sii concreto: riferisciti a ruolo e team forniti. Evita numeri non giustificati.\n\n"

    "FORMA DELL'OUTPUT (OBBLIGATORIA)\n"
    "Rispondi SOLO con un UNICO oggetto JSON VALIDO, senza testo extra, senza markdown, senza spiegazioni, "
    "senza commenti e senza blocchi di codice. Non includere nulla prima o dopo il JSON. "
    "Usa sempre doppi apici per chiavi e stringhe; nessuna virgola finale.\n"
    "L'oggetto JSON deve avere ESATTAMENTE queste chiavi (tutte stringhe):\n"
    "{\n"
    # "  roleBudgetAdvice: string;\n"
    # "  roleSlotAdvice: string;\n"
    # "  recommendedPriceAdvice: string;\n"
    "  opportunityAdvice: string;\n"
    "  participantAdvice: string;\n"
    "  finalAdvice: string;\n"
    "}\n\n"

    "LINEE GUIDA PER I CAMPI\n"
    # "- roleBudgetAdvice: 1 frase (≤160 caratteri) su come gestire il budget del ruolo in relazione a quanto allocato/speso/rimanente.\n"
    # "- roleSlotAdvice: 1 frase (≤160 caratteri) su come preservare crediti per gli slot residui del ruolo.\n"
    # "- recommendedPriceAdvice: 1 frase (≤160 caratteri) con un numero intero o range di prezzo consigliato per il giocatore in asta, considerando anche lo stato degli altri partecipanti.\n"
    "- opportunityAdvice: INIZIA con una di queste etichette: \"Affare:\", \"Prezzo giusto:\", \"Esagerazione:\" seguita da breve motivazione (≤160 caratteri).\n"
    "- participantAdvice: 1 frase (≤200 caratteri) sullo stato attuale del reparto degli altri partecipanti e come influisce sulla decisione.\n"
    "- finalAdvice: INIZIA con \"Rilancia fino a X\", \"Fermati a X\" o \"Passa\"; sii strategico e conciso (≤160 caratteri)." + 
    "esempio di finalAdvice: " +
    "Puoi spingerti a XX Cr: resteresti con XX Cr (XX % budget) e un solo slot ATT/CEN/DIF/POR da coprire. Solo XXX e XXX possono superarti (> XX Cr di budget ruolo).\n\n"

    "LINGUA\n"
    "Rispondi in italiano.\n"
    )
    try:
        start_time = time.time()
        schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "opportunityAdvice": types.Schema(type=types.Type.STRING),
                "participantAdvice": types.Schema(type=types.Type.STRING),
                "finalAdvice": types.Schema(type=types.Type.STRING),
            },
            required=["opportunityAdvice", "participantAdvice", "finalAdvice"],
        )
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            thinking_config=types.ThinkingConfig(thinking_budget=32),
            response_schema=schema,
            temperature=0.1,
            max_output_tokens=512,
        )
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        elapsed = time.time() - start_time
        logger.info(f"Gemini bidding-advice call time: {elapsed:.2f}s")
        text = response.text.replace('```json', '').replace('```', '').strip()
        logger.info(f"[Gemini bidding-advice raw response]: {text}")
        result = json.loads(text)
        required_keys = ["opportunityAdvice", "participantAdvice", "finalAdvice"]
        if not (isinstance(result, dict) and all(k in result for k in required_keys)):
            return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON di consiglio valido (chiavi mancanti).")
        usage_meta = getattr(response, 'usage_metadata', None)
        input_tokens = getattr(usage_meta, 'prompt_token_count', 0) if usage_meta else 0
        output_tokens = getattr(usage_meta, 'candidates_token_count', 0) if usage_meta else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)

        # --- 3) On success, decrement credits atomically ---
        new_credits = None
        if db_type == 'firestore':
            user_ref.update({
                'ai_credits': firestore.Increment(-1),
                'api_cost': firestore.Increment(cost),
                'spent_credits': firestore.Increment(1),
            })
            new_credits = doc.to_dict().get('ai_credits', 0) - 1
        else:
            cur = db.execute(
                "UPDATE users SET ai_credits = ai_credits - 1, api_cost = api_cost + ?, spent_credits = spent_credits + 1 "
                "WHERE google_sub = ? AND ai_credits > 0",
                (cost, sub)
            )
            db.commit()
            if cur.rowcount == 0:
                return jsonify_error('no_credits', 'Crediti AI esauriti', 403)
            new_credits = row['ai_credits'] - 1

        logger.info(f"Gemini bidding-advice called for player={player.get('name')}, bid={current_bid}, ai_credits={new_credits}")
        return jsonify_success({
            'result': result,
            'cost': cost,
            'ai_credits': new_credits
        })
    except Exception as e:
        logger.error(f"Gemini bidding-advice error: {e}")
        return jsonify_error("gemini_error", f"Impossibile generare il consiglio sull'offerta: {str(e)}")

def get_participants_status_by_position(auction_log, starting_budget=500, position=None):
    """
    Returns a dict:
    {
      'Giovanni': {
        'players': {
          'ATT': [ {player_name, purchasePrice, position}, ... ],
          ...
        },
        'remaining_budget': int
      },
      ...
    }
    Excludes 'Io' from the result.
    """
    participants = {}
    for entry in auction_log.values():
        buyer = entry['buyer']
        if buyer.lower() == 'io':
            continue
        if buyer not in participants:
            participants[buyer] = {'players': {}, 'spent': 0}
        pos = entry['position']
        # Always initialize the list for this position
        if pos not in participants[buyer]['players']:
            participants[buyer]['players'][pos] = []
        # Only append if position matches filter (or no filter)
        if position is None or pos == position:
            participants[buyer]['players'][pos].append({
                'player_name': entry['player_name'],
                'purchasePrice': entry['purchasePrice'],
                'position': pos
            })
            participants[buyer]['spent'] += entry['purchasePrice']

    result = {}
    for buyer, data in participants.items():
        # Optionally, filter out empty lists if a position filter is used
        players = data['players']
        if position is not None:
            players = {k: v for k, v in players.items() if k == position and v}
        result[buyer] = {
            'players': players,
            'remaining_budget': starting_budget - data['spent']
        }
    return result
