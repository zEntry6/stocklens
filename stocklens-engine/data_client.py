"""
StockLens - Multi-Source Data Client
Combines multiple free APIs for best coverage:
- Finnhub: US Stocks (real-time quotes)
- Yahoo Finance: Forex, Commodities, Stocks (delayed ~15min)
- AlphaVantage: Fallback for daily data
"""
import os
import time
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from loguru import logger
from dotenv import load_dotenv

load_dotenv()


class MultiSourceClient:
    """
    Multi-source data client for maximum free tier coverage
    """
    
    # Yahoo Finance symbol mapping
    YAHOO_SYMBOLS = {
        # Commodities
        "XAUUSD": "GC=F",       # Gold Futures
        "XAGUSD": "SI=F",       # Silver Futures
        
        # Major Forex Pairs
        "EURUSD": "EURUSD=X",   # Euro/USD
        "GBPUSD": "GBPUSD=X",   # GBP/USD
        "USDJPY": "JPY=X",      # USD/JPY
        "AUDUSD": "AUDUSD=X",   # AUD/USD
        "USDCHF": "CHF=X",      # USD/CHF
        "USDCAD": "CAD=X",      # USD/CAD
        "NZDUSD": "NZDUSD=X",   # NZD/USD
        
        # Cross Pairs
        "EURJPY": "EURJPY=X",   # Euro/Yen
        "GBPJPY": "GBPJPY=X",   # GBP/Yen
        "EURGBP": "EURGBP=X",   # Euro/GBP
        "AUDJPY": "AUDJPY=X",   # AUD/Yen
        "CADJPY": "CADJPY=X",   # CAD/Yen
        
        # Crypto
        "BTCUSD": "BTC-USD",    # Bitcoin
        "ETHUSD": "ETH-USD",    # Ethereum
    }
    
    FOREX_SYMBOLS = [
        # Commodities
        "XAUUSD", "XAGUSD",
        # Major Pairs
        "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCHF", "USDCAD", "NZDUSD",
        # Cross Pairs
        "EURJPY", "GBPJPY", "EURGBP", "AUDJPY", "CADJPY",
        # Crypto
        "BTCUSD", "ETHUSD",
    ]
    
    def __init__(self):
        self.finnhub_key = os.getenv("FINNHUB_API_KEY")
        self.last_request_time = 0
        self.min_request_interval = 0.5
        
        logger.info("✓ MultiSource client initialized (Finnhub + Yahoo Finance)")
    
    def _rate_limit(self):
        """Rate limiting"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self.last_request_time = time.time()
    
    def is_forex(self, symbol: str) -> bool:
        """Check if symbol is forex"""
        return symbol in self.FOREX_SYMBOLS
    
    def get_quote(self, symbol: str) -> dict:
        """
        Get real-time quote from best available source
        """
        if self.is_forex(symbol):
            return self._get_yahoo_quote(symbol)
        else:
            # Try Finnhub first for stocks
            quote = self._get_finnhub_quote(symbol)
            if quote:
                return quote
            # Fallback to Yahoo
            return self._get_yahoo_quote(symbol)
    
    def _get_finnhub_quote(self, symbol: str) -> dict:
        """Get stock quote from Finnhub"""
        self._rate_limit()
        
        try:
            url = f"https://finnhub.io/api/v1/quote"
            params = {"symbol": symbol, "token": self.finnhub_key}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data and data.get("c", 0) > 0:
                return {
                    "current_price": data.get("c"),
                    "high_24h": data.get("h"),
                    "low_24h": data.get("l"),
                    "open": data.get("o"),
                    "previous_close": data.get("pc"),
                    "price_change_pct": data.get("dp", 0),
                    "source": "finnhub",
                }
        except Exception as e:
            logger.warning(f"Finnhub quote failed for {symbol}: {e}")
        
        return {}
    
    def _get_yahoo_quote(self, symbol: str) -> dict:
        """Get quote from Yahoo Finance"""
        self._rate_limit()
        
        try:
            # Convert symbol to Yahoo format
            yahoo_symbol = self.YAHOO_SYMBOLS.get(symbol, symbol)
            
            ticker = yf.Ticker(yahoo_symbol)
            info = ticker.info
            
            # Get current price
            current_price = info.get("regularMarketPrice") or info.get("previousClose")
            
            if current_price and current_price > 0:
                prev_close = info.get("previousClose", current_price)
                change_pct = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
                
                return {
                    "current_price": current_price,
                    "high_24h": info.get("dayHigh") or info.get("regularMarketDayHigh"),
                    "low_24h": info.get("dayLow") or info.get("regularMarketDayLow"),
                    "open": info.get("open") or info.get("regularMarketOpen"),
                    "previous_close": prev_close,
                    "price_change_pct": change_pct,
                    "source": "yahoo",
                }
        except Exception as e:
            logger.warning(f"Yahoo quote failed for {symbol}: {e}")
        
        return {}
    
    def get_historical_data(self, symbol: str, period: str = "1mo", interval: str = "1h") -> pd.DataFrame:
        """
        Get historical OHLCV data
        
        Args:
            symbol: Asset symbol
            period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
            interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        """
        try:
            yahoo_symbol = self.YAHOO_SYMBOLS.get(symbol, symbol)
            
            ticker = yf.Ticker(yahoo_symbol)
            df = ticker.history(period=period, interval=interval)
            
            if not df.empty:
                # Rename columns to lowercase
                df.columns = [c.lower() for c in df.columns]
                # Keep only OHLCV
                df = df[["open", "high", "low", "close", "volume"]]
                return df
        except Exception as e:
            logger.warning(f"Historical data failed for {symbol}: {e}")
        
        return pd.DataFrame()
    
    def get_all_quotes(self, symbols: list) -> dict:
        """Get quotes for multiple symbols"""
        results = {}
        for symbol in symbols:
            quote = self.get_quote(symbol)
            if quote:
                results[symbol] = quote
                logger.info(f"✅ {symbol}: ${quote['current_price']:.4f} ({quote['price_change_pct']:+.2f}%) [{quote['source']}]")
            else:
                logger.warning(f"❌ {symbol}: No data")
        return results


# Test
if __name__ == "__main__":
    client = MultiSourceClient()
    
    print("\n" + "="*60)
    print("📊 Testing MultiSource Client")
    print("="*60)
    
    # Test all symbols
    symbols = ["XAUUSD", "EURUSD", "GBPUSD", "AAPL", "TSLA", "NVDA"]
    
    print("\n📈 Real-time Quotes:")
    quotes = client.get_all_quotes(symbols)
    
    print("\n📊 Summary:")
    for symbol, quote in quotes.items():
        print(f"  {symbol}: ${quote['current_price']:.4f} ({quote['price_change_pct']:+.2f}%)")
    
    # Test historical
    print("\n📊 Historical Data (EURUSD - 5 days, daily):")
    df = client.get_historical_data("EURUSD", period="5d", interval="1d")
    if not df.empty:
        print(df)
    else:
        print("  No data")
