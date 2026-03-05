"""
Automatic accumulator (múltipla) generator.
Modes: safe (max total prob) | ev (max expected value)
Rules:
  - 1 selection per game
  - max 3 per league
  - 8–20 legs
  - only EV+ bets in ev mode
"""
from typing import List, Dict, Any
import random
import math


def generate_multiples(
    games: List[Dict],
    mode: str = "safe",
    size_min: int = 8,
    size_max: int = 14,
    count: int = 6,
    stake: float = 10.0,
) -> List[Dict]:
    results = []
    attempts = 0

    while len(results) < count and attempts < count * 20:
        attempts += 1
        target_size = random.randint(size_min, min(size_max, len(games)))
        shuffled = games.copy()
        random.shuffle(shuffled)

        used_games: set = set()
        used_leagues: Dict[str, int] = {}
        selections = []

        for game in shuffled:
            if len(selections) >= target_size:
                break
            if game["id"] in used_games:
                continue
            if used_leagues.get(game["league"], 0) >= 3:
                continue

            # Pick best market for this mode
            candidates = [m for m in game["markets"] if m["model_prob"] >= 0.45]
            if not candidates:
                continue

            if mode == "ev":
                ev_pos = [m for m in candidates if m["ev"] > 0]
                pool = ev_pos if ev_pos else candidates
                pick = max(pool, key=lambda m: m["ev"])
            else:  # safe
                pick = max(candidates, key=lambda m: m["model_prob"])

            if pick["model_prob"] < 0.45:
                continue

            selections.append({"game": game, "pick": pick})
            used_games.add(game["id"])
            used_leagues[game["league"]] = used_leagues.get(game["league"], 0) + 1

        if len(selections) < max(6, size_min):
            continue

        total_odds = 1.0
        total_prob = 1.0
        total_ev = 0.0
        for sel in selections:
            total_odds *= sel["pick"]["odds"]
            total_prob *= sel["pick"]["model_prob"]
            total_ev += sel["pick"]["ev"]

        total_odds = round(total_odds, 2)
        total_prob = round(total_prob * 100, 6)
        total_ev = round(total_ev, 4)
        potential_profit = round(total_odds * stake - stake, 2)

        results.append({
            "id": len(results) + 1,
            "mode": mode,
            "selections": [
                {
                    "game_id": s["game"]["id"],
                    "home": s["game"]["home"],
                    "away": s["game"]["away"],
                    "league": s["game"]["league"],
                    "date": s["game"]["date"],
                    "hour": s["game"]["hour"],
                    "pick_label": s["pick"]["label"],
                    "odds": s["pick"]["odds"],
                    "house": s["pick"].get("house", ""),
                    "model_prob": s["pick"]["model_prob"],
                    "ev": s["pick"]["ev"],
                    "confidence": s["pick"]["confidence"],
                }
                for s in selections
            ],
            "total_odds": total_odds,
            "total_prob_pct": total_prob,
            "total_ev": total_ev,
            "potential_profit": potential_profit,
            "stake": stake,
            "legs": len(selections),
        })

    # Sort results
    if mode == "safe":
        results.sort(key=lambda x: x["total_prob_pct"], reverse=True)
    else:
        results.sort(key=lambda x: x["total_ev"], reverse=True)

    return results
