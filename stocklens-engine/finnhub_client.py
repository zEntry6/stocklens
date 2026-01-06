"""
StockLens - Finnhub Client for Forex Data
Finnhub free tier supports:
- Forex quotes (real-time)
- Forex candles (historical)
- Forex symbols list
"""
import os
import time
import requests
import pandas as pd
from datetime import datetime, timedelta
from loguru import logger
from dotenv import load_dotenv

load_dotenv()


class FinnhubClient:
    """Client for Finnhub API - Forex and Stock data"""
    
    BASE_URL = "https://finnhub.io/api/v1"
    
    def __init__(self):
        self.api_key = os.getenv("FINNHUB_API_KEY")
        if not self.api_key:
            raise ValueError("FINNHUB_API_KEY not found in environment")
        
        self.session = requests.Session()
        self.last_request_time = 0
        self.min_request_interval = 1.0  # 1 second between requests (60/min limit)
        
        logger.info("✓ Finnhub client initialized")
    
    def _rate_limit(self):
        """Ensure we don't exceed rate limits"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint: str, params: dict = None) -> dict:
        """Make API request with rate limiting"""
        self._rate_limit()
        
        if params is None:
            params = {}
        params["token"] = self.api_key
        
        url = f"{self.BASE_URL}/{endpoint}"
        
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Finnhub API error: {e}")
            return {}
    
    def get_forex_quote(self, symbol: str) -> dict:
        """
        Get real-time forex quote
        
        Args:
            symbol: Forex pair like "OANDA:EUR_USD" or "OANDA:XAU_USD"
        
        Returns:
            dict with c (current), h (high), l (low), o (open), pc (previous close)
        """
        # Convert our symbol format to Finnhub format
        finnhub_symbol = self._convert_symbol(symbol)
        
        data = self._make_request("quote", {"symbol": finnhub_symbol})
        
        if data and data.get("c", 0) > 0:
            return {
                "current_price": data.get("c"),
                "high": data.get("h"),
                "low": data.get("l"),
                "open": data.get("o"),
                "previous_close": data.get("pc"),
                "change_percent": data.get("dp", 0),
            }
        
        return {}
    
    def get_forex_candles(self, symbol: str, resolution: str = "60", days: int = 30) -> pd.DataFrame:
        """
        Get historical forex candles
        
        Args:
            symbol: Forex pair like "XAUUSD" or "EURUSD"
            resolution: Timeframe - 1, 5, 15, 30, 60, D, W, M
            days: Number of days of history
        
        Returns:
            DataFrame with OHLCV data
        """
        finnhub_symbol = self._convert_symbol(symbol)
        
        # Calculate timestamps
        end_time = int(datetime.now().timestamp())
        start_time = int((datetime.now() - timedelta(days=days)).timestamp())
        
        params = {
            "symbol": finnhub_symbol,
            "resolution": resolution,
            "from": start_time,
            "to": end_time,
        }
        
        data = self._make_request("forex/candle", params)
        
        if data and data.get("s") == "ok":
            df = pd.DataFrame({
                "timestamp": pd.to_datetime(data["t"], unit="s"),
                "open": data["o"],
                "high": data["h"],
                "low": data["l"],
                "close": data["c"],
                "volume": data.get("v", [0] * len(data["t"])),
            })
            df.set_index("timestamp", inplace=True)
            return df
        
        logger.warning(f"No candle data for {symbol}: {data.get('s', 'unknown error')}")
        return pd.DataFrame()
    
    def get_stock_quote(self, symbol: str) -> dict:
        """Get real-time stock quote"""
        data = self._make_request("quote", {"symbol": symbol})
        
        if data and data.get("c", 0) > 0:
            return {
                "current_price": data.get("c"),
                "high": data.get("h"),
                "low": data.get("l"),
                "open": data.get("o"),
                "previous_close": data.get("pc"),
                "change_percent": data.get("dp", 0),
            }
        
        return {}
    
    def get_stock_candles(self, symbol: str, resolution: str = "60", days: int = 30) -> pd.DataFrame:
        """Get historical stock candles"""
        end_time = int(datetime.now().timestamp())
        start_time = int((datetime.now() - timedelta(days=days)).timestamp())
        
        params = {
            "symbol": symbol,
            "resolution": resolution,
            "from": start_time,
            "to": end_time,
        }
        
        data = self._make_request("stock/candle", params)
        
        if data and data.get("s") == "ok":
            df = pd.DataFrame({
                "timestamp": pd.to_datetime(data["t"], unit="s"),
                "open": data["o"],
                "high": data["h"],
                "low": data["l"],
                "close": data["c"],
                "volume": data.get("v", [0] * len(data["t"])),
            })
            df.set_index("timestamp", inplace=True)
            return df
        
        logger.warning(f"No candle data for {symbol}")
        return pd.DataFrame()
    
    def _convert_symbol(self, symbol: str) -> str:
        """
        Convert our symbol format to Finnhub format
        
        Examples:
            XAUUSD -> OANDA:XAU_USD
            EURUSD -> OANDA:EUR_USD
            GBPUSD -> OANDA:GBP_USD
        """
        # Forex pairs mapping
        forex_map = {
            "XAUUSD": "OANDA:XAU_USD",
            "XAGUSD": "OANDA:XAG_USD",
            "EURUSD": "OANDA:EUR_USD",
            "GBPUSD": "OANDA:GBP_USD",
            "USDJPY": "OANDA:USD_JPY",
            "AUDUSD": "OANDA:AUD_USD",
            "USDCHF": "OANDA:USD_CHF",
            "USDCAD": "OANDA:USD_CAD",
            "NZDUSD": "OANDA:NZD_USD",
            "EURGBP": "OANDA:EUR_GBP",
        }
        
        return forex_map.get(symbol, symbol)
    
    def is_forex(self, symbol: str) -> bool:
        """Check if symbol is a forex pair"""
        forex_symbols = ["XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY", 
                         "AUDUSD", "USDCHF", "USDCAD", "NZDUSD", "EURGBP"]
        return symbol in forex_symbols


# Test the client
if __name__ == "__main__":
    client = FinnhubClient()
    
    # Test forex quote
    print("\n📊 Testing Forex Quotes:")
    for symbol in ["XAUUSD", "EURUSD", "GBPUSD"]:
        quote = client.get_forex_quote(symbol)
        if quote:
            print(f"  {symbol}: ${quote['current_price']:.4f} ({quote['change_percent']:+.2f}%)")
        else:
            print(f"  {symbol}: No data")
    
    # Test stock quote
    print("\n📊 Testing Stock Quotes:")
    for symbol in ["AAPL", "TSLA", "NVDA"]:
        quote = client.get_stock_quote(symbol)
        if quote:
            print(f"  {symbol}: ${quote['current_price']:.2f} ({quote['change_percent']:+.2f}%)")
        else:
            print(f"  {symbol}: No data")
    
    # Test candles
    print("\n📊 Testing Candles (EURUSD):")
    df = client.get_forex_candles("EURUSD", resolution="D", days=5)
    if not df.empty:
        print(df.tail())
    else:
        print("  No candle data")
