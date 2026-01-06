"""
StockLens - Quick Update Script
Updates all signals with real-time data from Finnhub + Yahoo Finance
"""
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client
from data_client import MultiSourceClient
from sentiment_client import SentimentClient
from loguru import logger
import pandas as pd

load_dotenv()

# Initialize clients
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)
data_client = MultiSourceClient()
sentiment_client = SentimentClient()


def calculate_rsi(prices: pd.Series, period: int = 14) -> float:
    """Calculate RSI from price series"""
    if len(prices) < period + 1:
        return 50.0
    
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    return float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0


def calculate_atr(df: pd.DataFrame, period: int = 14) -> float:
    """Calculate ATR from OHLC data"""
    if len(df) < period:
        return 0.0
    
    high = df['high']
    low = df['low']
    close = df['close']
    
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    
    return float(atr.iloc[-1]) if not pd.isna(atr.iloc[-1]) else 0.0


def calculate_sma(prices: pd.Series, period: int) -> float:
    """Calculate SMA"""
    if len(prices) < period:
        return float(prices.iloc[-1]) if len(prices) > 0 else 0.0
    return float(prices.rolling(window=period).mean().iloc[-1])


def generate_signal(rsi: float, price: float, atr: float, sma_20: float = None, sma_50: float = None) -> dict:
    """
    Generate trading signal based on Multi-Indicator Strategy:
    - RSI for momentum
    - SMA crossover for trend confirmation
    - ATR for stop loss & take profit levels
    """
    
    # Default SMAs to price if not provided
    sma_20 = sma_20 or price
    sma_50 = sma_50 or price
    
    # Determine trend from SMA
    uptrend = sma_20 > sma_50
    downtrend = sma_20 < sma_50
    price_above_sma20 = price > sma_20
    price_below_sma20 = price < sma_20
    
    # Multi-Indicator Signal Logic (adjusted thresholds)
    direction = "NONE"
    verdict = "HOLD"
    
    # STRONG BUY: RSI oversold zone (<40) + price above SMA20 (bounce)
    if rsi < 40 and price_above_sma20:
        direction = "LONG"
        verdict = "STRONG_BUY"
    # BUY: RSI neutral-low (<50) + clear uptrend (SMA20 > SMA50)
    elif rsi < 50 and uptrend and price_above_sma20:
        direction = "LONG"
        verdict = "BUY"
    # STRONG SELL: RSI overbought zone (>60) + price below SMA20 (rejection)
    elif rsi > 60 and price_below_sma20:
        direction = "SHORT"
        verdict = "STRONG_SELL"
    # SELL: RSI neutral-high (>50) + clear downtrend (SMA20 < SMA50)
    elif rsi > 50 and downtrend and price_below_sma20:
        direction = "SHORT"
        verdict = "SELL"
    # Additional: Strong trend signals
    elif uptrend and price_above_sma20 and rsi > 40 and rsi < 65:
        direction = "LONG"
        verdict = "BUY"
    elif downtrend and price_below_sma20 and rsi < 60 and rsi > 35:
        direction = "SHORT"
        verdict = "SELL"
    # HOLD: No clear signal
    else:
        direction = "NONE"
        verdict = "HOLD"
    
    # Calculate Entry, SL, TP based on direction
    if direction == "LONG":
        entry = price
        sl = entry - (2 * atr)
        tp1 = entry + (1.5 * atr)
        tp2 = entry + (3 * atr)
    elif direction == "SHORT":
        entry = price
        sl = entry + (2 * atr)
        tp1 = entry - (1.5 * atr)
        tp2 = entry - (3 * atr)
    else:
        entry = price
        sl = None
        tp1 = None
        tp2 = None
    
    # Calculate risk:reward
    if sl and tp2 and direction == "LONG":
        risk = entry - sl
        reward = tp2 - entry
        rr = round(reward / risk, 2) if risk > 0 else 0
    elif sl and tp2 and direction == "SHORT":
        risk = sl - entry
        reward = entry - tp2
        rr = round(reward / risk, 2) if risk > 0 else 0
    else:
        rr = None
    
    return {
        "signal_direction": direction,
        "entry_price": entry,
        "stop_loss": sl,
        "take_profit_1": tp1,
        "take_profit_2": tp2,
        "risk_reward_ratio": rr,
        "hybrid_verdict": verdict,
    }


def update_all_signals():
    """Update all signals with real-time data"""
    
    print("\n" + "="*60)
    print("🚀 StockLens Quick Update")
    print("="*60)
    
    # Get all assets
    assets = supabase.table("market_assets").select("id, symbol").execute()
    
    if not assets.data:
        print("❌ No assets found!")
        return
    
    symbols = [a["symbol"] for a in assets.data]
    asset_ids = {a["symbol"]: a["id"] for a in assets.data}
    
    print(f"\n📊 Updating {len(symbols)} symbols...")
    
    for symbol in symbols:
        print(f"\n🔄 Processing {symbol}...")
        
        # Get quote
        quote = data_client.get_quote(symbol)
        if not quote:
            print(f"  ❌ No quote data")
            continue
        
        price = quote["current_price"]
        print(f"  💰 Price: ${price:.4f} ({quote['price_change_pct']:+.2f}%)")
        
        # Get historical for indicators (3 months for better SMA50)
        df = data_client.get_historical_data(symbol, period="3mo", interval="1d")
        
        if df.empty:
            print(f"  ⚠️ No historical data, using defaults")
            rsi = 50.0
            atr = price * 0.01  # 1% as default ATR
            sma_20 = price
            sma_50 = price
        else:
            rsi = calculate_rsi(df["close"])
            atr = calculate_atr(df)
            sma_20 = calculate_sma(df["close"], 20)
            sma_50 = calculate_sma(df["close"], min(50, len(df)))
            print(f"  📈 RSI: {rsi:.1f}, ATR: ${atr:.4f}")
            print(f"  📊 SMA20: ${sma_20:.2f}, SMA50: ${sma_50:.2f}")
        
        # Generate signal with multi-indicator strategy
        signal = generate_signal(rsi, price, atr, sma_20, sma_50)
        print(f"  🎯 Signal: {signal['signal_direction']} | {signal['hybrid_verdict']}")
        
        # Get sentiment analysis
        sentiment = sentiment_client.get_sentiment(symbol)
        if sentiment:
            print(f"  📰 Sentiment: {sentiment['sentiment_score']:.3f} ({sentiment['sentiment_label']}) - {sentiment['news_count']} articles")
        else:
            sentiment = {"sentiment_score": 0, "sentiment_label": "NEUTRAL", "news_count": 0}
        
        # Prepare data
        rsi_signal = "oversold" if rsi < 30 else "overbought" if rsi > 70 else "neutral"
        
        data = {
            "asset_id": asset_ids[symbol],
            "symbol": symbol,
            "timeframe": "H1",
            "current_price": price,
            "price_change_pct": quote["price_change_pct"],
            "high_24h": quote.get("high_24h"),
            "low_24h": quote.get("low_24h"),
            "rsi_14": rsi,
            "rsi_signal": rsi_signal,
            "atr_14": atr,
            "sma_20": sma_20,
            "sma_50": sma_50,
            "sentiment_score": sentiment["sentiment_score"],
            "sentiment_label": sentiment["sentiment_label"],
            "news_count": sentiment["news_count"],
            "signal_direction": signal["signal_direction"],
            "entry_price": signal["entry_price"],
            "stop_loss": signal["stop_loss"],
            "take_profit_1": signal["take_profit_1"],
            "take_profit_2": signal["take_profit_2"],
            "risk_reward_ratio": signal["risk_reward_ratio"],
            "hybrid_verdict": signal["hybrid_verdict"],
            "hybrid_score": 75 if "BUY" in signal["hybrid_verdict"] else 25 if "SELL" in signal["hybrid_verdict"] else 50,
            "confidence_level": 70.0,
            "last_updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Upsert to database
        try:
            supabase.table("signals_cache").upsert(
                data,
                on_conflict="symbol,timeframe"
            ).execute()
            print(f"  ✅ Saved to database")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    print("\n" + "="*60)
    print("✅ Update complete!")
    print("="*60)


if __name__ == "__main__":
    update_all_signals()
