"""
scraper.py
Fontes reais priorizadas: Pinnacle + BetExplorer (+ The Odds API quando configurada).
Extras de cobertura: API-Football.
"""

import asyncio
import re
import unicodedata
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

BRT = timezone(timedelta(hours=-3))

H_PIN = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "X-Api-Key": "CmX2KcMrXuFmNg6YFbmTxE0y9CIrOi0R",
    "Referer": "https://www.pinnacle.com/",
}
H_HTML = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
}
H_JSON = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

PIN_BASE = "https://guest.api.arcadia.pinnacle.com/0.1"
BETEXPLORER_PAGES = [
    ("https://www.betexplorer.com/soccer/", "soccer_global"),
    ("https://www.betexplorer.com/soccer/next/", "soccer_global"),
    ("https://www.betexplorer.com/basketball/", "basketball_global"),
    ("https://www.betexplorer.com/basketball/next/", "basketball_global"),
    ("https://www.betexplorer.com/hockey/", "icehockey_global"),
    ("https://www.betexplorer.com/hockey/next/", "icehockey_global"),
    ("https://www.betexplorer.com/baseball/", "baseball_global"),
    ("https://www.betexplorer.com/baseball/next/", "baseball_global"),
]

# Mapeamento de IDs da Pinnacle para chaves internas
PIN_SPORT_MAP = {
    29: "soccer",
    4: "basketball",
    19: "hockey",
    3: "baseball",
    33: "tennis",
    18: "handball",
    34: "volleyball",
}

def remove_vig(odds: List[float]) -> List[float]:
    if not odds or any(o <= 1 for o in odds):
        return [1 / max(1, len(odds))] * len(odds)
    implied = [1 / o for o in odds]
    total = sum(implied)
    return [p / total for p in implied]


def calc_ev(prob: float, odds: float) -> float:
    return round(prob * (odds - 1) - (1 - prob), 4)


def model_prob(implied: float, label: str) -> float:
    # Removido o ajuste fixo que causava "valor falso" e odds distoantes.
    # Agora a probabilidade do modelo é a probabilidade implícita limpa da margem (fair).
    return round(max(0.01, min(0.99, implied)), 4)

def make_market(label: str, odds: float, implied: float, market_type: str = "1X2", house: str = "") -> dict:
    mp = model_prob(implied, label)
    return {
        "label": label,
        "odds": round(odds, 3),
        "house": house or "",
        "implied_prob": round(implied, 4),
        "model_prob": mp,
        "ev": calc_ev(mp, odds),
        "confidence": "Alta" if mp > 0.65 else "Media" if mp > 0.50 else "Baixa",
        "market_name": market_type,
    }


def us_to_dec(us: float) -> float:
    try:
        v = float(us)
        if v > 0:
            return round(v / 100 + 1, 3)
        if v < 0:
            return round(100 / abs(v) + 1, 3)
    except Exception:
        return 0.0
    return 0.0


def detect_surebet(bookmakers: dict) -> Optional[dict]:
    if not bookmakers or len(bookmakers) < 2:
        return None
    labels = [x for x in ("home", "draw", "away") if any((bk.get(x, 0) > 1) for bk in bookmakers.values())]
    if len(labels) < 2:
        return None
    best = {}
    for label in labels:
        for bk_name, bk_odds in bookmakers.items():
            odd = bk_odds.get(label, 0)
            if odd > 1 and (label not in best or odd > best[label][0]):
                best[label] = (odd, bk_name)
    if len(best) < 2:
        return None
    implied_sum = sum(1 / x[0] for x in best.values())
    if implied_sum >= 1:
        return None
    stakes = {k: (1 / v[0]) / implied_sum * 100 for k, v in best.items()}
    lmap = {"home": "Casa", "draw": "Empate", "away": "Fora"}
    return {
        "isSurebet": True,
        "profit": round((1 / implied_sum - 1) * 100, 2),
        "margin": round((1 - implied_sum) * 100, 2),
        "legs": [
            {"label": lmap.get(k, k), "odds": v[0], "house": v[1], "stake_pct": round(stakes[k], 2)}
            for k, v in best.items()
        ],
    }


def estimate_soccer_odds(home: str, away: str):
    sh = abs(hash(home)) % 1000 / 1000
    sa = abs(hash(away)) % 1000 / 1000
    sd = abs(hash(home + away)) % 1000 / 1000
    return round(1.50 + sh * 2.00, 2), round(2.80 + sd * 1.40, 2), round(2.00 + sa * 3.00, 2)


def estimate_basketball_odds(home: str, away: str):
    sh = abs(hash(home)) % 1000 / 1000
    ho = round(1.50 + sh * 0.80, 2)
    aw = round(max(1.55, 4.10 - ho), 2)
    return ho, aw


def _safe_float(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _normalize_team(name: str) -> str:
    name = (name or "").lower().strip()
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"\([^)]*\)", "", name)
    for token in (" fc", " cf", " sc", " ac", " afc", "f.c."):
        name = name.replace(token, "")
    name = name.replace("&", " and ")
    name = re.sub(r"[^a-z0-9]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _team_tokens(name: str) -> set:
    base = _normalize_team(name)
    if not base:
        return set()
    aliases = {
        "utd": "united",
        "man": "manchester",
        "inter": "internazionale",
        "atletico": "atl",
        "saint": "st",
        "paris": "psg",
    }
    stop = {"de", "da", "do", "the", "club"}
    toks = []
    for t in base.split():
        t = aliases.get(t, t)
        if t and t not in stop:
            toks.append(t)
    return set(toks)


def _name_sim(a: str, b: str) -> float:
    ta = _team_tokens(a)
    tb = _team_tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta.intersection(tb))
    union = len(ta.union(tb))
    return inter / union if union else 0.0


def _sport_group(sport_key: str) -> str:
    sk = (sport_key or "").lower()
    if "soccer" in sk:
        return "soccer"
    if "basketball" in sk or "nba" in sk:
        return "basketball"
    if "hockey" in sk or "nhl" in sk:
        return "hockey"
    if "baseball" in sk or "mlb" in sk:
        return "baseball"
    return sk.split("_")[0] if sk else "unknown"


def _game_key(game: dict) -> Tuple[str, str, str, str]:
    return (
        _sport_group(game.get("sport", "")),
        game.get("date", ""),
        _normalize_team(game.get("home", "")),
        _normalize_team(game.get("away", "")),
    )


def _swap_bookmaker_sides(bookmakers: dict) -> dict:
    out = {}
    for bk, vals in (bookmakers or {}).items():
        nv = dict(vals or {})
        h, a = nv.get("home"), nv.get("away")
        nv["home"], nv["away"] = a, h
        out[bk] = nv
    return out


def _merge_bookmakers(dst: dict, src: dict):
    for bk_name, odds in (src or {}).items():
        if bk_name not in dst:
            dst[bk_name] = dict(odds)
            continue
        for side in ("home", "draw", "away"):
            v_new = _safe_float(odds.get(side, 0))
            v_old = _safe_float(dst[bk_name].get(side, 0))
            if v_new > 1 and v_new > v_old:
                dst[bk_name][side] = v_new


def _merge_markets(dst: list, src: list):
    seen = {(m.get("market"), m.get("label"), round(_safe_float(m.get("odds", 0)), 3)) for m in dst}
    for m in src or []:
        k = (m.get("market"), m.get("label"), round(_safe_float(m.get("odds", 0)), 3))
        if k not in seen:
            seen.add(k)
            dst.append(m)


def deduplicate_games(games: List[dict]) -> List[dict]:
    merged: Dict[Tuple[str, str, str, str], dict] = {}
    index_keys: List[Tuple[str, str, str, str]] = []
    for g in games:
        key = _game_key(g)
        rev_key = (key[0], key[1], key[3], key[2])

        incoming = deepcopy(g)
        reverse_match = False
        matched_key: Optional[Tuple[str, str, str, str]] = None
        if key in merged:
            matched_key = key
            tgt = merged[matched_key]
        elif rev_key in merged:
            matched_key = rev_key
            tgt = merged[matched_key]
            reverse_match = True
        else:
            # Match aproximado para diferenças de grafia entre fontes.
            for ek in index_keys:
                if ek[0] != key[0] or ek[1] != key[1]:
                    continue
                ex = merged[ek]
                direct = _name_sim(incoming.get("home", ""), ex.get("home", "")) >= 0.6 and _name_sim(incoming.get("away", ""), ex.get("away", "")) >= 0.6
                flipped = _name_sim(incoming.get("home", ""), ex.get("away", "")) >= 0.6 and _name_sim(incoming.get("away", ""), ex.get("home", "")) >= 0.6
                if direct or flipped:
                    matched_key = ek
                    tgt = merged[matched_key]
                    reverse_match = flipped
                    break
            else:
                base = deepcopy(incoming)
                base["_sources_set"] = {base.get("source", "unknown")}
                merged[key] = base
                index_keys.append(key)
                continue

        if reverse_match:
            incoming["bookmakers"] = _swap_bookmaker_sides(incoming.get("bookmakers", {}))

        _merge_bookmakers(tgt.setdefault("bookmakers", {}), incoming.get("bookmakers", {}))
        _merge_markets(tgt.setdefault("markets", []), incoming.get("markets", []))

        src_set = tgt.setdefault("_sources_set", set())
        src_set.add(incoming.get("source", "unknown"))

        if "pinnacle (odds reais)" in src_set:
            tgt["source"] = "pinnacle (odds reais)"
        elif "betexplorer (odds reais)" in src_set:
            tgt["source"] = "betexplorer (odds reais)"
        elif "the-odds-api (odds reais)" in src_set:
            tgt["source"] = "the-odds-api (odds reais)"

    out = []
    for g in merged.values():
        if len(g.get("bookmakers", {})) >= 2:
            sb = detect_surebet(g.get("bookmakers", {}))
            if sb:
                g["surebet"] = sb
            elif "surebet" in g:
                del g["surebet"]
        if "_sources_set" in g:
            g["_sources"] = sorted(g["_sources_set"])
            del g["_sources_set"]
        out.append(g)

    out.sort(key=lambda x: (x.get("date", ""), x.get("hour", ""), x.get("league", ""), x.get("home", "")))
    return out


def _parse_ml(prices: list) -> Optional[dict]:
    by_desig = {p.get("designation"): us_to_dec(p.get("price")) for p in prices if "designation" in p}
    result = {}
    if by_desig.get("home", 0) > 1:
        result["home"] = by_desig["home"]
    if by_desig.get("away", 0) > 1:
        result["away"] = by_desig["away"]
    if by_desig.get("draw", 0) > 1:
        result["draw"] = by_desig["draw"]
    return result if "home" in result and "away" in result else None


def _parse_total(prices: list) -> Optional[dict]:
    lines: Dict[float, list] = {}
    for p in prices:
        pt = p.get("points")
        if pt is not None:
            lines.setdefault(float(pt), []).append(p)
    if not lines:
        return None
    main = sorted(lines.keys())[len(lines) // 2]
    pts = lines[main]
    if len(pts) < 2:
        return None
    over = us_to_dec(pts[0].get("price"))
    under = us_to_dec(pts[1].get("price"))
    if over <= 1 or under <= 1:
        return None
    return {"line": main, "over": over, "under": under}


async def fetch_pinnacle_league(client, league_id, league_name, sport_key, today, tomorrow):
    games = []
    try:
        r = await client.get(f"{PIN_BASE}/leagues/{league_id}/matchups", headers=H_PIN, timeout=12)
        if r.status_code != 200:
            return []
        matchups_raw = [
            m
            for m in r.json()
            if m.get("type") == "matchup"
            and m.get("participants")
            and m.get("status") in ("pending", "inprogress", "started")
        ]
        if not matchups_raw:
            return []

        matchups = []
        for m in matchups_raw:
            try:
                dt = datetime.fromisoformat(m["startTime"].replace("Z", "+00:00"))
                gd = dt.astimezone(BRT).strftime("%Y-%m-%d")
                if gd in (today, tomorrow):
                    matchups.append((m, dt, gd))
            except Exception:
                continue
        if not matchups:
            return []

        league_odds: Dict[int, Dict] = {}
        r2 = await client.get(f"{PIN_BASE}/leagues/{league_id}/markets/straight", headers=H_PIN, timeout=12)
        if r2.status_code == 200:
            for entry in r2.json():
                mid = entry.get("matchupId")
                mtype = entry.get("type")
                if mid and mtype and entry.get("period", 0) == 0:
                    league_odds.setdefault(mid, {})[mtype] = entry

        for m, dt, gd in matchups:
            home = next((p["name"] for p in m["participants"] if p.get("alignment") == "home"), "")
            away = next((p["name"] for p in m["participants"] if p.get("alignment") == "away"), "")
            if not home or not away:
                continue

            # FILTRO CRUCIAL: Ignorar mercados de Corners, Bookings, Penalty, etc.
            # Esses nomes aparecem nos participantes na API da Pinnacle Guest.
            forbidden = ["(corners)", "(bookings)", "(penalty)", "(points)", "(sets)", "(games)"]
            if any(f in home.lower() or f in away.lower() for f in forbidden):
                continue

            game_id = m["id"]
            hour = dt.astimezone(BRT).strftime("%H:%M")
            game_odds = league_odds.get(game_id, {})

            if not game_odds:
                try:
                    r3 = await client.get(f"{PIN_BASE}/matchups/{game_id}/markets/straight", headers=H_PIN, timeout=8)
                    if r3.status_code == 200:
                        for entry in r3.json():
                            mtype = entry.get("type")
                            if mtype and entry.get("period", 0) == 0:
                                game_odds[mtype] = entry
                except Exception:
                    pass

            pin_bk = {}
            ml = game_odds.get("moneyline")
            if ml:
                parsed = _parse_ml(ml.get("prices", []))
                if parsed:
                    pin_bk = parsed
            tot = game_odds.get("total")
            ou_data = _parse_total(tot.get("prices", [])) if tot else None

            bookmakers = {"pinnacle": pin_bk} if pin_bk else {}
            if pin_bk:
                if "draw" in pin_bk:
                    raw, lbls = [pin_bk["home"], pin_bk["draw"], pin_bk["away"]], [home, "Empate", away]
                else:
                    raw, lbls = [pin_bk["home"], pin_bk["away"]], [home, away]
                impl = remove_vig(raw)
                markets = [make_market(lbls[i], raw[i], impl[i], house="Pinnacle") for i in range(len(raw))]
                if ou_data:
                    impl2 = remove_vig([ou_data["over"], ou_data["under"]])
                    markets.append(make_market(f"Acima de {ou_data['line']}", ou_data["over"], impl2[0], "Gols", house="Pinnacle"))
                    markets.append(make_market(f"Abaixo de {ou_data['line']}", ou_data["under"], impl2[1], "Gols", house="Pinnacle"))
                source = "pinnacle (odds reais)"
            else:
                if "soccer" in sport_key:
                    ho, dr, aw = estimate_soccer_odds(home, away)
                    raw, lbls = [ho, dr, aw], [home, "Empate", away]
                else:
                    ho, aw = estimate_basketball_odds(home, away)
                    raw, lbls = [ho, aw], [home, away]
                impl = remove_vig(raw)
                markets = [make_market(lbls[i], raw[i], impl[i], house="Estimado") for i in range(len(raw))]
                source = "pinnacle (odds estimadas)"

            games.append(
                {
                    "id": f"{sport_key}_{game_id}",
                    "sport": sport_key,
                    "league": league_name,
                    "home": home,
                    "away": away,
                    "date": gd,
                    "hour": hour,
                    "markets": markets,
                    "bookmakers": bookmakers,
                    "commence_time": dt.isoformat(),
                    "source": source,
                }
            )
    except Exception:
        return []
    return games


async def fetch_all_pinnacle(client: httpx.AsyncClient, today: str, tomorrow: str, progress_callback=None):
    """Busca dinamicamente TODAS as ligas e jogos da Pinnacle para os esportes suportados."""
    all_found = []
    seen_ids = set()

    try:
        if progress_callback: await progress_callback(12, "Consultando esportes Pinnacle...")
        # 1. Buscar todos os esportes para validar quais estão ativos
        r_sports = await client.get(f"{PIN_BASE}/sports", headers=H_PIN, timeout=10)
        if r_sports.status_code != 200:
            return []
        
        sports_data = r_sports.json()
        active_sports = [s for s in sports_data if s.get("id") in PIN_SPORT_MAP]
        
        # 2. Para cada esporte, buscar as ligas
        total_sports = len(active_sports)
        for idx, sport in enumerate(active_sports):
            s_id = sport["id"]
            s_key = PIN_SPORT_MAP[s_id]
            s_name = sport.get("name", s_key)
            
            if progress_callback: 
                prog = 15 + int((idx / total_sports) * 20)
                await progress_callback(prog, f"Buscando ligas Pinnacle: {s_name}...")

            try:
                r_leagues = await client.get(f"{PIN_BASE}/sports/{s_id}/leagues?hasOfferings=true", headers=H_PIN, timeout=10)
                if r_leagues.status_code != 200:
                    continue
                
                leagues = r_leagues.json()
                
                # 3. Buscar jogos de cada liga
                tasks = []
                for league in leagues:
                    tasks.append(fetch_pinnacle_league(client, league["id"], league["name"], s_key, today, tomorrow))
                
                total_leagues = len(tasks)
                batch_size = 5
                for i in range(0, total_leagues, batch_size):
                    if progress_callback:
                        # Progresso entre 15% e 45%
                        p = 15 + int((idx / total_sports) * 30) + int((i / total_leagues) * (30 / total_sports))
                        await progress_callback(min(45, p), f"Pinnacle: {s_name} ({i}/{total_leagues})")
                    
                    batch = tasks[i : i + batch_size]
                    results = await asyncio.gather(*batch, return_exceptions=True)
                    for res in results:
                        if isinstance(res, list):
                            for g in res:
                                if g["id"] not in seen_ids:
                                    seen_ids.add(g["id"])
                                    all_found.append(g)
            except Exception:
                continue

    except Exception as e:
        print(f"Erro geral Pinnacle dinâmico: {e}")
    
    return all_found


def _parse_betexplorer_dt(data_dt: str) -> Optional[datetime]:
    parts = (data_dt or "").split(",")
    if len(parts) != 5:
        return None
    try:
        day, month, year, hour, minute = [int(x.strip()) for x in parts]
        return datetime(year, month, day, hour, minute, tzinfo=BRT)
    except Exception:
        return None


def _parse_betexplorer_odd_from_cell(td) -> float:
    btn = td.find("button")
    if btn:
        odd = _safe_float(btn.get("data-odd"))
        if odd > 1:
            return odd
        onclick = btn.get("onclick", "")
        m = re.search(r"'([0-9]+(?:\.[0-9]+)?)'", onclick)
        if m:
            odd = _safe_float(m.group(1))
            if odd > 1:
                return odd
    txt = td.get_text(" ", strip=True)
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", txt)
    return _safe_float(m.group(1)) if m else 0.0


async def fetch_betexplorer_page(client, url: str, sport_key: str, today: str, tomorrow: str):
    games = []
    try:
        r = await client.get(url, headers=H_HTML, timeout=20)
        if r.status_code != 200 or not r.text:
            return []

        soup = BeautifulSoup(r.text, "lxml")
        table = soup.find("table", class_="table-main")
        if not table:
            return []

        current_league = "BetExplorer Soccer"
        for tr in table.find_all("tr"):
            classes = tr.get("class", [])
            if "js-tournament" in classes:
                a = tr.find("a", class_="table-main__tournament")
                if a:
                    current_league = a.get_text(" ", strip=True)
                continue

            data_dt = tr.get("data-dt")
            if not data_dt:
                continue
            dt = _parse_betexplorer_dt(data_dt)
            if not dt:
                continue
            gd = dt.strftime("%Y-%m-%d")
            if gd not in (today, tomorrow):
                continue

            tds = tr.find_all("td")
            if not tds:
                continue

            left = tds[0]
            a = left.find("a", href=True)
            if not a:
                continue
            matchup = a.get_text(" ", strip=True)
            if " - " not in matchup:
                continue
            home, away = [x.strip() for x in matchup.split(" - ", 1)]
            if not home or not away:
                continue

            odd_cells = tr.find_all("td", class_="table-main__odds")
            if len(odd_cells) < 2:
                continue
            odd1 = _parse_betexplorer_odd_from_cell(odd_cells[0])
            oddx = _parse_betexplorer_odd_from_cell(odd_cells[1]) if len(odd_cells) >= 3 else 0.0
            odd2 = _parse_betexplorer_odd_from_cell(odd_cells[2]) if len(odd_cells) >= 3 else _parse_betexplorer_odd_from_cell(odd_cells[1])

            if odd1 <= 1 or odd2 <= 1:
                continue

            be_book = {"home": odd1, "away": odd2}
            if oddx > 1:
                be_book["draw"] = oddx

            if "draw" in be_book:
                raw = [be_book["home"], be_book["draw"], be_book["away"]]
                labels = [home, "Empate", away]
            else:
                raw = [be_book["home"], be_book["away"]]
                labels = [home, away]

            impl = remove_vig(raw)
            markets = [make_market(labels[i], raw[i], impl[i], house="BetExplorer") for i in range(len(raw))]

            href = a.get("href", "")
            m_id = re.search(r"/([A-Za-z0-9]+)/?$", href)
            be_id = m_id.group(1) if m_id else f"{_normalize_team(home)}_{_normalize_team(away)}_{gd}_{dt.strftime('%H%M')}"

            games.append(
                {
                    "id": f"{sport_key}_betexplorer_{be_id}",
                    "sport": sport_key,
                    "league": current_league,
                    "home": home,
                    "away": away,
                    "date": gd,
                    "hour": dt.strftime("%H:%M"),
                    "markets": markets,
                    "bookmakers": {"betexplorer": be_book},
                    "commence_time": dt.isoformat(),
                    "source": f"betexplorer (odds reais)",
                }
            )
    except Exception:
        return []

    return games


async def fetch_betexplorer_all(client, today: str, tomorrow: str, progress_callback=None):
    # Lista expandida de esportes suportados pela BetExplorer
    sports = ["soccer", "basketball", "hockey", "tennis", "handball", "volleyball"]
    dynamic_pages = []
    
    for sport in sports:
        for date_str in (today, tomorrow):
            y, m, d = date_str.split("-")
            # URL de calendário exaustivo por esporte e data
            url = f"https://www.betexplorer.com/next/{sport}/?year={y}&month={m}&day={d}"
            dynamic_pages.append((url, f"{sport}_global"))
    
    out = []
    seen = set()
    total_pages = len(dynamic_pages)
    
    # Processar em batches para progresso mais suave
    batch_size = 2
    for i in range(0, total_pages, batch_size):
        if progress_callback:
            prog = 50 + int((i / total_pages) * 35)
            await progress_callback(min(85, prog), f"BetExplorer ({i}/{total_pages} págs)")
            
        batch = dynamic_pages[i : i + batch_size]
        tasks = [fetch_betexplorer_page(client, url, sport_key, today, tomorrow) for url, sport_key in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for r in results:
            if isinstance(r, list):
                for g in r:
                    if g["id"] not in seen:
                        seen.add(g["id"])
                        out.append(g)
    
    return out


async def fetch_real_games(
    min_prob: float = 0.0,
) -> dict:
    today = datetime.now(BRT).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(BRT) + timedelta(days=1)).strftime("%Y-%m-%d")

    all_games: List[dict] = []
    sources_used: List[str] = []
    errors: List[str] = []

    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        try:
            pin_games = await fetch_all_pinnacle(client, today, tomorrow)
            all_games.extend(pin_games)
            sources_used.append(f"Pinnacle ({len(pin_games)} jogos)")
        except Exception as e:
            errors.append(f"Pinnacle: {e}")

        try:
            be_games = await fetch_betexplorer_all(client, today, tomorrow)
            all_games.extend(be_games)
            sources_used.append(f"BetExplorer ({len(be_games)} jogos)")
        except Exception as e:
            errors.append(f"BetExplorer: {e}")

    raw_count = len(all_games)
    all_games = deduplicate_games(all_games)
    dedup_removed = raw_count - len(all_games)
    sources_used.append(f"Deduplicacao global: -{dedup_removed} jogos")

    if min_prob > 0:
        all_games = [g for g in all_games if any(m.get("model_prob", 0) >= min_prob for m in g.get("markets", []))]

    total_surebets = sum(1 for g in all_games if g.get("surebet"))
    return {
        "games": all_games,
        "count": len(all_games),
        "surebets": total_surebets,
        "sources": sources_used,
        "errors": errors,
        "today": today,
        "tomorrow": tomorrow,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
