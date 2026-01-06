"""
StockLens Engine - Technical Analysis Module
Fetches price data from AlphaVantage and calculates technical indicators

STRICT RULE: Global Markets Only
- NO Indonesian assets (IDX, .JK, IDR pairs)  
- ALLOWED: Forex, Commodities (XAU/XAG), US Stocks

API ENDPOINTS:
- Stocks (AAPL, TSLA, etc): TIME_SERIES_DAILY
- Forex/Commodities (XAUUSD, EURUSD): FX_DAILY
"""
import requests
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timezone
import time
import backoff
from loguru import logger

from config import Config


class TechnicalSignal(Enum):
    """Technical analysis signal types"""
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"


class RSISignal(Enum):
    """RSI-specific signals"""
    OVERSOLD = "OVERSOLD"      # RSI < 30 - Buy signal
    NEUTRAL = "NEUTRAL"        # 30 <= RSI <= 70
    OVERBOUGHT = "OVERBOUGHT"  # RSI > 70 - Sell signal


@dataclass
class TechnicalResult:
    """Result of technical analysis"""
    symbol: str
    current_price: Optional[float]
    price_change_24h: Optional[float]
    high_24h: Optional[float]
    low_24h: Optional[float]
    volume_24h: Optional[float]
    rsi_14: Optional[float]
    rsi_signal: RSISignal
    sma_20: Optional[float]
    sma_50: Optional[float]
    macd_line: Optional[float]
    macd_signal_line: Optional[float]
    macd_histogram: Optional[float]
    macd_trend: Optional[str]
    technical_signal: TechnicalSignal
    confidence: float  # 0-100
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            'current_price': self.current_price,
            'price_change_24h': self.price_change_24h,
            'high_24h': self.high_24h,
            'low_24h': self.low_24h,
            'volume_24h': self.volume_24h,
            'rsi_14': self.rsi_14,
            'rsi_signal': self.rsi_signal.value if self.rsi_signal else None,
            'sma_20': self.sma_20,
            'sma_50': self.sma_50,
            'macd_line': self.macd_line,
            'macd_signal_line': self.macd_signal_line,
            'macd_histogram': self.macd_histogram,
            'macd_trend': self.macd_trend,
        }


class AlphaVantageClient:
    """Client for AlphaVantage API with rate limiting and error handling"""
    
    BASE_URL = "https://www.alphavantage.co/query"
    
    # Rate limit: 5 calls per minute for free tier, 75 calls per minute for premium
    RATE_LIMIT_DELAY = 12  # seconds between calls (5 per minute)
    
    def __init__(self):
        self.api_key = Config.ALPHAVANTAGE_API_KEY
        if not self.api_key:
            raise ValueError("ALPHAVANTAGE_API_KEY not configured")
        self._last_call_time = 0
        logger.info("✓ AlphaVantage client initialized")
    
    def _rate_limit(self):
        """Enforce rate limiting between API calls"""
        elapsed = time.time() - self._last_call_time
        if elapsed < self.RATE_LIMIT_DELAY:
            sleep_time = self.RATE_LIMIT_DELAY - elapsed
            logger.debug(f"Rate limiting: sleeping {sleep_time:.1f}s")
            time.sleep(sleep_time)
        self._last_call_time = time.time()
    
    @backoff.on_exception(
        backoff.expo,
        (requests.exceptions.RequestException, requests.exceptions.Timeout),
        max_tries=3,
        max_time=60
    )
    def _make_request(self, params: Dict[str, str]) -> Optional[Dict]:
        """Make API request with retry logic"""
        self._rate_limit()
        
        params['apikey'] = self.api_key
        
        try:
            response = requests.get(
                self.BASE_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            # Check for API errors
            if "Error Message" in data:
                logger.error(f"AlphaVantage API error: {data['Error Message']}")
                return None
            
            if "Note" in data:
                # Rate limit exceeded
                logger.warning(f"AlphaVantage rate limit: {data['Note']}")
                time.sleep(60)  # Wait a minute
                return None
            
            if "Information" in data:
                logger.warning(f"AlphaVantage info: {data['Information']}")
                return None
            
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"AlphaVantage request error: {e}")
            raise
    
    def get_intraday_data(
        self, 
        symbol: str, 
        interval: str = "60min",
        outputsize: str = "compact"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch intraday time series data
        
        Args:
            symbol: Stock symbol (e.g., 'AAPL', 'TSLA', 'MSFT')
            interval: Time interval (1min, 5min, 15min, 30min, 60min)
            outputsize: 'compact' (100 points) or 'full' (full history)
        
        Returns:
            DataFrame with OHLCV data or None on error
        """
        logger.info(f"Fetching intraday data for {symbol}...")
        
        params = {
            "function": "TIME_SERIES_INTRADAY",
            "symbol": symbol,
            "interval": interval,
            "outputsize": outputsize
        }
        
        data = self._make_request(params)
        if not data:
            return None
        
        # Parse time series data
        time_series_key = f"Time Series ({interval})"
        if time_series_key not in data:
            logger.error(f"No time series data found for {symbol}")
            return None
        
        try:
            df = pd.DataFrame.from_dict(data[time_series_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
            
            # Rename columns
            df.columns = ['open', 'high', 'low', 'close', 'volume']
            df = df.astype(float)
            
            logger.debug(f"Fetched {len(df)} data points for {symbol}")
            return df
            
        except Exception as e:
            logger.error(f"Error parsing data for {symbol}: {e}")
            return None
    
    def get_daily_data(
        self, 
        symbol: str,
        outputsize: str = "compact"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch daily time series data
        
        Args:
            symbol: Stock symbol
            outputsize: 'compact' (100 days) or 'full' (20+ years)
        
        Returns:
            DataFrame with OHLCV data or None on error
        """
        logger.info(f"Fetching daily data for {symbol}...")
        
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": outputsize
        }
        
        data = self._make_request(params)
        if not data:
            return None
        
        time_series_key = "Time Series (Daily)"
        if time_series_key not in data:
            logger.error(f"No daily data found for {symbol}")
            return None
        
        try:
            df = pd.DataFrame.from_dict(data[time_series_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
            
            # Rename columns
            df.columns = ['open', 'high', 'low', 'close', 'volume']
            df = df.astype(float)
            
            logger.debug(f"Fetched {len(df)} daily data points for {symbol}")
            return df
            
        except Exception as e:
            logger.error(f"Error parsing daily data for {symbol}: {e}")
            return None
    
    def get_forex_rate(
        self, 
        from_currency: str,
        to_currency: str
    ) -> Optional[Dict[str, float]]:
        """
        Get current forex exchange rate
        
        Args:
            from_currency: Base currency (e.g., 'EUR', 'XAU')
            to_currency: Quote currency (e.g., 'USD')
        
        Returns:
            Dict with exchange rate info or None on error
        """
        logger.info(f"Fetching forex rate for {from_currency}/{to_currency}...")
        
        params = {
            "function": "CURRENCY_EXCHANGE_RATE",
            "from_currency": from_currency,
            "to_currency": to_currency
        }
        
        data = self._make_request(params)
        if not data:
            return None
        
        rate_key = "Realtime Currency Exchange Rate"
        if rate_key not in data:
            logger.error(f"No forex data found for {from_currency}/{to_currency}")
            return None
        
        try:
            rate_data = data[rate_key]
            return {
                'rate': float(rate_data.get('5. Exchange Rate', 0)),
                'bid': float(rate_data.get('8. Bid Price', 0)),
                'ask': float(rate_data.get('9. Ask Price', 0)),
            }
        except Exception as e:
            logger.error(f"Error parsing forex data: {e}")
            return None
    
    def get_fx_daily_data(
        self,
        from_symbol: str,
        to_symbol: str,
        outputsize: str = "compact"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch daily forex/commodity time series data using FX_DAILY
        
        USE THIS FOR: XAUUSD, XAGUSD, EURUSD, GBPUSD, USDJPY
        
        Args:
            from_symbol: Base currency/commodity (e.g., 'XAU', 'EUR')
            to_symbol: Quote currency (e.g., 'USD')
            outputsize: 'compact' (100 days) or 'full' (20+ years)
        
        Returns:
            DataFrame with OHLC data or None on error
        """
        logger.info(f"Fetching FX_DAILY for {from_symbol}/{to_symbol}...")
        
        params = {
            "function": "FX_DAILY",
            "from_symbol": from_symbol,
            "to_symbol": to_symbol,
            "outputsize": outputsize
        }
        
        data = self._make_request(params)
        if not data:
            return None
        
        time_series_key = "Time Series FX (Daily)"
        if time_series_key not in data:
            logger.error(f"No FX_DAILY data found for {from_symbol}/{to_symbol}")
            return None
        
        try:
            df = pd.DataFrame.from_dict(data[time_series_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
            
            # FX_DAILY returns: open, high, low, close (no volume)
            df.columns = ['open', 'high', 'low', 'close']
            df = df.astype(float)
            
            # Add zero volume for consistency
            df['volume'] = 0.0
            
            logger.debug(f"Fetched {len(df)} FX data points for {from_symbol}/{to_symbol}")
            return df
            
        except Exception as e:
            logger.error(f"Error parsing FX_DAILY data for {from_symbol}/{to_symbol}: {e}")
            return None


class TechnicalAnalyzer:
    """Technical analysis calculator using price data"""
    
    def __init__(self):
        self.client = AlphaVantageClient()
    
    @staticmethod
    def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
        """
        Calculate Relative Strength Index (RSI)
        
        RSI = 100 - (100 / (1 + RS))
        RS = Average Gain / Average Loss
        """
        delta = prices.diff()
        
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        
        # Use exponential moving average for smoother results
        avg_gain = gain.ewm(com=period-1, min_periods=period).mean()
        avg_loss = loss.ewm(com=period-1, min_periods=period).mean()
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    @staticmethod
    def calculate_sma(prices: pd.Series, period: int) -> pd.Series:
        """Calculate Simple Moving Average"""
        return prices.rolling(window=period).mean()
    
    @staticmethod
    def calculate_ema(prices: pd.Series, period: int) -> pd.Series:
        """Calculate Exponential Moving Average"""
        return prices.ewm(span=period, adjust=False).mean()
    
    @staticmethod
    def calculate_macd(
        prices: pd.Series,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate MACD (Moving Average Convergence Divergence)
        
        Returns: (macd_line, signal_line, histogram)
        """
        ema_fast = prices.ewm(span=fast, adjust=False).mean()
        ema_slow = prices.ewm(span=slow, adjust=False).mean()
        
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        
        return macd_line, signal_line, histogram
    
    @staticmethod
    def get_rsi_signal(rsi: float) -> RSISignal:
        """Determine RSI signal based on value"""
        if rsi < 30:
            return RSISignal.OVERSOLD
        elif rsi > 70:
            return RSISignal.OVERBOUGHT
        else:
            return RSISignal.NEUTRAL
    
    @staticmethod
    def get_macd_signal(macd_line: float, signal_line: float) -> str:
        """Determine MACD signal"""
        if macd_line > signal_line:
            return "BULLISH"
        elif macd_line < signal_line:
            return "BEARISH"
        else:
            return "NEUTRAL"
    
    def calculate_technical_signal(
        self,
        rsi: Optional[float],
        rsi_signal: RSISignal,
        macd_signal: Optional[str],
        price_vs_sma20: Optional[float],  # Current price / SMA20 ratio
        price_vs_sma50: Optional[float],  # Current price / SMA50 ratio
    ) -> Tuple[TechnicalSignal, float]:
        """
        Calculate overall technical signal with confidence score
        
        Returns: (signal, confidence)
        """
        score = 50  # Start neutral
        confidence_factors = []
        
        # RSI contribution (weight: 35%)
        if rsi is not None:
            if rsi < 20:
                score += 25
                confidence_factors.append(0.9)
            elif rsi < 30:
                score += 15
                confidence_factors.append(0.8)
            elif rsi > 80:
                score -= 25
                confidence_factors.append(0.9)
            elif rsi > 70:
                score -= 15
                confidence_factors.append(0.8)
            else:
                confidence_factors.append(0.5)
        
        # MACD contribution (weight: 25%)
        if macd_signal:
            if macd_signal == "BULLISH":
                score += 12
                confidence_factors.append(0.7)
            elif macd_signal == "BEARISH":
                score -= 12
                confidence_factors.append(0.7)
            else:
                confidence_factors.append(0.4)
        
        # Price vs SMA contribution (weight: 40%)
        if price_vs_sma20 is not None:
            if price_vs_sma20 > 1.02:  # Price > SMA20 by 2%+
                score += 10
            elif price_vs_sma20 < 0.98:  # Price < SMA20 by 2%+
                score -= 10
        
        if price_vs_sma50 is not None:
            if price_vs_sma50 > 1.05:  # Price > SMA50 by 5%+
                score += 8
            elif price_vs_sma50 < 0.95:  # Price < SMA50 by 5%+
                score -= 8
        
        # Determine signal
        if score >= 75:
            signal = TechnicalSignal.STRONG_BUY
        elif score >= 60:
            signal = TechnicalSignal.BUY
        elif score <= 25:
            signal = TechnicalSignal.STRONG_SELL
        elif score <= 40:
            signal = TechnicalSignal.SELL
        else:
            signal = TechnicalSignal.HOLD
        
        # Calculate confidence
        confidence = (sum(confidence_factors) / len(confidence_factors) * 100) if confidence_factors else 50
        
        return signal, confidence
    
    def analyze(self, symbol: str, asset_type: str = "STOCK") -> TechnicalResult:
        """
        Perform full technical analysis on a symbol
        
        GLOBAL MARKETS ONLY:
        - STOCK: AAPL, TSLA, NVDA, MSFT, GOOGL -> TIME_SERIES_DAILY
        - FOREX: EURUSD, GBPUSD, USDJPY -> FX_DAILY
        - COMMODITY: XAUUSD, XAGUSD -> FX_DAILY
        
        Args:
            symbol: Stock/Forex symbol (e.g., "AAPL", "XAUUSD", "EURUSD")
            asset_type: 'STOCK', 'FOREX', 'COMMODITY'
        
        Returns:
            TechnicalResult with all indicators
        """
        logger.info(f"Analyzing {symbol} ({asset_type})...")
        
        try:
            # Fetch data based on asset type
            if asset_type in ["FOREX", "COMMODITY"]:
                # Parse symbol (e.g., "XAUUSD" -> from=XAU, to=USD)
                # "EURUSD" -> from=EUR, to=USD
                # "USDJPY" -> from=USD, to=JPY
                if len(symbol) == 6:
                    from_curr = symbol[:3]
                    to_curr = symbol[3:]
                else:
                    logger.error(f"Invalid forex symbol format: {symbol}")
                    return self._create_error_result(symbol, "Invalid symbol format")
                
                # Get current rate
                rate_data = self.client.get_forex_rate(from_curr, to_curr)
                current_price = rate_data['rate'] if rate_data else None
                
                # Get historical data using FX_DAILY
                df = self.client.get_fx_daily_data(from_curr, to_curr)
                
            else:
                # Stock - use TIME_SERIES_DAILY
                df = self.client.get_daily_data(symbol)
                current_price = None
            
            if df is None or df.empty:
                return self._create_error_result(symbol, "Failed to fetch price data")
            
            # Calculate indicators
            close_prices = df['close']
            
            # Current price (use latest close if not set)
            if current_price is None:
                current_price = float(close_prices.iloc[-1])
            
            # Price change
            if len(close_prices) >= 2:
                prev_close = float(close_prices.iloc[-2])
                price_change = ((current_price - prev_close) / prev_close) * 100
            else:
                price_change = 0
            
            # High/Low (last day)
            high_24h = float(df['high'].iloc[-1])
            low_24h = float(df['low'].iloc[-1])
            volume_24h = float(df['volume'].iloc[-1]) if 'volume' in df.columns else 0.0
            
            # RSI (14)
            rsi_series = self.calculate_rsi(close_prices, period=14)
            rsi_14 = float(rsi_series.iloc[-1]) if not pd.isna(rsi_series.iloc[-1]) else None
            rsi_signal = self.get_rsi_signal(rsi_14) if rsi_14 else RSISignal.NEUTRAL
            
            # SMAs
            sma_20 = float(self.calculate_sma(close_prices, 20).iloc[-1]) if len(close_prices) >= 20 else None
            sma_50 = float(self.calculate_sma(close_prices, 50).iloc[-1]) if len(close_prices) >= 50 else None
            
            # MACD (with detailed values)
            macd_line_val = None
            macd_signal_line_val = None  
            macd_histogram_val = None
            macd_trend = None
            
            if len(close_prices) >= 26:
                macd_line, signal_line, histogram = self.calculate_macd(close_prices)
                macd_line_val = float(macd_line.iloc[-1])
                macd_signal_line_val = float(signal_line.iloc[-1])
                macd_histogram_val = float(histogram.iloc[-1])
                macd_trend = self.get_macd_signal(macd_line_val, macd_signal_line_val)
            
            # Price vs SMA ratios
            price_vs_sma20 = current_price / sma_20 if sma_20 else None
            price_vs_sma50 = current_price / sma_50 if sma_50 else None
            
            # Calculate overall signal
            tech_signal, confidence = self.calculate_technical_signal(
                rsi_14, rsi_signal, macd_trend, price_vs_sma20, price_vs_sma50
            )
            
            rsi_display = f"{rsi_14:.1f}" if rsi_14 else 'N/A'
            logger.info(f"✓ {symbol}: RSI={rsi_display}, Signal={tech_signal.value}, Confidence={confidence:.1f}%")
            
            return TechnicalResult(
                symbol=symbol,
                current_price=current_price,
                price_change_24h=price_change,
                high_24h=high_24h,
                low_24h=low_24h,
                volume_24h=volume_24h,
                rsi_14=rsi_14,
                rsi_signal=rsi_signal,
                sma_20=sma_20,
                sma_50=sma_50,
                macd_line=macd_line_val,
                macd_signal_line=macd_signal_line_val,
                macd_histogram=macd_histogram_val,
                macd_trend=macd_trend,
                technical_signal=tech_signal,
                confidence=confidence
            )
            
        except Exception as e:
            logger.error(f"Error analyzing {symbol}: {e}")
            return self._create_error_result(symbol, str(e))
    
    def _create_error_result(self, symbol: str, error_msg: str) -> TechnicalResult:
        """Create error result for failed analysis"""
        return TechnicalResult(
            symbol=symbol,
            current_price=None,
            price_change_24h=None,
            high_24h=None,
            low_24h=None,
            volume_24h=None,
            rsi_14=None,
            rsi_signal=RSISignal.NEUTRAL,
            sma_20=None,
            sma_50=None,
            macd_line=None,
            macd_signal_line=None,
            macd_histogram=None,
            macd_trend=None,
            technical_signal=TechnicalSignal.HOLD,
            confidence=0,
            error=error_msg
        )


# Global analyzer instance
tech_analyzer = TechnicalAnalyzer()


# Test
if __name__ == "__main__":
    from config import Config
    Config.print_status()
    
    print("\nTesting Technical Analysis (Global Markets Only)...")
    print("=" * 50)
    
    # Test with US Stock
    print("\n📊 Testing US Stock (AAPL)...")
    result = tech_analyzer.analyze("AAPL", "STOCK")
    _print_result(result)
    
    # Note: Due to rate limiting, uncomment these to test other assets
    # print("\n💰 Testing Commodity (XAUUSD)...")
    # result = tech_analyzer.analyze("XAUUSD", "COMMODITY")
    # _print_result(result)
    
    # print("\n💱 Testing Forex (EURUSD)...")
    # result = tech_analyzer.analyze("EURUSD", "FOREX")
    # _print_result(result)


def _print_result(result: TechnicalResult):
    """Helper to print analysis result"""
    print(f"\nSymbol: {result.symbol}")
    print(f"Price: ${result.current_price:,.4f}" if result.current_price else "Price: N/A")
    print(f"Change: {result.price_change_24h:+.2f}%" if result.price_change_24h else "Change: N/A")
    print(f"RSI(14): {result.rsi_14:.1f}" if result.rsi_14 else "RSI: N/A")
    print(f"RSI Signal: {result.rsi_signal.value}")
    print(f"MACD Trend: {result.macd_trend}")
    if result.macd_line:
        print(f"MACD Line: {result.macd_line:.4f}")
        print(f"MACD Signal: {result.macd_signal_line:.4f}")
        print(f"MACD Histogram: {result.macd_histogram:.4f}")
    print(f"Technical Signal: {result.technical_signal.value}")
    print(f"Confidence: {result.confidence:.1f}%")
    
    if result.error:
        print(f"❌ Error: {result.error}")
