-- =====================================================
-- StockLens Database Schema v2.0 (Forex & CFD Trading)
-- Run this in Supabase SQL Editor
-- =====================================================
-- STRICT RULE: Global Markets ONLY
-- ALLOWED: XAUUSD, EURUSD, GBPUSD, TSLA, AAPL, NVDA
-- FORBIDDEN: Indonesian stocks (IDX, .JK), IDR pairs
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if needed (for clean migration)
-- WARNING: This will delete all existing data!
DROP TABLE IF EXISTS public.signals_cache CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.market_assets CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS asset_type CASCADE;
DROP TYPE IF EXISTS verdict_type CASCADE;
DROP TYPE IF EXISTS sentiment_type CASCADE;
DROP TYPE IF EXISTS timeframe_type CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE asset_type AS ENUM ('STOCK', 'FOREX', 'COMMODITY');
CREATE TYPE verdict_type AS ENUM ('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL');
CREATE TYPE sentiment_type AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
CREATE TYPE timeframe_type AS ENUM ('H1', 'H4', 'D1');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE payment_method AS ENUM ('BANK_TRANSFER', 'EWALLET', 'QRIS', 'CREDIT_CARD');

-- =====================================================
-- 1. PROFILES TABLE
-- Linked to auth.users, stores subscription status
-- =====================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_is_premium ON public.profiles(is_premium);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- 2. MARKET_ASSETS TABLE
-- Global Forex, Commodities, US Stocks ONLY
-- =====================================================
CREATE TABLE public.market_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    asset_type asset_type NOT NULL,
    exchange TEXT,
    country TEXT DEFAULT 'US',
    pip_value DECIMAL(10, 6) DEFAULT 0.0001,  -- For forex: 0.0001, Gold: 0.01
    is_active BOOLEAN DEFAULT TRUE,
    is_premium_only BOOLEAN DEFAULT FALSE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_assets_symbol ON public.market_assets(symbol);
CREATE INDEX idx_market_assets_type ON public.market_assets(asset_type);
CREATE INDEX idx_market_assets_active ON public.market_assets(is_active);

-- RLS - Anyone can read active assets
ALTER TABLE public.market_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active market assets"
    ON public.market_assets FOR SELECT
    USING (is_active = TRUE);

-- =====================================================
-- 3. SIGNALS_CACHE TABLE (TRADER-FOCUSED)
-- Stores analysis results with Entry, SL, TP
-- =====================================================
CREATE TABLE public.signals_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.market_assets(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    
    -- Timeframe
    timeframe timeframe_type NOT NULL DEFAULT 'H1',
    
    -- Price Data
    current_price DECIMAL(18, 6),
    price_change_pct DECIMAL(10, 4),
    high_24h DECIMAL(18, 6),
    low_24h DECIMAL(18, 6),
    
    -- Technical Indicators
    rsi_14 DECIMAL(6, 2),
    rsi_signal TEXT,  -- 'oversold', 'neutral', 'overbought'
    atr_14 DECIMAL(18, 6),  -- Average True Range for volatility
    sma_20 DECIMAL(18, 6),
    sma_50 DECIMAL(18, 6),
    
    -- ⭐ TRADING LEVELS (Money Management)
    entry_price DECIMAL(18, 6),
    stop_loss DECIMAL(18, 6),
    take_profit_1 DECIMAL(18, 6),
    take_profit_2 DECIMAL(18, 6),
    risk_reward_ratio DECIMAL(5, 2),  -- e.g., 1.5 for 1:1.5 RR
    
    -- Signal Direction
    signal_direction TEXT,  -- 'LONG' or 'SHORT'
    
    -- Sentiment Analysis
    sentiment_score DECIMAL(5, 4),
    sentiment_label sentiment_type,
    news_count INTEGER DEFAULT 0,
    
    -- Hybrid Verdict (Final Decision)
    hybrid_score DECIMAL(5, 2),
    hybrid_verdict verdict_type NOT NULL DEFAULT 'HOLD',
    confidence_level DECIMAL(5, 2),
    
    -- AI Summary (Premium Feature)
    ai_summary TEXT,
    ai_recommendation TEXT,
    
    -- Metadata
    data_source TEXT DEFAULT 'alphavantage',
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    next_update_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_cache_symbol ON public.signals_cache(symbol);
CREATE INDEX idx_signals_cache_asset_id ON public.signals_cache(asset_id);
CREATE INDEX idx_signals_cache_verdict ON public.signals_cache(hybrid_verdict);
CREATE INDEX idx_signals_cache_timeframe ON public.signals_cache(timeframe);
CREATE INDEX idx_signals_cache_updated ON public.signals_cache(last_updated_at DESC);
CREATE UNIQUE INDEX idx_signals_cache_symbol_tf ON public.signals_cache(symbol, timeframe);

-- RLS - Public read access
ALTER TABLE public.signals_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view signals cache"
    ON public.signals_cache FOR SELECT
    USING (TRUE);

-- =====================================================
-- 4. TRANSACTIONS TABLE
-- Premium subscription payments via Midtrans
-- =====================================================
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Midtrans Data
    order_id TEXT NOT NULL UNIQUE,
    midtrans_transaction_id TEXT,
    
    -- Payment Details
    amount DECIMAL(12, 2) NOT NULL,  -- IDR 25,000
    currency TEXT DEFAULT 'IDR',
    payment_method payment_method,
    status transaction_status DEFAULT 'PENDING',
    
    -- Subscription Period
    subscription_months INTEGER DEFAULT 1,
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    
    -- Metadata
    payment_url TEXT,
    midtrans_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- RLS - Users can only see their own transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

-- =====================================================
-- 5. SEED DATA - Global Assets Only
-- =====================================================
INSERT INTO public.market_assets (symbol, name, asset_type, exchange, pip_value, is_premium_only) VALUES
    -- Commodities
    ('XAUUSD', 'Gold / US Dollar', 'COMMODITY', 'FOREX', 0.01, FALSE),
    
    -- Major Forex Pairs
    ('EURUSD', 'Euro / US Dollar', 'FOREX', 'FOREX', 0.0001, FALSE),
    ('GBPUSD', 'British Pound / US Dollar', 'FOREX', 'FOREX', 0.0001, FALSE),
    
    -- US Tech Stocks (CFD)
    ('TSLA', 'Tesla, Inc.', 'STOCK', 'NASDAQ', 0.01, FALSE),
    ('AAPL', 'Apple Inc.', 'STOCK', 'NASDAQ', 0.01, FALSE),
    ('NVDA', 'NVIDIA Corporation', 'STOCK', 'NASDAQ', 0.01, FALSE);

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to update profile timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_market_assets_updated_at
    BEFORE UPDATE ON public.market_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 7. DISABLE RLS FOR DEVELOPMENT (Optional)
-- Run this if you have issues inserting data
-- =====================================================
-- ALTER TABLE public.signals_cache DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.market_assets DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check assets: SELECT * FROM public.market_assets;
-- Check signals: SELECT symbol, timeframe, entry_price, stop_loss, take_profit_1 FROM public.signals_cache;
