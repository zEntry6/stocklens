"""
StockLens Engine Utilities
Common helper functions and constants

STRICT RULE: Global Markets Only
- NO Indonesian assets (IDX, .JK, IDR pairs)
- ALLOWED: Forex, Commodities (XAU/XAG), US Stocks
"""
from typing import Dict, Any, Optional
from decimal import Decimal
import json


def format_price(price: Optional[float], currency: str = "USD") -> str:
    """Format price for display (default: USD)"""
    if price is None:
        return "N/A"
    
    if currency == "USD":
        return f"${price:,.2f}"
    else:
        return f"{price:,.2f}"


def format_percentage(value: Optional[float]) -> str:
    """Format percentage for display"""
    if value is None:
        return "N/A"
    return f"{value:+.2f}%"


def format_number(value: Optional[float], decimals: int = 2) -> str:
    """Format number for display"""
    if value is None:
        return "N/A"
    return f"{value:,.{decimals}f}"


def safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    """Safely convert value to float"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """Safely convert value to int"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


# Asset type mappings
ASSET_TYPE_DISPLAY = {
    'STOCK': '📈 Stock',
    'FOREX': '💱 Forex',
    'CRYPTO': '🪙 Crypto',
    'COMMODITY': '🥇 Commodity',
}

# Verdict colors (for terminal output)
VERDICT_COLORS = {
    'STRONG_BUY': '\033[92m',    # Green
    'BUY': '\033[32m',           # Light green
    'HOLD': '\033[33m',          # Yellow
    'SELL': '\033[31m',          # Light red
    'STRONG_SELL': '\033[91m',   # Red
    'RESET': '\033[0m',
}


def colored_verdict(verdict: str) -> str:
    """Return colored verdict string for terminal"""
    color = VERDICT_COLORS.get(verdict, '')
    reset = VERDICT_COLORS['RESET']
    return f"{color}{verdict}{reset}"


# =========================================
# GLOBAL MARKETS ONLY - NO INDONESIAN ASSETS
# =========================================

# Commodities
COMMODITIES = ['XAUUSD', 'XAGUSD']

# Major Forex Pairs
MAJOR_FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY']

# US Tech Stocks
US_TECH_STOCKS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL']

# All supported symbols
ALL_SYMBOLS = COMMODITIES + MAJOR_FOREX_PAIRS + US_TECH_STOCKS
