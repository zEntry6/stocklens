"""
StockLens - Seed Script for Testing
Injects dummy XAUUSD signal with realistic ATR-based SL/TP values

Run: python seed_test_data.py
"""
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Initialize Supabase
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def seed_xauusd_signal():
    """
    Seed a realistic XAUUSD LONG signal
    
    Gold example:
    - Current Price: $2030.00
    - ATR (14): ~$15.50 (typical H1 volatility for gold)
    - RSI: 28 (oversold -> LONG signal)
    
    ATR-based levels:
    - Stop Loss = Entry - (2 * ATR) = 2030 - 31 = $1999.00
    - Take Profit 1 = Entry + (1.5 * ATR) = 2030 + 23.25 = $2053.25
    - Take Profit 2 = Entry + (3 * ATR) = 2030 + 46.50 = $2076.50
    - Risk:Reward = 46.50 / 31 = 1.5
    """
    
    # First get the XAUUSD asset ID
    asset_response = supabase.table('market_assets').select('id').eq('symbol', 'XAUUSD').execute()
    
    if not asset_response.data:
        print("❌ XAUUSD not found in market_assets. Run the schema SQL first!")
        return False
    
    asset_id = asset_response.data[0]['id']
    print(f"✓ Found XAUUSD asset_id: {asset_id}")
    
    # Realistic Gold H1 data
    current_price = 2030.00
    atr_14 = 15.50  # Typical H1 ATR for Gold
    rsi_14 = 28.5   # Oversold -> LONG signal
    
    # Calculate ATR-based levels
    sl_multiplier = 2.0
    tp1_multiplier = 1.5
    tp2_multiplier = 3.0
    
    entry_price = current_price
    stop_loss = entry_price - (sl_multiplier * atr_14)  # 2030 - 31 = 1999
    take_profit_1 = entry_price + (tp1_multiplier * atr_14)  # 2030 + 23.25 = 2053.25
    take_profit_2 = entry_price + (tp2_multiplier * atr_14)  # 2030 + 46.50 = 2076.50
    
    risk = entry_price - stop_loss  # 31
    reward = take_profit_2 - entry_price  # 46.50
    risk_reward_ratio = round(reward / risk, 2)  # 1.5
    
    # Signal data
    signal_data = {
        'asset_id': asset_id,
        'symbol': 'XAUUSD',
        'timeframe': 'H1',
        'current_price': current_price,
        'price_change_pct': 0.45,
        'high_24h': 2038.50,
        'low_24h': 2018.25,
        'rsi_14': rsi_14,
        'rsi_signal': 'oversold',
        'atr_14': atr_14,
        'sma_20': 2025.50,
        'sma_50': 2015.00,
        'signal_direction': 'LONG',
        'entry_price': entry_price,
        'stop_loss': stop_loss,
        'take_profit_1': take_profit_1,
        'take_profit_2': take_profit_2,
        'risk_reward_ratio': risk_reward_ratio,
        'sentiment_score': 0.65,
        'sentiment_label': 'POSITIVE',
        'news_count': 5,
        'hybrid_score': 75.0,
        'hybrid_verdict': 'BUY',
        'confidence_level': 72.0,
        'ai_summary': f'XAUUSD is trading at ${current_price:.2f}. RSI({rsi_14:.1f}) indicates oversold (bullish) conditions. ATR volatility is ${atr_14:.2f}. Signal: LONG with Entry=${entry_price:.2f}, SL=${stop_loss:.2f}, TP=${take_profit_1:.2f}. Market sentiment is positive. Overall verdict: BUY.',
        'last_updated_at': datetime.now(timezone.utc).isoformat(),
    }
    
    # Upsert to database
    try:
        response = supabase.table('signals_cache').upsert(
            signal_data,
            on_conflict='symbol,timeframe'
        ).execute()
        
        print("\n" + "="*60)
        print("✅ XAUUSD Signal Seeded Successfully!")
        print("="*60)
        print(f"\n📊 XAUUSD H1 Analysis:")
        print(f"   Price: ${current_price:.2f}")
        print(f"   RSI: {rsi_14:.1f} (Oversold)")
        print(f"   ATR: ${atr_14:.2f}")
        print(f"\n📍 TRADE SETUP (LONG):")
        print(f"   Entry:        ${entry_price:.2f}")
        print(f"   Stop Loss:    ${stop_loss:.2f} (Risk: ${risk:.2f})")
        print(f"   Take Profit 1: ${take_profit_1:.2f}")
        print(f"   Take Profit 2: ${take_profit_2:.2f} (Reward: ${reward:.2f})")
        print(f"   Risk:Reward:  1:{risk_reward_ratio}")
        print(f"\n🎯 Verdict: BUY (Confidence: 72%)")
        print("="*60)
        
        return True
        
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        return False


def seed_all_assets():
    """Seed test data for all 6 assets"""
    
    # Get all asset IDs
    assets_response = supabase.table('market_assets').select('id, symbol').execute()
    
    if not assets_response.data:
        print("❌ No assets found. Run the schema SQL first!")
        return
    
    test_data = {
        'XAUUSD': {
            'price': 2030.00, 'atr': 15.50, 'rsi': 28.5,
            'direction': 'LONG', 'verdict': 'BUY',
            'sma_20': 2025.50, 'sma_50': 2015.00,
            'high_24h': 2038.50, 'low_24h': 2018.25, 'volume': 125000000
        },
        'EURUSD': {
            'price': 1.0850, 'atr': 0.0045, 'rsi': 72.5,
            'direction': 'SHORT', 'verdict': 'SELL',
            'sma_20': 1.0880, 'sma_50': 1.0920,
            'high_24h': 1.0895, 'low_24h': 1.0820, 'volume': 85000000
        },
        'GBPUSD': {
            'price': 1.2650, 'atr': 0.0055, 'rsi': 55.0,
            'direction': 'NONE', 'verdict': 'HOLD',
            'sma_20': 1.2640, 'sma_50': 1.2580,
            'high_24h': 1.2685, 'low_24h': 1.2610, 'volume': 62000000
        },
        'TSLA': {
            'price': 248.50, 'atr': 8.25, 'rsi': 25.5,
            'direction': 'LONG', 'verdict': 'STRONG_BUY',
            'sma_20': 255.30, 'sma_50': 268.00,
            'high_24h': 252.80, 'low_24h': 245.20, 'volume': 98000000
        },
        'AAPL': {
            'price': 195.20, 'atr': 3.15, 'rsi': 45.0,
            'direction': 'NONE', 'verdict': 'HOLD',
            'sma_20': 194.50, 'sma_50': 192.00,
            'high_24h': 196.80, 'low_24h': 193.50, 'volume': 55000000
        },
        'NVDA': {
            'price': 875.00, 'atr': 28.50, 'rsi': 68.0,
            'direction': 'NONE', 'verdict': 'HOLD',
            'sma_20': 865.00, 'sma_50': 820.00,
            'high_24h': 888.50, 'low_24h': 862.00, 'volume': 42000000
        },
    }
    
    for asset in assets_response.data:
        symbol = asset['symbol']
        asset_id = asset['id']
        
        if symbol not in test_data:
            continue
        
        data = test_data[symbol]
        price = data['price']
        atr = data['atr']
        rsi = data['rsi']
        direction = data['direction']
        
        # Calculate levels if direction exists
        if direction == 'LONG':
            entry = price
            sl = price - (2 * atr)
            tp1 = price + (1.5 * atr)
            tp2 = price + (3 * atr)
            rr = round((tp2 - entry) / (entry - sl), 2)
        elif direction == 'SHORT':
            entry = price
            sl = price + (2 * atr)
            tp1 = price - (1.5 * atr)
            tp2 = price - (3 * atr)
            rr = round((entry - tp2) / (sl - entry), 2)
        else:
            entry = price
            sl = None
            tp1 = None
            tp2 = None
            rr = None
        
        signal_data = {
            'asset_id': asset_id,
            'symbol': symbol,
            'timeframe': 'H1',
            'current_price': price,
            'price_change_pct': round((hash(symbol) % 500 - 250) / 100, 2),
            'high_24h': data['high_24h'],
            'low_24h': data['low_24h'],
            'rsi_14': rsi,
            'rsi_signal': 'oversold' if rsi < 30 else 'overbought' if rsi > 70 else 'neutral',
            'atr_14': atr,
            'sma_20': data['sma_20'],
            'sma_50': data['sma_50'],
            'signal_direction': direction,
            'entry_price': entry,
            'stop_loss': sl,
            'take_profit_1': tp1,
            'take_profit_2': tp2,
            'risk_reward_ratio': rr,
            'hybrid_verdict': data['verdict'],
            'hybrid_score': 75 if 'BUY' in data['verdict'] else 25 if 'SELL' in data['verdict'] else 50,
            'confidence_level': 70.0,
            'sentiment_score': 0.65 if 'BUY' in data['verdict'] else 0.35 if 'SELL' in data['verdict'] else 0.50,
            'sentiment_label': 'POSITIVE' if 'BUY' in data['verdict'] else 'NEGATIVE' if 'SELL' in data['verdict'] else 'NEUTRAL',
            'news_count': 5,
            'last_updated_at': datetime.now(timezone.utc).isoformat(),
        }
        
        try:
            supabase.table('signals_cache').upsert(
                signal_data,
                on_conflict='symbol,timeframe'
            ).execute()
            print(f"✓ Seeded {symbol}")
        except Exception as e:
            print(f"❌ Error seeding {symbol}: {e}")
    
    print("\n✅ All test data seeded!")


if __name__ == "__main__":
    print("🌱 StockLens Test Data Seeder")
    print("="*60)
    
    # Seed all assets
    seed_all_assets()
