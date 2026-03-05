"""
Probability model for betting analysis.
Converts odds → implied prob → model prob with home advantage and vig removal.
"""
from typing import List
import random


def remove_vig(odds: List[float]) -> List[float]:
    """Remove bookmaker margin (vig) and return fair probabilities."""
    if not odds or any(o <= 1 for o in odds):
        return [1 / len(odds)] * len(odds)
    implied = [1 / o for o in odds]
    total = sum(implied)
    return [p / total for p in implied]


def calc_ev(prob: float, odds: float) -> float:
    """Expected Value = p * (odds - 1) - (1 - p)"""
    return round(prob * (odds - 1) - (1 - prob), 4)


def model_probability(implied_prob: float, label: str) -> float:
    """
    Simple model adjustment:
    - Home team gets slight boost (+0 to +8%)
    - Away team gets slight penalty
    - Draw stays roughly the same
    - Clamp to [0.05, 0.95]
    """
    home_keywords = ["Casa", "Home"]
    away_keywords = ["Away", "Visitante"]

    is_home = any(k.lower() in label.lower() for k in home_keywords)
    is_away = any(k.lower() in label.lower() for k in away_keywords)

    # Deterministic adjustment based on label hash so same game = same result
    seed = sum(ord(c) for c in label) % 100
    adjustment = (seed - 50) / 1000  # small ±5% range

    if is_home:
        adjustment += 0.03   # home advantage
    elif is_away:
        adjustment -= 0.02

    result = implied_prob + adjustment
    return round(max(0.05, min(0.95, result)), 4)
