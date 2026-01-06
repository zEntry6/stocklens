/**
 * StockLens Database Types
 * Auto-generated from Supabase schema
 */

// Enums
export type AssetType = 'STOCK' | 'FOREX' | 'CRYPTO' | 'COMMODITY';
export type VerdictType = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'BANK_TRANSFER' | 'EWALLET' | 'QRIS' | 'CREDIT_CARD';

// Database Tables
export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  exchange: string | null;
  country: string;
  is_active: boolean;
  is_premium_only: boolean;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalCache {
  id: string;
  asset_id: string;
  symbol: string;
  
  // Price Data
  current_price: number | null;
  price_change_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume_24h: number | null;
  
  // Technical Analysis
  rsi_14: number | null;
  rsi_signal: string | null;
  sma_20: number | null;
  sma_50: number | null;
  
  // MACD Indicators
  macd_line: number | null;
  macd_signal_line: number | null;
  macd_histogram: number | null;
  macd_trend: string | null;  // BULLISH, BEARISH, NEUTRAL
  
  // Sentiment Analysis
  sentiment_score: number | null;
  sentiment_label: SentimentType | null;
  news_count: number;
  
  // Hybrid Verdict
  hybrid_score: number | null;
  hybrid_verdict: VerdictType;
  confidence_level: number | null;
  
  // AI Analysis (Premium)
  ai_summary: string | null;
  ai_recommendation: string | null;
  
  // Metadata
  data_source: string;
  last_updated_at: string;
  next_update_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  description: string | null;
  payment_method: PaymentMethod | null;
  payment_provider: string | null;
  external_transaction_id: string | null;
  status: TransactionStatus;
  paid_at: string | null;
  subscription_type: string;
  subscription_days: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  asset_id: string;
  added_at: string;
  notes: string | null;
}

// View Types
export interface StockScreenerItem {
  asset_id: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  exchange: string | null;
  is_premium_only: boolean;
  current_price: number | null;
  price_change_24h: number | null;
  rsi_14: number | null;
  rsi_signal: string | null;
  macd_trend: string | null;
  sentiment_label: SentimentType | null;
  sentiment_score: number | null;
  hybrid_verdict: VerdictType | null;
  hybrid_score: number | null;
  confidence_level: number | null;
  last_updated_at: string | null;
}

// Supabase Database type definition
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      market_assets: {
        Row: MarketAsset;
        Insert: Omit<MarketAsset, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MarketAsset, 'id' | 'created_at'>>;
      };
      signals_cache: {
        Row: SignalCache;
        Insert: Omit<SignalCache, 'id' | 'created_at'>;
        Update: Partial<Omit<SignalCache, 'id' | 'created_at'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at'>>;
      };
      watchlists: {
        Row: Watchlist;
        Insert: Omit<Watchlist, 'id' | 'added_at'>;
        Update: Partial<Omit<Watchlist, 'id' | 'user_id' | 'asset_id'>>;
      };
    };
    Views: {
      v_stock_screener: {
        Row: StockScreenerItem;
      };
    };
    Functions: {
      upgrade_to_premium: {
        Args: { p_user_id: string; p_days?: number };
        Returns: boolean;
      };
      check_expired_subscriptions: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}

// Helper types for UI
export type VerdictColor = {
  bg: string;
  text: string;
  label: string;
};

export const VERDICT_COLORS: Record<VerdictType, VerdictColor> = {
  STRONG_BUY: { bg: 'bg-buy', text: 'text-buy', label: 'Strong Buy' },
  BUY: { bg: 'bg-buy-bg', text: 'text-buy', label: 'Buy' },
  HOLD: { bg: 'bg-card', text: 'text-text-secondary', label: 'Hold' },
  SELL: { bg: 'bg-sell-bg', text: 'text-sell', label: 'Sell' },
  STRONG_SELL: { bg: 'bg-sell', text: 'text-sell', label: 'Strong Sell' },
};

export const SENTIMENT_COLORS: Record<SentimentType, string> = {
  POSITIVE: 'text-buy',
  NEUTRAL: 'text-text-secondary',
  NEGATIVE: 'text-sell',
};
