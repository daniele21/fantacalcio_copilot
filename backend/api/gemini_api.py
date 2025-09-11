# --- Probable Lineups Endpoint ---

import json
import os
import logging
import google.genai as genai
from google.genai import types
from flask import Blueprint, request, current_app, g

from backend.api.routes.giocatori import get_user_team_cached
from .util import require_auth, jsonify_success, jsonify_error, get_db
from backend.api.utils.cache import cache_api_lru
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
GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_POWER_MODEL = "gemini-2.5-flash"
ROLE_NAMES = {
    "POR": "Portieri",
    "DIF": "Difensori", 
    "CEN": "Centrocampisti",
    "ATT": "Attaccanti",
    # Legacy mapping for backwards compatibility
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
    "gemini-2.5-flash-lite": {
        "input": {"default": 0.10, "audio": 1.00},
        "output": 0.40,
        "unit": "per 1 million tokens"
    },
    "gemini-2.0-flash": {
        "input": {"default": 0.10, "audio": 0.70},
        "output": 0.40,
        "unit": "per 1 million tokens"
    }
}
GROUNDING_SEARCH_COST = 0.035  # USD per search

# Formation slots mapping
MODULE_SLOTS = {
    "3-4-3": {"POR": 1, "DIF": 3, "CEN": 4, "ATT": 3},
    "4-3-3": {"POR": 1, "DIF": 4, "CEN": 3, "ATT": 3},
    "4-4-2": {"POR": 1, "DIF": 4, "CEN": 4, "ATT": 2},
    "3-5-2": {"POR": 1, "DIF": 3, "CEN": 5, "ATT": 2},
}


@gemini_api.route('/probable-lineups', methods=['POST'])
@require_auth
def gemini_probable_lineups():
    """
    Given a Serie A matchday (giornata), returns the probable lineups for all teams using Gemini and Google Search grounding.
    Expects JSON: { "matchday": <int>, "season": <str, optional> }
    """
    limiter = get_limiter()
    if limiter:
        limiter.limit("10/minute")(lambda: None)()
    data = request.get_json() or {}
    matchday = data.get('matchday')
    season = data.get('season') or '2025/2026'
    player_names = data.get('player_names', [])
    if not isinstance(matchday, int) or not (1 <= matchday <= 38):
        return jsonify_error("bad_request", "'matchday' deve essere un intero tra 1 e 38.")
    # Log or use player_names as needed
    if player_names:
        logger.info(f"Received player_names for probable-lineups: {player_names}")

    # Use matchday as document id and check if created today
    from datetime import datetime
    today_str = datetime.now().strftime('%Y-%m-%d')
    db_type = os.getenv('DB_TYPE', 'sqlite')
    google_sub = request.args.get('google_sub') or g.user_id
    db = get_db()

    # Check which players need fresh info (missing or outdated)
    players_to_update = []
    existing_fresh_data = {}
    
    if db_type == 'firestore' and firestore is not None:
        doc_ref = db.collection('probable_lineups').document(str(matchday))
        doc = doc_ref.get()
        if doc.exists:
            row = doc.to_dict()
            existing_result = row.get('result', {})
            
            # Check each player to see if their info is fresh (from today)
            for player_info in player_names:
                player_name = player_info.get('player_name')
                if player_name and player_name in existing_result:
                    player_data = existing_result[player_name]
                    updated_at = player_data.get('updated_at', '')
                    # Check if updated today (compare date part only)
                    if updated_at.startswith(today_str):
                        existing_fresh_data[player_name] = player_data
                    else:
                        players_to_update.append(player_name)
                else:
                    players_to_update.append(player_name)
            
            # If all players have fresh data, return cached result
            if not players_to_update:
                logger.info(f"All player info is fresh for matchday {matchday}, returning cached result")
                # get_user_team_cached(google_sub, db)
                return jsonify_success({'result': existing_result, 'cost': 0, 'cached': True})
        else:
            # No existing document, need to fetch all players
            players_to_update = [p.get('player_name') for p in player_names if p.get('player_name')]
    else:
        # For SQLite or when Firestore is not available, always update all players
        players_to_update = [p.get('player_name') for p in player_names if p.get('player_name')]

    if not players_to_update:
        logger.info(f"No players to update for matchday {matchday}")
        return jsonify_success({'result': existing_fresh_data, 'cost': 0, 'cached': True})
    
    logger.info(f"Players to update: {players_to_update} (out of {len(player_names)} total players)")

    # Not cached, run Gemini
    # Get current month for more precise search terms
    from datetime import datetime
    current_month = datetime.now().strftime('%B %Y')  # e.g., "September 2025"
    current_month_it = {
        'January': 'gennaio', 'February': 'febbraio', 'March': 'marzo', 'April': 'aprile',
        'May': 'maggio', 'June': 'giugno', 'July': 'luglio', 'August': 'agosto',
        'September': 'settembre', 'October': 'ottobre', 'November': 'novembre', 'December': 'dicembre'
    }.get(datetime.now().strftime('%B'), datetime.now().strftime('%B').lower())
    current_year = datetime.now().year
    
    prompt = f'''
        Sei un esperto di Fantacalcio e Serie A. Il tuo compito è estrarre informazioni sulle probabili formazioni ESCLUSIVAMENTE per la stagione CORRENTE 2025/26.
        
        VINCOLI TEMPORALI CRITICI - FILTRA RIGOROSAMENTE:
        - Cerca SOLO informazioni pubblicate dopo il 15 agosto 2025 (inizio stagione 2025/26)
        - RIFIUTA qualsiasi dato delle stagioni 2024/25, 2023/24 o precedenti
        - Concentrati su notizie di {current_month_it} {current_year} per la giornata {matchday}
        - Se una fonte menziona stagioni passate, IGNORALA completamente
        
        RICERCA GOOGLE - USA QUESTI TERMINI SPECIFICI:
        - "probabili formazioni {matchday}a giornata serie a 2025/26 {current_month_it} {current_year}"
        - "formazioni ufficiali serie a giornata {matchday} stagione 2025/26"
        - "titolari {matchday}a giornata settembre 2025 serie a"
        - "convocati {matchday}a giornata 2025/26 serie a"
        - "infortunati squalificati serie a giornata {matchday} 2025/26"
        
        FONTI ATTENDIBILI (solo da queste):
        - fantacalcio.it (cerca nelle sezioni probabili formazioni 2025/26)
        - gazzetta.it (filtra per stagione corrente)
        - corrieredellosport.it (solo notizie recenti)
        - tuttosport.com (solo articoli post-agosto 2025)
        - sky.it/sport (solo contenuti stagione 2025/26)
        
        GIOCATORI DA ANALIZZARE: {players_to_update}
        
        Per ogni giocatore, estrai SOLO informazioni della stagione 2025/26 per queste chiavi:
        - squadra: nome squadra attuale (stagione 2025/26)
        - giocatore: nome completo del giocatore
        - titolare: true/false (basato SOLO su fonti stagione 2025/26)
        - prob_titolare: probabilità (0-1) di titolarità per giornata {matchday} stagione 2025/26
        - prob_subentro: probabilità (0-1) di subentro per giornata {matchday} stagione 2025/26
        - ballottaggio: eventuale ballottaggio menzionato per giornata {matchday} 2025/26, altrimenti null
        - note: informazioni SPECIFICHE per giornata {matchday} stagione 2025/26
        - forma: forma attuale basata SOLO su prestazioni stagione 2025/26
        - news: notizie recenti relative alla giornata {matchday} stagione 2025/26
        
        VALIDAZIONE RIGOROSA:
        - Se non trovi informazioni SPECIFICHE per la stagione 2025/26 di un giocatore:
          * prob_titolare: 0.5
          * note: "Nessun dato specifico trovato per stagione 2025/26 giornata {matchday}"
          * forma: "Da monitorare - informazioni stagione corrente limitate"
          * news: "Nessuna news specifica per giornata {matchday} stagione 2025/26"
        
        - NON usare dati delle stagioni precedenti anche se sembrano recenti
        - NON inventare probabilità se non supportate da fonti 2025/26
        - Se un articolo menziona "la scorsa stagione" o anni precedenti, IGNORALO
        
        ESEMPIO OUTPUT:
        {{ "giocatori": [ 
            {{ 
                "squadra": "Inter", 
                "giocatore": "Yann Sommer", 
                "titolare": true, 
                "prob_titolare": 0.95, 
                "prob_subentro": 0.02, 
                "ballottaggio": null, 
                "note": "Titolare confermato per giornata {matchday} stagione 2025/26 secondo Gazzetta", 
                "forma": "Ottima - 2 clean sheet nelle prime giornate 2025/26", 
                "news": "Confermato tra i pali per la sfida di giornata {matchday} - {current_month_it} 2025" 
            }} 
        ] }}
        
        Rispondi SOLO con JSON valido. Usa doppi apici. Lingua italiana.
        '''
    try:
        start_time = time.time()
        schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "giocatori": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "squadra": types.Schema(type=types.Type.STRING),
                            "giocatore": types.Schema(type=types.Type.STRING),
                            "titolare": types.Schema(type=types.Type.BOOLEAN),
                            "prob_titolare": types.Schema(type=types.Type.NUMBER),
                            "prob_subentro": types.Schema(type=types.Type.NUMBER),
                            "ballottaggio": types.Schema(type=types.Type.STRING),
                            "note": types.Schema(type=types.Type.STRING),
                            "forma": types.Schema(type=types.Type.STRING),
                            "news": types.Schema(type=types.Type.STRING),
                        },
                        required=["squadra", "giocatore", "titolare", "prob_titolare", "prob_subentro", "ballottaggio", "note", "forma", "news"]
                    )
                )
            },
            required=["giocatori"]
        )
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            # thinking_config=types.ThinkingConfig(thinking_budget=1024),
            response_schema=schema,
            temperature=0.0,
            max_output_tokens=None,
        )
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        elapsed = time.time() - start_time
        # logger.info(f"Gemini probable-lineups call time: {elapsed:.2f}s")
        text = response.text
        # logger.info(f"[Gemini probable-lineups raw response]: {text}")
        result = json.loads(text.replace('```json', '').replace('```', '').strip())
        if not (isinstance(result, dict) and 'giocatori' in result):
            return jsonify_error("gemini_error", "La risposta dell'AI non è un oggetto JSON valido con la chiave 'giocatori'.")


        # Transform giocatori array into dict keyed by player_name, with required structure
        from datetime import datetime
        giocatori_list = result['giocatori']
        now_iso = datetime.now().isoformat()
        giocatori_by_name = {}
        for player in giocatori_list:
            nome = player.get('giocatore')
            if not nome:
                continue
            giocatori_by_name[nome] = {
                'updated_at': now_iso,
                'squadra': player.get('squadra'),
                'titolare': player.get('titolare'),
                'prob_titolare': player.get('prob_titolare'),
                'prob_subentro': player.get('prob_subentro'),
                'ballottaggio': player.get('ballottaggio'),
                'note': player.get('note'),
                'forma': player.get('forma'),
                'news': player.get('news'),
            }
        
        # Merge new data with existing fresh data
        final_result = {**existing_fresh_data, **giocatori_by_name}


        usage = getattr(response, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
        output_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)

        # Save to Firestore if enabled, merging with existing player info
        if db_type == 'firestore' and firestore is not None:
            doc_ref = db.collection('probable_lineups').document(str(matchday))
            doc_ref.set({'result': final_result, 'cost': cost, 'created_at': today_str, 'matchday': matchday}, merge=True)

        return jsonify_success({'result': final_result, 'cost': cost, 'cached': False})
    except Exception as e:
        logger.error(f"Gemini probable-lineups error: {e}")
        return jsonify_error("gemini_error", f"Impossibile generare le probabili formazioni: {str(e)}")


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
        f"- Dai priorità ASSOLUTA a notizie/statistiche della stagione 2025/26 (pubblicate dopo agosto 2025)\n"
        f"- IGNORA completamente dati delle stagioni 2024/25, 2023/24 o precedenti\n"
        f"- Cerca informazioni su trasferimenti estivi 2025, prestazioni nelle prime giornate 2025/26, infortuni attuali\n"
        f"- Disambigua eventuali omonimi usando ruolo fornito\n"
        f"- Non inventare numeri: se un dato non è certo per la stagione corrente, segnala l'incertezza\n\n"
        f"CONSEGNA (OBBLIGATORIA)\n"
        f"Restituisci SOLO un SINGOLO oggetto JSON **valido**. Usa sempre doppi apici per chiavi e stringhe. Rispetta esattamente questa struttura:\n"
        f'{{{{\n'
        f'  "trend": "brevissima descrizione di questi giocatori ",\n'
        f'  "hot_players": ["...", "..."] # giocatori top da prendere tra quelli analizzati e per ognuno aggiungi il perche,\n'
        f'  "trap": "..." # potenziali trappole o giocatori sopravvalutati.\n'
        f'}}}}\n\n'
        f"VINCOLI DI CONTENUTO\n"
        f"- Indica sempre che i dati si riferiscono alla stagione 2025/26 (es. 'inizio stagione 2025/26', 'prime giornate 2025/26')\n"
        f"- trend: descrizione breve basata su prestazioni/notizie stagione 2025/26\n"
        f"- hot_players: giocatori top per la stagione corrente con motivazioni basate su dati 2025/26\n"
        f"- trap: potenziali trappole considerando il contesto stagione 2025/26\n"
        f"- Non inserire link o citazioni nel JSON\n\n"
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
        f"- Dai priorità ASSOLUTA a notizie/statistiche della stagione 2025/26 (pubblicate dopo agosto 2025)\n"
        f"- IGNORA completamente dati delle stagioni 2024/25, 2023/24 o precedenti\n"
        f"- Se non trovi dati specifici per la stagione 2025/26, cerca almeno le ultime notizie di mercato/trasferimenti estivi 2025\n"
        f"- Disambigua eventuali omonimi usando squadra e ruolo forniti\n"
        f"- Non inventare numeri: se un dato non è certo per la stagione corrente, segnala l'incertezza nella sezione weaknesses\n\n"

        f"CONSEGNA (OBBLIGATORIA)\n"
        f"Restituisci SOLO un SINGOLO oggetto JSON **valido**, senza testo extra, senza spiegazioni, senza markdown "
        f"e **senza backtick**. Usa sempre doppi apici per chiavi e stringhe. Rispetta esattamente questa struttura:\n"
        f'{{{{\n'
        f'  "strengths": ["...", "..."],\n'
        f'  "weaknesses": ["..."],\n'
        f'  "advice": "..." \n'
        f'}}}}\n\n'

        f"VINCOLI DI CONTENUTO\n"
        f"- strengths: 2–3 frasi brevi e specifiche basate SOLO su stagione 2025/26 (forma recente, titolarità, infortuni recuperati, minuti, rigori, ruolo tattico, dati oggettivi come gol/assist/xG)\n"
        f"- weaknesses: 1–2 frasi su rischi/limiti per la stagione corrente (rotazione, infortunio, calo forma, trasferimento incerto, 'dati stagione 2025/26 limitati' se necessario)\n"
        f"- advice: una sola frase operativa e concisa per l'asta basata su informazioni stagione 2025/26 (prezzi/strategia/asta, livello di rischio/ritorno atteso)\n"
        f"- Indica sempre che i dati si riferiscono alla stagione 2025/26 (es. 'nelle prime giornate 2025/26', 'inizio stagione 2025/26')\n"
        f"- Non inserire link o citazioni nel JSON\n\n"

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
    f"Punteggio FantaPilot: {player['stars']}/5\n"
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

    "VINCOLI OBBLIGATORI: Esegui al massimo DUE query di Google Search\n\n"

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
            # tools=[grounding_tool],
            # thinking_config=types.ThinkingConfig(thinking_budget=32),
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

@cache_api_lru(maxsize=128, ttl=30*60)  # Cache for 30 minutes
def optimize_lineup_cached(matchday, risk, xi_threshold, prefer_def_mod, module, players_json):
    """
    Cached function for lineup optimization.
    Uses stable parameters to ensure good cache hit rates.
    """
    import hashlib
    
    logger = logging.getLogger(__name__)
    
    try:
        # Parse players data
        team_players = json.loads(players_json)
        
        # Debug: Check role distribution in team
        role_distribution = {"POR": 0, "DIF": 0, "CEN": 0, "ATT": 0}
        for player in team_players:
            role = player.get('role')
            if role in role_distribution:
                role_distribution[role] += 1
        
        logger.info(f"Team role distribution: {role_distribution}")
        logger.info(f"Formation {module} requires: {MODULE_SLOTS.get(module, {})}")
        
        # Check if team has enough players for formation
        required = MODULE_SLOTS.get(module, {})
        insufficient_roles = []
        for role, required_count in required.items():
            available_count = role_distribution.get(role, 0)
            if available_count < required_count:
                logger.warning(f"Not enough {role} players: need {required_count}, have {available_count}")
                insufficient_roles.append(f"{role}: hai {available_count}, servono {required_count}")
        
        if insufficient_roles:
            error_msg = f"Impossibile creare formazione {module}. " + ", ".join(insufficient_roles)
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Format player data for the prompt
        players_summary = []
        for player in team_players:
            prob_info = player.get('probableLineupInfo', {})
            player_text = f"""
            - ID: {player.get('id')} | {player.get('name')} ({player.get('role')}, {player.get('team')})
              • Avversario: {player.get('opponent', 'N/A')}
              • Titolare prob: {prob_info.get('prob_titolare', 0):.0%}
              • Forma: {prob_info.get('forma', 'N/A')}
              • News: {prob_info.get('news', 'Nessuna news')}
              • Note: {prob_info.get('note', 'Nessuna nota')}
            """
            players_summary.append(player_text.strip())
        
        players_text = "\n".join(players_summary)
        
        prompt = f"""
        RUOLO
        Sei un esperto allenatore di Fantacalcio e data analyst. Devi ottimizzare la formazione per la giornata {matchday}.

        STRATEGIA IMPOSTATA
        - Profilo di rischio: {risk}
        - Soglia XI: {xi_threshold:.0%} (probabilità minima per essere titolare)
        - Modulo: {module}
        - Preferenza difensori: {'Sì' if prefer_def_mod else 'No'}

        GIOCATORI DISPONIBILI
        {players_text}

        VINCOLI FONDAMENTALI - RISPETTA RIGOROSAMENTE:
        1. Usa SEMPRE il ruolo originale di ogni giocatore come specificato nei dati
        2. NON cambiare MAI il ruolo di un giocatore (POR rimane POR, DIF rimane DIF, CEN rimane CEN, ATT rimane ATT)
        3. MODULO {module} OBBLIGATORIO - seleziona ESATTAMENTE:
           • 1 giocatore con ruolo POR
           • {MODULE_SLOTS.get(module, {}).get('DIF', 4)} giocatori con ruolo DIF
           • {MODULE_SLOTS.get(module, {}).get('CEN', 3)} giocatori con ruolo CEN  
           • {MODULE_SLOTS.get(module, {}).get('ATT', 3)} giocatori con ruolo ATT
        4. VERIFICA PRIMA DI RISPONDERE: conta i giocatori per ruolo nell'XI
        5. Se non ci sono abbastanza giocatori di un ruolo, DIMMI che è impossibile creare il modulo richiesto
        6. IMPORTANTE: Nel JSON di risposta, usa per "role" ESATTAMENTE il ruolo originale del giocatore
        7. Il campo "formation" DEVE essere esattamente "{module}"

        OBIETTIVO
        Usa la Ricerca Google per verificare le ultime notizie e informazioni aggiornate sui giocatori SPECIFICAMENTE per la giornata {matchday} della stagione 2025/26, 
        poi ottimizza la formazione considerando:
        1. Probabilità di giocare titolare nella giornata {matchday} 2025/26
        2. Forma attuale e notizie recenti della stagione 2025/26
        3. Strategia di rischio impostata
        4. Modulo tattico scelto
        5. RUOLI ORIGINALI dei giocatori (NON modificarli)

        VINCOLI TEMPORALI PER LA RICERCA:
        - Cerca SOLO informazioni pubblicate dopo agosto 2025 (stagione 2025/26)
        - IGNORA completamente dati delle stagioni 2024/25, 2023/24 o precedenti
        - Concentrati su notizie, allenamenti e probabili formazioni per la giornata {matchday} 2025/26
        - Se una fonte menziona stagioni passate, IGNORALA
        - Usa termini di ricerca come: "giornata {matchday} serie a 2025/26", "probabili formazioni settembre 2025"

        ISTRUZIONI
        - Per profilo Conservativo: privilegia titolari sicuri, giocatori con alta probabilità di giocare e in forma (stagione 2025/26)
        - Per profilo Aggressivo: considera giocatori con alto potenziale di Fantasy Points anche se con probabilità di titolarità inferiore
        - Per profilo Bilanciato: equilibra sicurezza e potenziale, puntando su un mix di titolari sicuri e qualche scelta a rischio calcolato
        - Se preferenza difensori attiva, dai leggero bonus ai difensori nelle scelte
        - Rispetta la soglia XI impostata come guida per le probabilità di titolarità
        - Considera avversari, orari di gioco e ultime notizie DELLA STAGIONE CORRENTE 2025/26
        - MANTIENI sempre il ruolo originale di ogni giocatore

        CONSEGNA (OBBLIGATORIA)
        Restituisci SOLO un oggetto JSON valido con questa struttura esatta:
        {{
          "xi": [
            {{"playerId": "usa_esatto_ID_dal_prompt", "playerName": "nome", "role": "ruolo in input del giocatore (non prendere questo ruolo dalle fonti)", "reasoning": "breve motivazione max 100 caratteri"}},
            ...
          ],
          "bench": [
            {{"playerId": "usa_esatto_ID_dal_prompt", "playerName": "nome", "role": "ruolo in input del giocatore (non prendere questo ruolo dalle fonti)", "reasoning": "breve motivazione max 100 caratteri"}},
            ...
          ],
          "captain": {{"playerId": "usa_esatto_ID_dal_prompt", "playerName": "nome", "reasoning": "motivazione max 150 caratteri"}},
          "viceCaptain": {{"playerId": "usa_esatto_ID_dal_prompt", "playerName": "nome", "reasoning": "motivazione max 150 caratteri"}},
          "formation": "{module}",
          "totalXfp": 0.0,
          "reasoning": "spiegazione generale della strategia utilizzata max 300 caratteri"
        }}

        VINCOLI CRITICI - FORMAZIONE {module}
        - VINCOLO ASSOLUTO: L'XI deve contenere ESATTAMENTE:
          * 1 giocatore con role="POR" 
          * {MODULE_SLOTS.get(module, {}).get('DIF', 4)} giocatori con role="DIF"
          * {MODULE_SLOTS.get(module, {}).get('CEN', 3)} giocatori con role="CEN"  
          * {MODULE_SLOTS.get(module, {}).get('ATT', 3)} giocatori con role="ATT"
        - TOTALE XI: esattamente 11 giocatori
        - NON MODIFICARE MAI il campo "role" - usa sempre il ruolo originale del giocatore
        - Se un giocatore ha role="CEN" nel prompt, nell'XI deve avere role="CEN"
        - Se un giocatore ha role="DIF" nel prompt, nell'XI deve avere role="DIF"
        - PRIMA di scrivere il JSON finale: conta i giocatori per ruolo e verifica che rispettino {module}
        - Se i conti non tornano, ricontrolla e correggi la selezione
        - Capitano e vice-capitano devono essere nell'XI
        - Usa sempre doppi apici per chiavi e stringhe
        - Non aggiungere testo extra o markdown
        - Calcola totalXfp sommando gli xFP dei giocatori nell'XI
        - Reasoning deve essere specifico e conciso
        - IMPORTANTE: Per playerId usa ESATTAMENTE l'ID fornito nel prompt (quello dopo "ID:"), non creare ID diversi
        - FONDAMENTALE: Per "role" usa ESATTAMENTE il ruolo originale del giocatore senza modificarlo
        - Il campo "formation" deve essere esattamente "{module}"

        PROCEDURA DI VALIDAZIONE OBBLIGATORIA - SEGUI RIGOROSAMENTE:
        1. Seleziona esattamente 1 giocatore con role="POR" per l'XI
        2. Seleziona esattamente {MODULE_SLOTS.get(module, {}).get('DIF', 4)} giocatori con role="DIF" per l'XI
        3. Seleziona esattamente {MODULE_SLOTS.get(module, {}).get('CEN', 3)} giocatori con role="CEN" per l'XI
        4. Seleziona esattamente {MODULE_SLOTS.get(module, {}).get('ATT', 3)} giocatori con role="ATT" per l'XI
        5. VERIFICA FINALE: conta i giocatori nell'XI per ruolo:
           - POR: deve essere 1
           - DIF: deve essere {MODULE_SLOTS.get(module, {}).get('DIF', 4)}
           - CEN: deve essere {MODULE_SLOTS.get(module, {}).get('CEN', 3)}
           - ATT: deve essere {MODULE_SLOTS.get(module, {}).get('ATT', 3)}
           - TOTALE: deve essere 11
        6. Se i conti non tornano, RICOMINCIA la selezione finché non rispetti {module}
        7. Solo quando la formazione è corretta, procedi con il JSON finale

        LINGUA
        Rispondi in italiano.
        """
        
        start_time = time.time()
        
        schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "xi": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "playerId": types.Schema(type=types.Type.STRING),
                            "playerName": types.Schema(type=types.Type.STRING),
                            "role": types.Schema(type=types.Type.STRING),
                            "reasoning": types.Schema(type=types.Type.STRING),
                        },
                        required=["playerId", "playerName", "role", "reasoning"]
                    )
                ),
                "bench": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "playerId": types.Schema(type=types.Type.STRING),
                            "playerName": types.Schema(type=types.Type.STRING),
                            "role": types.Schema(type=types.Type.STRING),
                            "reasoning": types.Schema(type=types.Type.STRING),
                        },
                        required=["playerId", "playerName", "role", "reasoning"]
                    )
                ),
                "captain": types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "playerId": types.Schema(type=types.Type.STRING),
                        "playerName": types.Schema(type=types.Type.STRING),
                        "reasoning": types.Schema(type=types.Type.STRING),
                    },
                    required=["playerId", "playerName", "reasoning"]
                ),
                "viceCaptain": types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "playerId": types.Schema(type=types.Type.STRING),
                        "playerName": types.Schema(type=types.Type.STRING),
                        "reasoning": types.Schema(type=types.Type.STRING),
                    },
                    required=["playerId", "playerName", "reasoning"]
                ),
                "formation": types.Schema(type=types.Type.STRING),
                "totalXfp": types.Schema(type=types.Type.NUMBER),
                "reasoning": types.Schema(type=types.Type.STRING),
            },
            required=["xi", "bench", "captain", "viceCaptain", "formation", "totalXfp", "reasoning"]
        )
        
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            response_schema=schema,
            temperature=0.1,
            max_output_tokens=None,
        )
        
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
        
        elapsed = time.time() - start_time
        logger.info(f"Gemini optimize-lineup call time: {elapsed:.2f}s")
        
        text = response.text
        logger.info(f"[Gemini optimize-lineup raw response]: {text}")
        
        result = json.loads(text.replace('```json', '').replace('```', '').strip())
        
        if not (isinstance(result, dict) and 'xi' in result and 'bench' in result):
            logger.error(f"Invalid Gemini optimize-lineup response structure: {result}")
            raise ValueError("Risposta Gemini non valida: struttura errata.")
        
        # Validate XI has 11 players
        if len(result['xi']) != 11:
            logger.warning(f"XI does not have 11 players: {len(result['xi'])}")
        
        # Validate formation structure
        if module in MODULE_SLOTS:
            role_counts = {"POR": 0, "DIF": 0, "CEN": 0, "ATT": 0}
            logger.info(f"AI XI players and their roles:")
            for player in result['xi']:
                role = player.get('role')
                player_name = player.get('playerName', 'Unknown')
                player_id = player.get('playerId', 'Unknown')
                logger.info(f"  - {player_name} ({player_id}): role = '{role}'")
                if role in role_counts:
                    role_counts[role] += 1
                else:
                    logger.warning(f"  - Unknown role '{role}' for player {player_name}")
            
            logger.info(f"AI XI role counts: {role_counts}")
            expected = MODULE_SLOTS[module]
            logger.info(f"Expected for {module}: {expected}")
            
            mismatches = []
            for role, expected_count in expected.items():
                actual_count = role_counts[role]
                if actual_count != expected_count:
                    mismatches.append(f"{role}: expected {expected_count}, got {actual_count}")
            
            if mismatches:
                logger.error(f"Formation {module} validation failed: {', '.join(mismatches)}")
                logger.error(f"XI roles distribution: {role_counts}")
                
                # Try auto-correction for minor mismatches
                total_players_in_xi = sum(role_counts.values())
                expected_total = sum(MODULE_SLOTS[module].values())
                
                if total_players_in_xi == expected_total:
                    # Same total players, try to redistribute from bench
                    logger.info("Attempting auto-correction by redistributing players from bench...")
                    
                    # Parse team players for bench adjustments
                    team_players = json.loads(players_json)
                    xi_players = result.get('xi', [])
                    bench_players = result.get('bench', [])
                    
                    # Group available players by role
                    available_by_role = {"POR": [], "DIF": [], "CEN": [], "ATT": []}
                    for player in team_players:
                        role = player.get('role')
                        if role in available_by_role:
                            available_by_role[role].append(player)
                    
                    # Try to fix role shortages
                    corrected_xi = xi_players.copy()
                    corrected_bench = bench_players.copy()
                    auto_corrected = False
                    
                    for role, expected_count in MODULE_SLOTS[module].items():
                        current_count = role_counts.get(role, 0)
                        if current_count < expected_count:
                            needed = expected_count - current_count
                            logger.info(f"Need {needed} more {role} players")
                            
                            # Find excess players in other roles that we can swap
                            for excess_role, excess_count in role_counts.items():
                                excess_expected = MODULE_SLOTS[module].get(excess_role, 0)
                                if excess_count > excess_expected:
                                    excess_available = excess_count - excess_expected
                                    swap_count = min(needed, excess_available)
                                    
                                    if swap_count > 0:
                                        # Find players to swap
                                        players_to_remove = []
                                        players_to_add = []
                                        
                                        # Remove excess players from XI
                                        for i, xi_player in enumerate(corrected_xi):
                                            if len(players_to_remove) >= swap_count:
                                                break
                                            for team_player in team_players:
                                                if ((team_player.get('id') == xi_player.get('playerId')) or 
                                                    (team_player.get('name') == xi_player.get('playerName'))) and team_player.get('role') == excess_role:
                                                    players_to_remove.append(i)
                                                    break
                                        
                                        # Find replacement players from bench or available players
                                        for bench_player in corrected_bench:
                                            if len(players_to_add) >= swap_count:
                                                break
                                            for team_player in team_players:
                                                if ((team_player.get('id') == bench_player.get('playerId')) or 
                                                    (team_player.get('name') == bench_player.get('playerName'))) and team_player.get('role') == role:
                                                    players_to_add.append(bench_player)
                                                    break
                                        
                                        # Perform the swap
                                        if len(players_to_add) >= swap_count:
                                            for idx in sorted(players_to_remove[:swap_count], reverse=True):
                                                moved_player = corrected_xi.pop(idx)
                                                corrected_bench.append(moved_player)
                                            
                                            for new_player in players_to_add[:swap_count]:
                                                corrected_xi.append(new_player)
                                                if new_player in corrected_bench:
                                                    corrected_bench.remove(new_player)
                                            
                                            needed -= swap_count
                                            auto_corrected = True
                                            logger.info(f"Auto-corrected: swapped {swap_count} {excess_role} -> {role}")
                                            
                                            if needed <= 0:
                                                break
                    
                    if auto_corrected:
                        # Update the result with corrected lineup
                        result['xi'] = corrected_xi
                        result['bench'] = corrected_bench
                        logger.info("Auto-correction successful - lineup updated")
                        
                        # Re-validate after correction
                        corrected_role_counts = {"POR": 0, "DIF": 0, "CEN": 0, "ATT": 0}
                        for xi_player in corrected_xi:
                            player_id = xi_player.get('playerId')
                            player_name = xi_player.get('playerName')
                            
                            for team_player in team_players:
                                if ((team_player.get('id') == player_id) or 
                                    (team_player.get('name') == player_name)):
                                    role = team_player.get('role')
                                    if role in corrected_role_counts:
                                        corrected_role_counts[role] += 1
                                    break
                        
                        # Check if correction worked
                        correction_mismatches = []
                        for role, expected_count in MODULE_SLOTS[module].items():
                            actual_count = corrected_role_counts[role]
                            if actual_count != expected_count:
                                correction_mismatches.append(f"{role}: expected {expected_count}, got {actual_count}")
                        
                        if not correction_mismatches:
                            logger.info(f"Auto-correction successful! New role counts: {corrected_role_counts}")
                        else:
                            logger.warning(f"Auto-correction partially failed: {correction_mismatches}")
                    
                if mismatches:  # Still have mismatches after auto-correction attempt
                    # Suggest alternative formations
                    suggestions = []
                    for alt_module, alt_slots in MODULE_SLOTS.items():
                        if alt_module != module:
                            # Check if current role counts fit alternative formation
                            if all(role_counts.get(role, 0) >= count for role, count in alt_slots.items()):
                                suggestions.append(alt_module)
                    
                    error_msg = f"Formazione {module} non rispettata: {', '.join(mismatches)}"
                    if suggestions:
                        error_msg += f". Formazioni alternative possibili: {', '.join(suggestions[:2])}"
                    else:
                        error_msg += ". Verifica di avere abbastanza giocatori per ogni ruolo nella tua squadra"
                    
                    raise ValueError(error_msg)
            else:
                logger.info(f"Formation {module} validation passed: {role_counts}")
        
        usage = getattr(response, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
        output_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0
        cost = compute_gemini_cost(GEMINI_MODEL, input_tokens, output_tokens, "default", grounding_searches=1)
        
        logger.info(f"Gemini optimize-lineup cached call for matchday={matchday}, risk={risk}, module={module}")
        
        return {
            'result': result, 
            'cost': cost,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens
        }
        
    except Exception as e:
        logger.error(f"Gemini optimize-lineup cached error: {e}")
        raise e

@gemini_api.route('/optimize-lineup', methods=['POST'])
@require_auth
def gemini_optimize_lineup():
    """
    Given strategy settings and team players with stats and probable lineup info,
    returns the optimized XI and bench using Gemini AI.
    Expects JSON: { 
        "strategySettings": {...}, 
        "teamPlayers": [...], 
        "matchday": <int> 
    }
    """
    limiter = get_limiter()
    if limiter:
        limiter.limit("15/minute")(lambda: None)()
    
    try:
        data = request.get_json() or {}
        logger.info(f"Received optimize-lineup request: {data}")
        
        strategy_settings = data.get('strategySettings', {})
        team_players = data.get('teamPlayers', [])
        matchday = data.get('matchday')
        
        logger.info(f"Parsed data - matchday: {matchday} (type: {type(matchday)}), strategy: {strategy_settings}, players count: {len(team_players)}")
        
        if matchday is None:
            logger.error("Matchday is None")
            return jsonify_error("bad_request", "'matchday' è richiesto.")
        
        if not isinstance(matchday, int):
            logger.error(f"Matchday is not int: {matchday} (type: {type(matchday)})")
            return jsonify_error("bad_request", f"'matchday' deve essere un intero. Ricevuto: {matchday} (tipo: {type(matchday)})")
        
        if not (1 <= matchday <= 38):
            logger.error(f"Matchday out of range: {matchday}")
            return jsonify_error("bad_request", f"'matchday' deve essere tra 1 e 38. Ricevuto: {matchday}")
        
        if not team_players:
            logger.error("No team players provided")
            return jsonify_error("bad_request", "Nessun giocatore fornito per l'ottimizzazione.")
        
        # Extract strategy settings
        risk = strategy_settings.get('risk', 50)
        xi_threshold = strategy_settings.get('xiThreshold', 0.7)
        prefer_def_mod = strategy_settings.get('preferDefMod', False)
        module = strategy_settings.get('module', '4-3-3')
        
        # Convert numerical risk to descriptive label
        def get_risk_label(risk_value):
            if risk_value <= 33:
                return "Conservativo"
            elif risk_value >= 67:
                return "Aggressivo"
            else:
                return "Bilanciato"
        
        risk_label = get_risk_label(risk)
        
        logger.info(f"Strategy settings - risk: {risk} ({risk_label}), threshold: {xi_threshold}, defMod: {prefer_def_mod}, module: {module}")
    except Exception as e:
        logger.error(f"Error parsing optimize-lineup request: {e}")
        return jsonify_error("bad_request", f"Errore nella richiesta: {str(e)}")
    
    try:
        # Convert team_players to JSON string for cache key stability
        players_json = json.dumps(team_players, sort_keys=True)
        
        # Call the cached optimization function
        cached_result = optimize_lineup_cached(
            matchday=matchday,
            risk=risk_label,  # Pass the descriptive label instead of number
            xi_threshold=xi_threshold,
            prefer_def_mod=prefer_def_mod,
            module=module,
            players_json=players_json
        )
        
        return jsonify_success(cached_result)
        
    except Exception as e:
        logger.error(f"Gemini optimize-lineup error: {e}")
        return jsonify_error("gemini_error", f"Impossibile ottimizzare la formazione: {str(e)}")

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
