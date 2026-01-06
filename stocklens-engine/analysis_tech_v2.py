"""
StockLens Engine - Technical Analysis Module v2.0
Fetches price data from AlphaVantage and calculates:
- RSI (14) for trend direction
- ATR (14) for volatility-based money management
- Entry, Stop Loss, Take Profit levels

STRICT RULE: Global Markets Only
- NO Indonesian assets (IDX, .JK, IDR pairs)  
- ALLOWED: XAUUSD, EURUSD, GBPUSD, TSLA, AAPL, NVDA

API ENDPOINTS:
- Stocks (AAPL, TSLA, NVDA): TIME_SERIES_INTRADAY (60min)
- Forex/Commodities (XAUUSD, EURUSD): FX_INTRADAY (60min)
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
    OVERSOLD = "oversold"       # RSI < 30 - Buy signal
    NEUTRAL = "neutral"         # 30 <= RSI <= 70
    OVERBOUGHT = "overbought"   # RSI > 70 - Sell signal


class SignalDirection(Enum):
    """Trade direction"""
    LONG = "LONG"
    SHORT = "SHORT"
    NONE = "NONE"


@dataclass
class TradingLevels:
    """ATR-based trading levels"""
    direction: SignalDirection
    entry_price: Optional[float]
    stop_loss: Optional[float]
    take_profit_1: Optional[float]
    take_profit_2: Optional[float]
    risk_reward_ratio: Optional[float]
    atr_14: Optional[float]


@dataclass
class TechnicalResult:
    """Result of technical analysis with trading levels"""
    symbol: str
    timeframe: str  # 'H1', 'H4', 'D1'
    
    # Price data
    current_price: Optional[float]
    price_change_pct: Optional[float]
    high_24h: Optional[float]
    low_24h: Optional[float]
    volume: Optional[float]
    
    # Technical indicators
    rsi_14: Optional[float]
    rsi_signal: RSISignal
    atr_14: Optional[float]
    sma_20: Optional[float]
    sma_50: Optional[float]
    
    # Trading levels (Money Management)
    trading_levels: Optional[TradingLevels]
    
    # Signal
    technical_signal: TechnicalSignal
    confidence: float  # 0-100
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        result = {
            'timeframe': self.timeframe,
            'current_price': self.current_price,
            'price_change_pct': self.price_change_pct,
            'high_24h': self.high_24h,
            'low_24h': self.low_24h,
            'rsi_14': self.rsi_14,
            'rsi_signal': self.rsi_signal.value if self.rsi_signal else None,
            'atr_14': self.atr_14,
            'sma_20': self.sma_20,
            'sma_50': self.sma_50,
        }
        
        # Add trading levels
        if self.trading_levels:
            result.update({
                'signal_direction': self.trading_levels.direction.value if self.trading_levels.direction else None,
                'entry_price': self.trading_levels.entry_price,
                'stop_loss': self.trading_levels.stop_loss,
                'take_profit_1': self.trading_levels.take_profit_1,
                'take_profit_2': self.trading_levels.take_profit_2,
                'risk_reward_ratio': self.trading_levels.risk_reward_ratio,
            })
        
        return result


class AlphaVantageClient:
    """Client for AlphaVantage API with rate limiting"""
    
    BASE_URL = "https://www.alphavantage.co/query"
    RATE_LIMIT_DELAY = 12  # seconds between calls (5 per minute for free tier)
    
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
            response = requests.get(self.BASE_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Check for API errors
            if "Error Message" in data:
                logger.error(f"AlphaVantage API error: {data['Error Message']}")
                return None
            if "Note" in data:
                logger.warning(f"AlphaVantage rate limit: {data['Note']}")
                time.sleep(60)
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
        Fetch intraday (H1) time series data for STOCKS
        
        Args:
            symbol: Stock symbol (AAPL, TSLA, NVDA)
            interval: '60min' for H1 timeframe
            outputsize: 'compact' (100 candles) or 'full'
        
        Returns:
            DataFrame with OHLCV data
        """
        logger.info(f"📊 Fetching {interval} data for {symbol}...")
        
        params = {
            "function": "TIME_SERIES_INTRADAY",
            "symbol": symbol,
            "interval": interval,
            "outputsize": outputsize
        }
        
        data = self._make_request(params)
        if not data:
            return None
        
        time_series_key = f"Time Series ({interval})"
        if time_series_key not in data:
            logger.error(f"No intraday data found for {symbol}")
            return None
        
        try:
            df = pd.DataFrame.from_dict(data[time_series_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
            df.columns = ['open', 'high', 'low', 'close', 'volume']
            df = df.astype(float)
            logger.debug(f"✓ Fetched {len(df)} H1 candles for {symbol}")
            return df
        except Exception as e:
            logger.error(f"Error parsing intraday data for {symbol}: {e}")
            return None
    
    def get_fx_intraday_data(
        self,
        from_symbol: str,
        to_symbol: str,
        interval: str = "60min",
        outputsize: str = "compact"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch intraday (H1) data for FOREX/COMMODITIES
        
        USE THIS FOR: XAUUSD, EURUSD, GBPUSD
        
        Args:
            from_symbol: Base (XAU, EUR, GBP)
            to_symbol: Quote (USD)
            interval: '60min' for H1
        
        Returns:
            DataFrame with OHLC data
        """
        logger.info(f"📊 Fetching FX {interval} data for {from_symbol}/{to_symbol}...")
        
        params = {
            "function": "FX_INTRADAY",
            "from_symbol": from_symbol,
            "to_symbol": to_symbol,
            "interval": interval,
            "outputsize": outputsize
        }
        
        data = self._make_request(params)
        if not data:
            return None
        
        time_series_key = f"Time Series FX (Intraday)"
        if time_series_key not in data:
            logger.error(f"No FX intraday data found for {from_symbol}/{to_symbol}")
            return None
        
        try:
            df = pd.DataFrame.from_dict(data[time_series_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
            df.columns = ['open', 'high', 'low', 'close']
            df = df.astype(float)
            df['volume'] = 0.0  # FX has no volume
            logger.debug(f"✓ Fetched {len(df)} H1 candles for {from_symbol}/{to_symbol}")
            return df
        except Exception as e:
            logger.error(f"Error parsing FX intraday data: {e}")
            return None
    
    def get_daily_data(self, symbol: str, outputsize: str = "compact") -> Optional[pd.DataFrame]:
        """Fetch daily data for stocks (fallback)"""
        logger.info(f"📊 Fetching daily data for {symbol}...")
        
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
            df.columns = ['open', 'high', 'low', 'close', 'volume']
            df = df.astype(float)
            return df
        except Exception as e:
            logger.error(f"Error parsing daily data: {e}")
            return None
    
    def get_fx_daily_data(
        self,
        from_symbol: str,
        to_symbol: str,
        outputsize: str = "compact"
    ) -> Optional[pd.DataFrame]:
        """Fetch daily forex data (fallback)"""
        logger.info(f"📊 Fetching FX daily for {from_symbol}/{to_symbol}...")
        
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
            logger.error(f"No FX daily data found")
            return None
        
        try:
            df = pd.DataFrame.from_dict(data[time_series_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
            df.columns = ['open', 'high', 'low', 'close']
            df = df.astype(float)
            df['volume'] = 0.0
            return df
        except Exception as e:
            logger.error(f"Error parsing FX daily data: {e}")
            return None


class TechnicalAnalyzer:
    """Technical analysis with ATR-based money management"""
    
    def __init__(self):
        self.client = AlphaVantageClient()
        logger.info("✓ TechnicalAnalyzer initialized")
    
    @staticmethod
    def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    @staticmethod
    def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """
        Calculate Average True Range (ATR) for volatility
        
        ATR = Average of True Range over N periods
        True Range = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
        """
        high = df['high']
        low = df['low']
        close = df['close']
        
        # Calculate True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        # ATR is the moving average of True Range
        atr = true_range.rolling(window=period).mean()
        return atr
    
    @staticmethod
    def calculate_sma(prices: pd.Series, period: int) -> pd.Series:
        """Calculate Simple Moving Average"""
        return prices.rolling(window=period).mean()
    
    def calculate_trading_levels(
        self,
        current_price: float,
        atr: float,
        rsi: float,
        rsi_signal: RSISignal
    ) -> TradingLevels:
        """
        Calculate Entry, Stop Loss, Take Profit using ATR
        
        LONG (Buy) when RSI < 30 (Oversold):
            Entry = Current Price
            Stop Loss = Entry - (2 * ATR)
            TP1 = Entry + (1.5 * ATR)  -> RR 1:0.75
            TP2 = Entry + (3 * ATR)    -> RR 1:1.5
        
        SHORT (Sell) when RSI > 70 (Overbought):
            Entry = Current Price
            Stop Loss = Entry + (2 * ATR)
            TP1 = Entry - (1.5 * ATR)
            TP2 = Entry - (3 * ATR)
        """
        if atr is None or atr <= 0:
            return TradingLevels(
                direction=SignalDirection.NONE,
                entry_price=current_price,
                stop_loss=None,
                take_profit_1=None,
                take_profit_2=None,
                risk_reward_ratio=None,
                atr_14=atr
            )
        
        # ATR multipliers
        SL_MULTIPLIER = 2.0     # Stop Loss = 2 ATR
        TP1_MULTIPLIER = 1.5    # Take Profit 1 = 1.5 ATR (RR 1:0.75)
        TP2_MULTIPLIER = 3.0    # Take Profit 2 = 3 ATR (RR 1:1.5)
        
        if rsi_signal == RSISignal.OVERSOLD:  # RSI < 30 -> LONG
            direction = SignalDirection.LONG
            entry = current_price
            stop_loss = entry - (SL_MULTIPLIER * atr)
            tp1 = entry + (TP1_MULTIPLIER * atr)
            tp2 = entry + (TP2_MULTIPLIER * atr)
            risk = entry - stop_loss
            reward = tp2 - entry
            rr_ratio = round(reward / risk, 2) if risk > 0 else 0
            
        elif rsi_signal == RSISignal.OVERBOUGHT:  # RSI > 70 -> SHORT
            direction = SignalDirection.SHORT
            entry = current_price
            stop_loss = entry + (SL_MULTIPLIER * atr)
            tp1 = entry - (TP1_MULTIPLIER * atr)
            tp2 = entry - (TP2_MULTIPLIER * atr)
            risk = stop_loss - entry
            reward = entry - tp2
            rr_ratio = round(reward / risk, 2) if risk > 0 else 0
            
        else:  # Neutral - no trade
            return TradingLevels(
                direction=SignalDirection.NONE,
                entry_price=current_price,
                stop_loss=None,
                take_profit_1=None,
                take_profit_2=None,
                risk_reward_ratio=None,
                atr_14=atr
            )
        
        return TradingLevels(
            direction=direction,
            entry_price=round(entry, 6),
            stop_loss=round(stop_loss, 6),
            take_profit_1=round(tp1, 6),
            take_profit_2=round(tp2, 6),
            risk_reward_ratio=rr_ratio,
            atr_14=round(atr, 6)
        )
    
    def _get_rsi_signal(self, rsi: float) -> RSISignal:
        """Determine RSI signal"""
        if rsi is None:
            return RSISignal.NEUTRAL
        if rsi < 30:
            return RSISignal.OVERSOLD
        elif rsi > 70:
            return RSISignal.OVERBOUGHT
        return RSISignal.NEUTRAL
    
    def _get_technical_signal(
        self, 
        rsi_signal: RSISignal,
        trading_levels: TradingLevels
    ) -> Tuple[TechnicalSignal, float]:
        """
        Determine overall technical signal and confidence
        """
        if trading_levels.direction == SignalDirection.LONG:
            if trading_levels.risk_reward_ratio and trading_levels.risk_reward_ratio >= 1.5:
                return TechnicalSignal.STRONG_BUY, 80.0
            return TechnicalSignal.BUY, 65.0
        
        elif trading_levels.direction == SignalDirection.SHORT:
            if trading_levels.risk_reward_ratio and trading_levels.risk_reward_ratio >= 1.5:
                return TechnicalSignal.STRONG_SELL, 80.0
            return TechnicalSignal.SELL, 65.0
        
        return TechnicalSignal.HOLD, 50.0
    
    def analyze_symbol(
        self, 
        symbol: str, 
        timeframe: str = "H1"
    ) -> TechnicalResult:
        """
        Analyze a symbol and calculate trading levels
        
        Args:
            symbol: XAUUSD, EURUSD, GBPUSD, TSLA, AAPL, NVDA
            timeframe: 'H1' (hourly), 'H4', 'D1'
        
        Returns:
            TechnicalResult with Entry, SL, TP levels
        """
        logger.info(f"🔍 Analyzing {symbol} ({timeframe})...")
        
        # Determine if forex/commodity or stock
        is_forex = symbol in ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD']
        
        # Fetch data based on symbol type and timeframe
        df = None
        interval = "60min" if timeframe == "H1" else "60min"  # AlphaVantage supports 60min
        
        try:
            if is_forex:
                # Parse forex symbol (e.g., XAUUSD -> XAU, USD)
                from_symbol = symbol[:3]
                to_symbol = symbol[3:]
                
                # Try intraday first, fallback to daily
                df = self.client.get_fx_intraday_data(from_symbol, to_symbol, interval)
                if df is None:
                    logger.warning(f"FX intraday failed, trying daily for {symbol}")
                    df = self.client.get_fx_daily_data(from_symbol, to_symbol)
            else:
                # Stock symbol
                df = self.client.get_intraday_data(symbol, interval)
                if df is None:
                    logger.warning(f"Intraday failed, trying daily for {symbol}")
                    df = self.client.get_daily_data(symbol)
            
            if df is None or len(df) < 20:
                logger.error(f"Insufficient data for {symbol}")
                return TechnicalResult(
                    symbol=symbol,
                    timeframe=timeframe,
                    current_price=None,
                    price_change_pct=None,
                    high_24h=None,
                    low_24h=None,
                    volume=None,
                    rsi_14=None,
                    rsi_signal=RSISignal.NEUTRAL,
                    atr_14=None,
                    sma_20=None,
                    sma_50=None,
                    trading_levels=None,
                    technical_signal=TechnicalSignal.HOLD,
                    confidence=0,
                    error="Insufficient data"
                )
            
            # Calculate indicators
            df['rsi_14'] = self.calculate_rsi(df['close'], 14)
            df['atr_14'] = self.calculate_atr(df, 14)
            df['sma_20'] = self.calculate_sma(df['close'], 20)
            df['sma_50'] = self.calculate_sma(df['close'], 50)
            
            # Get latest values
            latest = df.iloc[-1]
            current_price = latest['close']
            rsi_14 = latest['rsi_14']
            atr_14 = latest['atr_14']
            sma_20 = latest['sma_20']
            sma_50 = latest['sma_50'] if len(df) >= 50 else None
            
            # Calculate price change (last 24 candles for H1)
            lookback = min(24, len(df) - 1)
            if lookback > 0:
                prev_close = df.iloc[-lookback-1]['close']
                price_change_pct = ((current_price - prev_close) / prev_close) * 100
            else:
                price_change_pct = 0
            
            # Get high/low from last 24 candles
            last_24 = df.tail(24)
            high_24h = last_24['high'].max()
            low_24h = last_24['low'].min()
            volume = last_24['volume'].sum() if 'volume' in last_24.columns else 0
            
            # Determine RSI signal
            rsi_signal = self._get_rsi_signal(rsi_14)
            
            # Calculate trading levels using ATR
            trading_levels = self.calculate_trading_levels(
                current_price=current_price,
                atr=atr_14,
                rsi=rsi_14,
                rsi_signal=rsi_signal
            )
            
            # Get overall signal
            tech_signal, confidence = self._get_technical_signal(rsi_signal, trading_levels)
            
            logger.info(f"✅ {symbol}: Price=${current_price:.2f}, RSI={rsi_14:.1f}, ATR={atr_14:.4f}")
            if trading_levels.direction != SignalDirection.NONE:
                logger.info(f"   📍 {trading_levels.direction.value}: Entry=${trading_levels.entry_price:.2f}, SL=${trading_levels.stop_loss:.2f}, TP1=${trading_levels.take_profit_1:.2f}, TP2=${trading_levels.take_profit_2:.2f}")
            
            return TechnicalResult(
                symbol=symbol,
                timeframe=timeframe,
                current_price=round(current_price, 6),
                price_change_pct=round(price_change_pct, 4),
                high_24h=round(high_24h, 6),
                low_24h=round(low_24h, 6),
                volume=volume,
                rsi_14=round(rsi_14, 2) if rsi_14 else None,
                rsi_signal=rsi_signal,
                atr_14=round(atr_14, 6) if atr_14 else None,
                sma_20=round(sma_20, 6) if sma_20 else None,
                sma_50=round(sma_50, 6) if sma_50 else None,
                trading_levels=trading_levels,
                technical_signal=tech_signal,
                confidence=confidence
            )
            
        except Exception as e:
            logger.error(f"❌ Error analyzing {symbol}: {e}")
            return TechnicalResult(
                symbol=symbol,
                timeframe=timeframe,
                current_price=None,
                price_change_pct=None,
                high_24h=None,
                low_24h=None,
                volume=None,
                rsi_14=None,
                rsi_signal=RSISignal.NEUTRAL,
                atr_14=None,
                sma_20=None,
                sma_50=None,
                trading_levels=None,
                technical_signal=TechnicalSignal.HOLD,
                confidence=0,
                error=str(e)
            )


# Test the module
if __name__ == "__main__":
    import sys
    from loguru import logger
    
    # Configure logging
    logger.remove()
    logger.add(sys.stdout, level="DEBUG", colorize=True)
    
    analyzer = TechnicalAnalyzer()
    
    # Test with XAUUSD (Gold)
    result = analyzer.analyze_symbol("XAUUSD", "H1")
    print(f"\n{'='*60}")
    print(f"Symbol: {result.symbol}")
    print(f"Timeframe: {result.timeframe}")
    print(f"Price: ${result.current_price}")
    print(f"RSI: {result.rsi_14} ({result.rsi_signal.value})")
    print(f"ATR: {result.atr_14}")
    print(f"Signal: {result.technical_signal.value}")
    
    if result.trading_levels and result.trading_levels.direction != SignalDirection.NONE:
        print(f"\n📍 TRADE SETUP ({result.trading_levels.direction.value}):")
        print(f"   Entry: ${result.trading_levels.entry_price}")
        print(f"   Stop Loss: ${result.trading_levels.stop_loss}")
        print(f"   Take Profit 1: ${result.trading_levels.take_profit_1}")
        print(f"   Take Profit 2: ${result.trading_levels.take_profit_2}")
        print(f"   Risk:Reward: 1:{result.trading_levels.risk_reward_ratio}")
