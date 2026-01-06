-- =====================================================
-- StockLens Database Schema (Global Markets Only)
-- Run this in Supabase SQL Editor
-- =====================================================
-- STRICT RULE: NO Indonesian assets (IDX, .JK, IDR pairs)
-- ALLOWED: Forex (EURUSD, GBPUSD), Commodities (XAUUSD), US Stocks (TSLA, AAPL)
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role has full access to profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 2. MARKET_ASSETS TABLE
-- Global Forex, Commodities, US Stocks ONLY
-- =====================================================
CREATE TYPE asset_type AS ENUM ('STOCK', 'FOREX', 'COMMODITY');

CREATE TABLE public.market_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    asset_type asset_type NOT NULL,
    exchange TEXT,
    country TEXT DEFAULT 'US',
    is_active BOOLEAN DEFAULT TRUE,
    is_premium_only BOOLEAN DEFAULT FALSE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_assets_symbol ON public.market_assets(symbol);
CREATE INDEX idx_market_assets_type ON public.market_assets(asset_type);
CREATE INDEX idx_market_assets_active ON public.market_assets(is_active);

ALTER TABLE public.market_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active market assets"
    ON public.market_assets FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Service role can manage market assets"
    ON public.market_assets FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 3. SIGNALS_CACHE TABLE
-- Stores analysis results (price in USD)
-- =====================================================
CREATE TYPE verdict_type AS ENUM ('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL');
CREATE TYPE sentiment_type AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

CREATE TABLE public.signals_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.market_assets(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    
    -- Price Data (ALL IN USD)
    current_price DECIMAL(18, 6),
    price_change_24h DECIMAL(10, 4),
    high_24h DECIMAL(18, 6),
    low_24h DECIMAL(18, 6),
    volume_24h DECIMAL(24, 2),
    
    -- Technical Analysis
    rsi_14 DECIMAL(6, 2),
    rsi_signal TEXT,
    sma_20 DECIMAL(18, 6),
    sma_50 DECIMAL(18, 6),
    macd_line DECIMAL(18, 6),
    macd_signal_line DECIMAL(18, 6),
    macd_histogram DECIMAL(18, 6),
    macd_trend TEXT,
    
    -- Sentiment Analysis
    sentiment_score DECIMAL(5, 4),
    sentiment_label sentiment_type,
    news_count INTEGER DEFAULT 0,
    
    -- Hybrid Verdict
    hybrid_score DECIMAL(5, 2),
    hybrid_verdict verdict_type NOT NULL,
    confidence_level DECIMAL(5, 2),
    
    -- AI Summary (Premium)
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
CREATE INDEX idx_signals_cache_updated ON public.signals_cache(last_updated_at DESC);
CREATE UNIQUE INDEX idx_signals_cache_symbol_unique ON public.signals_cache(symbol);

ALTER TABLE public.signals_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view signals cache"
    ON public.signals_cache FOR SELECT
    USING (TRUE);

CREATE POLICY "Service role can manage signals cache"
    ON public.signals_cache FOR INSERT
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update signals cache"
    ON public.signals_cache FOR UPDATE
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete signals cache"
    ON public.signals_cache FOR DELETE
    USING (auth.role() = 'service_role');

-- =====================================================
-- 4. TRANSACTIONS TABLE
-- Payment in IDR (Indonesian Rupiah) for subscription
-- =====================================================
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE payment_method AS ENUM ('BANK_TRANSFER', 'EWALLET', 'QRIS', 'CREDIT_CARD');

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'IDR',
    description TEXT,
    payment_method payment_method,
    payment_provider TEXT DEFAULT 'midtrans',
    external_transaction_id TEXT,
    status transaction_status DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,
    subscription_type TEXT DEFAULT 'PREMIUM_MONTHLY',
    subscription_days INTEGER DEFAULT 30,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions"
    ON public.transactions FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 5. WATCHLISTS TABLE
-- =====================================================
CREATE TABLE public.watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.market_assets(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    UNIQUE(user_id, asset_id)
);

CREATE INDEX idx_watchlists_user ON public.watchlists(user_id);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist"
    ON public.watchlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own watchlist"
    ON public.watchlists FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- 6. FUNCTIONS & TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_market_assets_updated_at
    BEFORE UPDATE ON public.market_assets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.upgrade_to_premium(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles
    SET 
        is_premium = TRUE,
        premium_expires_at = COALESCE(
            CASE 
                WHEN premium_expires_at > NOW() THEN premium_expires_at 
                ELSE NOW() 
            END + (p_days || ' days')::INTERVAL,
            NOW() + (p_days || ' days')::INTERVAL
        ),
        updated_at = NOW()
    WHERE id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.profiles
    SET is_premium = FALSE, updated_at = NOW()
    WHERE is_premium = TRUE 
    AND premium_expires_at < NOW();
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. SEED DATA - GLOBAL MARKETS ONLY
-- =====================================================
-- STRICT: NO Indonesian assets (IDX, .JK, IDR pairs)
-- =====================================================

-- Commodities (Gold & Silver - Free tier)
INSERT INTO public.market_assets (symbol, name, asset_type, exchange, country, is_premium_only) VALUES
('XAUUSD', 'Gold / US Dollar', 'COMMODITY', 'FOREX', 'US', FALSE),
('XAGUSD', 'Silver / US Dollar', 'COMMODITY', 'FOREX', 'US', FALSE);

-- Major Forex Pairs (Free tier)
INSERT INTO public.market_assets (symbol, name, asset_type, exchange, country, is_premium_only) VALUES
('EURUSD', 'Euro / US Dollar', 'FOREX', 'FOREX', 'US', FALSE),
('GBPUSD', 'British Pound / US Dollar', 'FOREX', 'FOREX', 'US', FALSE),
('USDJPY', 'US Dollar / Japanese Yen', 'FOREX', 'FOREX', 'US', FALSE);

-- US Tech Stocks (Free tier)
INSERT INTO public.market_assets (symbol, name, asset_type, exchange, country, is_premium_only) VALUES
('AAPL', 'Apple Inc.', 'STOCK', 'NASDAQ', 'US', FALSE),
('TSLA', 'Tesla Inc.', 'STOCK', 'NASDAQ', 'US', FALSE),
('NVDA', 'NVIDIA Corporation', 'STOCK', 'NASDAQ', 'US', FALSE),
('MSFT', 'Microsoft Corporation', 'STOCK', 'NASDAQ', 'US', FALSE),
('GOOGL', 'Alphabet Inc.', 'STOCK', 'NASDAQ', 'US', FALSE);

-- =====================================================
-- 8. VIEW FOR STOCK SCREENER
-- =====================================================
CREATE OR REPLACE VIEW public.v_stock_screener AS
SELECT 
    ma.id AS asset_id,
    ma.symbol,
    ma.name,
    ma.asset_type,
    ma.exchange,
    ma.is_premium_only,
    sc.current_price,
    sc.price_change_24h,
    sc.rsi_14,
    sc.rsi_signal,
    sc.macd_trend,
    sc.sentiment_label,
    sc.sentiment_score,
    sc.hybrid_verdict,
    sc.hybrid_score,
    sc.confidence_level,
    sc.last_updated_at
FROM public.market_assets ma
LEFT JOIN public.signals_cache sc ON ma.id = sc.asset_id
WHERE ma.is_active = TRUE
ORDER BY ma.asset_type ASC, ma.symbol ASC;

-- =====================================================
-- DONE! Database ready for Global Markets.
-- =====================================================
-- Summary:
-- ✅ Commodities: XAUUSD, XAGUSD
-- ✅ Forex: EURUSD, GBPUSD, USDJPY  
-- ✅ US Stocks: AAPL, TSLA, NVDA, MSFT, GOOGL
-- ❌ NO Indonesian assets
-- =====================================================
