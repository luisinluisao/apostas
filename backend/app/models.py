from pydantic import BaseModel
from typing import List, Optional


class Market(BaseModel):
    label: str
    odds: float
    house: Optional[str] = None
    implied_prob: float
    model_prob: float
    ev: float
    confidence: str
    market: str


class Game(BaseModel):
    id: str
    sport: str
    league: str
    home: str
    away: str
    date: str
    hour: str
    markets: List[Market]
    commence_time: str


class BetSelection(BaseModel):
    game_id: str
    home: str
    away: str
    league: str
    hour: str
    pick_label: str
    odds: float
    house: Optional[str] = None
    model_prob: float
    ev: float
    confidence: str


class Multiple(BaseModel):
    id: int
    mode: str
    selections: List[BetSelection]
    total_odds: float
    total_prob_pct: float
    total_ev: float
    potential_profit: float
    stake: float
    legs: int
