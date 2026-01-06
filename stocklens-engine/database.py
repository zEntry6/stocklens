"""
StockLens Engine - Supabase Database Client
Handles all database operations for the Python engine
"""
from supabase import create_client, Client
from config import Config
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from loguru import logger


class SupabaseClient:
    """Supabase client wrapper for StockLens Engine"""
    
    _instance: Optional['SupabaseClient'] = None
    _client: Optional[Client] = None
    
    def __new__(cls):
        """Singleton pattern to reuse the same client"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            if not Config.validate():
                raise ValueError("Configuration is incomplete. Run config.py to check.")
            
            self._client = create_client(
                Config.SUPABASE_URL,
                Config.SUPABASE_KEY
            )
            logger.info("✓ Supabase client initialized successfully")
    
    @property
    def client(self) -> Client:
        return self._client
    
    # =========================================
    # Market Assets Operations
    # =========================================
    
    def get_active_assets(self, asset_type: Optional[str] = None) -> List[Dict]:
        """Get all active market assets"""
        try:
            query = self.client.table('market_assets').select('*').eq('is_active', True)
            
            if asset_type:
                query = query.eq('asset_type', asset_type)
            
            response = query.execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching active assets: {e}")
            return []
    
    def get_asset_by_symbol(self, symbol: str) -> Optional[Dict]:
        """Get a single asset by symbol"""
        try:
            response = self.client.table('market_assets') \
                .select('*') \
                .eq('symbol', symbol) \
                .single() \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching asset {symbol}: {e}")
            return None
    
    # =========================================
    # Signals Cache Operations
    # =========================================
    
    def get_signal_by_symbol(self, symbol: str) -> Optional[Dict]:
        """Get the latest signal for a symbol"""
        try:
            response = self.client.table('signals_cache') \
                .select('*') \
                .eq('symbol', symbol) \
                .limit(1) \
                .execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error fetching signal for {symbol}: {e}")
            return None
    
    def upsert_signal(self, signal_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Insert or update a signal in the cache.
        Uses symbol as the unique identifier.
        """
        try:
            signal_data['last_updated_at'] = datetime.now(timezone.utc).isoformat()
            
            response = self.client.table('signals_cache') \
                .upsert(signal_data, on_conflict='symbol') \
                .execute()
            
            logger.info(f"✓ Signal upserted for {signal_data.get('symbol')}")
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error upserting signal for {signal_data.get('symbol')}: {e}")
            return None
    
    def bulk_upsert_signals(self, signals: List[Dict[str, Any]]) -> List[Dict]:
        """Bulk upsert multiple signals"""
        try:
            for signal in signals:
                signal['last_updated_at'] = datetime.now(timezone.utc).isoformat()
            
            response = self.client.table('signals_cache') \
                .upsert(signals, on_conflict='symbol') \
                .execute()
            
            logger.info(f"✓ Bulk upserted {len(signals)} signals")
            return response.data
        except Exception as e:
            logger.error(f"Error bulk upserting signals: {e}")
            return []
    
    def get_all_signals(self) -> List[Dict]:
        """Get all signals from cache"""
        try:
            response = self.client.table('signals_cache') \
                .select('*') \
                .order('last_updated_at', desc=True) \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching all signals: {e}")
            return []
    
    def get_screener_data(self) -> List[Dict]:
        """Get data for the stock screener view"""
        try:
            response = self.client.table('v_stock_screener') \
                .select('*') \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching screener data: {e}")
            return []
    
    # =========================================
    # News Cache Check (for rate limiting)
    # =========================================
    
    def should_fetch_news(self, symbol: str, hours: int = 24) -> bool:
        """
        Check if we should fetch news for a symbol.
        Returns True if:
        - No signal exists for symbol
        - news_count is 0 or null
        - last_updated_at is older than specified hours
        """
        try:
            signal = self.get_signal_by_symbol(symbol)
            
            if not signal:
                logger.debug(f"No signal found for {symbol}, should fetch news")
                return True
            
            # Check if news_count is 0 or null
            if not signal.get('news_count'):
                logger.debug(f"No news count for {symbol}, should fetch news")
                return True
            
            # Check last update time
            last_updated = signal.get('last_updated_at')
            if not last_updated:
                return True
            
            # Parse the timestamp
            if isinstance(last_updated, str):
                last_updated = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
            
            # Check if older than specified hours
            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
            should_fetch = last_updated < cutoff
            
            if should_fetch:
                logger.debug(f"News for {symbol} is stale (>{hours}h), should fetch")
            else:
                logger.debug(f"News for {symbol} is fresh (<{hours}h), skipping")
            
            return should_fetch
            
        except Exception as e:
            logger.error(f"Error checking news freshness for {symbol}: {e}")
            return True  # Fetch on error to be safe
    
    # =========================================
    # User & Subscription Operations
    # =========================================
    
    def get_profile(self, user_id: str) -> Optional[Dict]:
        """Get user profile"""
        try:
            response = self.client.table('profiles') \
                .select('*') \
                .eq('id', user_id) \
                .single() \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching profile {user_id}: {e}")
            return None
    
    def upgrade_user_to_premium(self, user_id: str, days: int = 30) -> bool:
        """Upgrade a user to premium"""
        try:
            response = self.client.rpc('upgrade_to_premium', {
                'p_user_id': user_id,
                'p_days': days
            }).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error upgrading user {user_id}: {e}")
            return False
    
    def check_expired_subscriptions(self) -> int:
        """Check and expire premium subscriptions"""
        try:
            response = self.client.rpc('check_expired_subscriptions').execute()
            return response.data or 0
        except Exception as e:
            logger.error(f"Error checking expired subscriptions: {e}")
            return 0
    
    # =========================================
    # Transaction Operations
    # =========================================
    
    def create_transaction(self, transaction_data: Dict[str, Any]) -> Optional[Dict]:
        """Create a new transaction record"""
        try:
            response = self.client.table('transactions') \
                .insert(transaction_data) \
                .execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error creating transaction: {e}")
            return None
    
    def update_transaction_status(
        self, 
        transaction_id: str, 
        status: str,
        paid_at: Optional[str] = None
    ) -> Optional[Dict]:
        """Update transaction status"""
        try:
            update_data = {'status': status}
            if paid_at:
                update_data['paid_at'] = paid_at
            
            response = self.client.table('transactions') \
                .update(update_data) \
                .eq('id', transaction_id) \
                .execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error(f"Error updating transaction {transaction_id}: {e}")
            return None


# Singleton instance
db = SupabaseClient()


# Test the connection
if __name__ == "__main__":
    from config import Config
    Config.print_status()
    
    print("\nTesting database connection...")
    try:
        assets = db.get_active_assets()
        print(f"✓ Connected to Supabase successfully!")
        print(f"✓ Found {len(assets)} active assets")
        
        for asset in assets[:5]:
            print(f"  - {asset['symbol']}: {asset['name']}")
            
        # Test news freshness check
        if assets:
            symbol = assets[0]['symbol']
            should_fetch = db.should_fetch_news(symbol, hours=24)
            print(f"\n✓ Should fetch news for {symbol}: {should_fetch}")
            
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
