"""
StockLens Engine Configuration
Loads environment variables securely

STRICT RULE: Global Markets Only
- NO Indonesian assets (IDX, .JK, IDR pairs)
- ALLOWED: Forex, Commodities (XAUUSD), US Stocks
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration class for StockLens Engine"""
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_DB_PASSWORD: str = os.getenv("SUPABASE_DB_PASSWORD", "")
    
    # API Keys
    ALPHAVANTAGE_API_KEY: str = os.getenv("ALPHAVANTAGE_API_KEY", "")
    MARKETAUX_API_KEY: str = os.getenv("MARKETAUX_API_KEY", "")
    
    # API Endpoints
    ALPHAVANTAGE_BASE_URL: str = "https://www.alphavantage.co/query"
    MARKETAUX_BASE_URL: str = "https://api.marketaux.com/v1/news/all"
    
    # =========================================
    # GLOBAL MARKETS ONLY - NO INDONESIAN ASSETS
    # =========================================
    
    # Commodities (use FX_DAILY: from_symbol=XAU, to_symbol=USD)
    COMMODITIES: list = [
        "XAUUSD",  # Gold
        "XAGUSD",  # Silver
    ]
    
    # Major Forex Pairs (use FX_DAILY)
    FOREX_PAIRS: list = [
        "EURUSD",  # Euro / US Dollar
        "GBPUSD",  # British Pound / US Dollar
        "USDJPY",  # US Dollar / Japanese Yen
    ]
    
    # US Tech Stocks (use TIME_SERIES_DAILY)
    US_STOCKS: list = [
        "AAPL",   # Apple
        "TSLA",   # Tesla
        "NVDA",   # NVIDIA
        "MSFT",   # Microsoft
        "GOOGL",  # Alphabet
    ]
    
    # All symbols combined
    ALL_SYMBOLS: list = COMMODITIES + FOREX_PAIRS + US_STOCKS
    
    # Priority assets for sentiment analysis (to save API quota)
    PRIORITY_SENTIMENT_ASSETS: list = [
        "XAUUSD",  # Gold - high interest
        "EURUSD",  # Major forex pair
        "TSLA",    # High volatility stock
        "NVDA",    # AI hype stock
    ]
    
    @classmethod
    def validate(cls) -> bool:
        """Validate that all required config values are set"""
        required = [
            cls.SUPABASE_URL,
            cls.SUPABASE_KEY,
            cls.ALPHAVANTAGE_API_KEY,
            cls.MARKETAUX_API_KEY,
        ]
        return all(required)
    
    @classmethod
    def get_asset_type(cls, symbol: str) -> str:
        """Determine asset type from symbol"""
        if symbol in cls.COMMODITIES:
            return "COMMODITY"
        elif symbol in cls.FOREX_PAIRS:
            return "FOREX"
        elif symbol in cls.US_STOCKS:
            return "STOCK"
        else:
            return "UNKNOWN"
    
    @classmethod
    def print_status(cls):
        """Print configuration status (without revealing secrets)"""
        print("=" * 50)
        print("StockLens Engine Configuration Status")
        print("=" * 50)
        print(f"SUPABASE_URL: {'✓ Set' if cls.SUPABASE_URL else '✗ Missing'}")
        print(f"SUPABASE_KEY: {'✓ Set' if cls.SUPABASE_KEY else '✗ Missing'}")
        print(f"ALPHAVANTAGE_API_KEY: {'✓ Set' if cls.ALPHAVANTAGE_API_KEY else '✗ Missing'}")
        print(f"MARKETAUX_API_KEY: {'✓ Set' if cls.MARKETAUX_API_KEY else '✗ Missing'}")
        print("=" * 50)
        print(f"Overall Status: {'✓ Ready' if cls.validate() else '✗ Configuration Incomplete'}")
        print("=" * 50)
        print("\nConfigured Assets (Global Markets Only):")
        print(f"  Commodities: {cls.COMMODITIES}")
        print(f"  Forex: {cls.FOREX_PAIRS}")
        print(f"  US Stocks: {cls.US_STOCKS}")
        print("=" * 50)


if __name__ == "__main__":
    Config.print_status()
