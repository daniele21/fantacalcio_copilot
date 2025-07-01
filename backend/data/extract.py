# %% [markdown]
# # Scraper Fantacalcio (Playwright Async)

# %% 
import os, time, logging, asyncio
from random import uniform
from typing import List, Dict

import pandas as pd
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from tqdm import tqdm

from backend.database.insert_giocatori import insert_giocatori_from_records

# %% 
# ─── COSTANTI ────────────────────────────────────────────────────────────────
BASE_URL    = "https://www.fantacalciopedia.com"
SEASON      = "2025-2026"
ROLES       = ["P","D","C","T","A"]   # Portieri, Difensori, Centrocampisti, Trequartisti, Attaccanti
# ROLES       = ["P"]
PAUSE       = 1.0                     # pausa massima casuale (s) tra caricamenti
WORKERS     = 8                       # concurrency level per il fetch
#OUTPUT_FILE = "giocatori_appet_async.xlsx"

USER_AGENT  = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Safari/537.36"
)
VIEWPORT = {"width":1280, "height":800}

SELECTORS = {
    "title":      "h1",
    "score":      "div.col_one_fourth:nth-of-type(1) span.stickdan",
    "medie":      "div.col_one_fourth:nth-of-type(n+2) div",
    "stats_last": "div.col_one_third:nth-of-type(2) div",
    "stats_next": ".col_one_third.col_last div",
    "role":       ".label12 span.label",
    "skills":     "span.stickdanpic",
    "invest":     "div.progress-percent",
    "alerts":     "img.inf_calc",
    "new":        "span.new_calc",
    "team":       "#content div.promo-light.row img",
    "trend":      "div.col_one_fourth:nth-of-type(n+2) div",
    "appear":     "div.col_one_fourth:nth-of-type(2) span.rouge",
}

SKILL_WEIGHTS = {
    "Fuoriclasse":1, "Titolare":3, "Buona Media":2, "Goleador":4,
    "Assistman":2, "Piazzati":2, "Rigorista":5, "Giovane talento":2,
    "Panchinaro":-4, "Falloso":-2, "Outsider":2,
}

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S")
logger = logging.getLogger("fantacalcio-async")

# %% 
# ─── FUNZIONI ASYNC ─────────────────────────────────────────────────────────────

async def fetch_rendered_html(page, url: str, pause: float = PAUSE) -> str:
    await page.goto(url, timeout=30000)
    await asyncio.sleep(uniform(0.5, pause))
    return await page.content()

async def fetch_player_list(browser, role_code: str) -> List[str]:
    """
    Ritorna la lista completa di URL dei giocatori per un dato ruolo,
    correggendo il path ed espandendo i link relativi.
    """
    # mapping rimane identico
    path = {
        "P":"lista-calciatori-serie-a/portieri",
        "D":"lista-calciatori-serie-a/difensori",
        "C":"lista-calciatori-serie-a/centrocampisti",
        "T":"lista-calciatori-serie-a/trequartisti",
        "A":"lista-calciatori-serie-a/attaccanti",
    }[role_code]

    # NOTA: tolgo f"{SEASON}" che era errato
    url = f"{BASE_URL}/{path}/"
    page = await browser.new_page(user_agent=USER_AGENT, viewport=VIEWPORT)
    html = await fetch_rendered_html(page, url)
    await page.close()

    soup = BeautifulSoup(html, "html.parser")
    raw_links = list(set([a["href"] for a in soup.select("article a[href]")]))
    # Espandi i link relativi a URL assoluti
    full_links = [
        href if href.startswith("http") else BASE_URL + href
        for href in raw_links
    ]
    logger.info(f"[{role_code}] trovati {len(full_links)} giocatori")
    return full_links

def safe_float(text: str, default: float = 0.0) -> float:
    """
    Prova a convertire in float; se fallisce (es. 'nd'), restituisce default.
    Sostituisce anche virgole e %, se presenti.
    """
    if not isinstance(text, str):
        return default
    txt = text.strip().replace(",", ".").replace("%", "")
    try:
        return float(txt)
    except ValueError:
        return txt

async def fetch_player_attrs(browser, url: str) -> Dict:
    page = await browser.new_page(user_agent=USER_AGENT, viewport=VIEWPORT)
    html = await fetch_rendered_html(page, url)
    soup = BeautifulSoup(html, "html.parser")
    await page.close()

    d: Dict = {}
    # Nome
    el = soup.select_one(SELECTORS["title"])
    d["Nome"] = el.get_text(strip=True) if el else ""
    
    # Punteggio
    el = soup.select_one(SELECTORS["score"])
    raw = el.get_text(strip=True).replace("/100","") if el else ""
    d["Punteggio"] = safe_float(raw)
    
    # Fantamedie
    for el in soup.select(SELECTORS["medie"]):
        sp = el.find("span"); yr = el.find("strong")
        if sp and yr:
            anno = yr.get_text(strip=True).split()[-1]
            d[f"Fantamedia_{anno}"] = safe_float(sp.get_text(strip=True))
    
    # Stats last & next
    for key in ("stats_last","stats_next"):
        cont = soup.select_one(SELECTORS[key])
        if not cont: continue
        labs = [s.get_text(strip=True).rstrip(":") for s in cont.find_all("strong")]
        vals = [s.get_text(strip=True) for s in cont.find_all("span")]
        for lab,val in zip(labs, vals):
            try: d[lab] = safe_float(val)
            except: d[lab] = val
    # Ruolo
    el = soup.select_one(SELECTORS["role"])
    d["Ruolo"] = el.get_text(strip=True) if el else ""
    
    # Skills
    d["Skills"] = [s.get_text(strip=True) for s in soup.select(SELECTORS["skills"])]
    
    # Investimenti
    invs = soup.select(SELECTORS["invest"])
    if len(invs)>=4:
        d["Buon_investimento"]    = safe_float(invs[2].get_text(strip=True).rstrip("%"))
        d["Resistenza_infortuni"] = safe_float(invs[3].get_text(strip=True).rstrip("%"))
    else:
        d["Buon_investimento"] = d["Resistenza_infortuni"] = 0.0
    
    # Alerts
    alerts = soup.select(SELECTORS["alerts"])
    title  = alerts[0].get("title","") if alerts else ""
    d["Consigliato"] = "Consigliato" in title
    d["Infortunato"] = "Infortunato" in title
    
    # Nuovo acquisto
    d["Nuovo_acquisto"] = bool(soup.select_one(SELECTORS["new"]))
    
    # Squadra
    # img = soup.select_one(SELECTORS["team"])
    club_tag = soup.find("strong", string=lambda t: t and t.strip() == "Club:")
    if club_tag and club_tag.next_sibling:
        d["Squadra"] = club_tag.next_sibling.strip().strip('" ')
    else:
        d["Squadra"] = ""
    # d["Squadra"] = img["title"].split(":",1)[-1].strip() if img and img.get("title") else ""
    
    # Trend
    try:
        cls = soup.select(SELECTORS["trend"])[0].find("i")["class"][1]
        d["Trend"] = "UP" if "up" in cls.lower() else "DOWN"
    except:
        d["Trend"] = "STABLE"
    
    # Presenze
    el = soup.select_one(SELECTORS["appear"])
    try: d["Presenze"] = int(el.get_text(strip=True))
    except: d["Presenze"] = 0

    return d

def compute_appetibilita(df: pd.DataFrame) -> pd.Series:
    df = df.copy().fillna(0)
    df.replace("nd", 0, inplace=True)
    df['Quotazioni'] = 1
    # Assicuriamoci numerici
    for col in ["Punteggio","Buon_investimento","Resistenza_infortuni","Presenze"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["QuotaBase"] = pd.to_numeric(df.get("Quotazione",1), errors="coerce")
    def skill_score(lst): return sum(SKILL_WEIGHTS.get(x,0) for x in (lst or []))
    score = (
        df["Punteggio"] * (df["Presenze"]/38).clip(0,1)*0.3 +
        df["Buon_investimento"]/100*0.1 +
        df["Resistenza_infortuni"]/100*0.1 +
        df["Consigliato"].astype(int)*0.05 +
        df["Nuovo_acquisto"].astype(int)*-0.02 +
        df["Trend"].map({"UP":0.05,"DOWN":-0.05,"STABLE":0}) +
        df["Infortunato"].astype(int)*-0.1 +
        df["Skills"].apply(skill_score)*0.1
    )
    return score.div(df["QuotaBase"])

# %% 
# ─── END-TO-END ASYNC ──────────────────────────────────────────────────────────

async def run_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # 1) prendo tutti gli URL
        all_urls: List[str] = []
        for r in ROLES:
            urls = await fetch_player_list(browser, r)
            all_urls.extend(urls)

        logger.info(f"Totale URL da processare: {len(all_urls)}")

        # 2) scraping parallelo con barra di progresso
        records = []
        sem = asyncio.Semaphore(WORKERS)
        async def sem_task(url):
            async with sem:
                return await fetch_player_attrs(browser, url)

        tasks = [sem_task(u) for u in all_urls]

        # ecco la progress bar su as_completed:
        for fut in tqdm(asyncio.as_completed(tasks),
                        total=len(tasks),
                        desc="🔍 Scraping giocatori"):
            try:
                rec = await fut
                records.append(rec)
            except Exception as e:
                logger.warning(f"Errore durante lo scraping: {e}")

        await browser.close()

    # 3) DataFrame & appetibilita (come prima)
    df = pd.DataFrame.from_records(records)
    df["Appetibilita"] = compute_appetibilita(df)
    df.sort_values("Appetibilita", ascending=False, inplace=True)
    
    df = df[df['Nome'].notnull()]
    df.to_csv("players_attributes.csv", index=False)
    return df.to_dict(orient="records")
    


