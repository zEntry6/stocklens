"""Add popular Forex pairs to market_assets"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

# Popular Forex & Commodities pairs traded worldwide
new_assets = [
    # Major Forex Pairs (most liquid)
    {'symbol': 'USDJPY', 'name': 'US Dollar / Japanese Yen', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.01},
    {'symbol': 'USDCHF', 'name': 'US Dollar / Swiss Franc', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.0001},
    {'symbol': 'AUDUSD', 'name': 'Australian Dollar / US Dollar', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.0001},
    {'symbol': 'USDCAD', 'name': 'US Dollar / Canadian Dollar', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.0001},
    {'symbol': 'NZDUSD', 'name': 'New Zealand Dollar / US Dollar', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.0001},
    
    # Cross Pairs (popular for trading)
    {'symbol': 'EURJPY', 'name': 'Euro / Japanese Yen', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.01},
    {'symbol': 'GBPJPY', 'name': 'British Pound / Japanese Yen', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.01},
    {'symbol': 'EURGBP', 'name': 'Euro / British Pound', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.0001},
    {'symbol': 'AUDJPY', 'name': 'Australian Dollar / Japanese Yen', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.01},
    {'symbol': 'CADJPY', 'name': 'Canadian Dollar / Japanese Yen', 'asset_type': 'FOREX', 'exchange': 'FOREX', 'pip_value': 0.01},
    
    # Commodities
    {'symbol': 'XAGUSD', 'name': 'Silver / US Dollar', 'asset_type': 'COMMODITY', 'exchange': 'FOREX', 'pip_value': 0.01},
    
    # Crypto (very popular)
    {'symbol': 'BTCUSD', 'name': 'Bitcoin / US Dollar', 'asset_type': 'CRYPTO', 'exchange': 'CRYPTO', 'pip_value': 1.0},
    {'symbol': 'ETHUSD', 'name': 'Ethereum / US Dollar', 'asset_type': 'CRYPTO', 'exchange': 'CRYPTO', 'pip_value': 0.01},
]

print("Adding popular Forex pairs to database...\n")

for asset in new_assets:
    try:
        result = sb.table('market_assets').upsert(asset, on_conflict='symbol').execute()
        print(f"✅ Added {asset['symbol']} - {asset['name']}")
    except Exception as e:
        print(f"❌ {asset['symbol']}: {e}")

print("\n✅ Done! Now run quick_update.py to fetch data for new symbols.")
