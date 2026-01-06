"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Brain,
  BarChart3,
  Newspaper,
  Clock,
  Loader2,
  Lightbulb
} from "lucide-react";
import PriceChart from "@/components/PriceChart";
import PremiumGate from "@/components/PremiumGate";
import SignalCard from "@/components/SignalCard";

interface SignalDetail {
  id: string;
  symbol: string;
  asset_type?: string;
  current_price: number | null;
  price_change_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume_24h: number | null;
  rsi_14: number | null;
  rsi_signal: string | null;
  sma_20: number | null;
  sma_50: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  news_count: number | null;
  hybrid_score: number | null;
  hybrid_verdict: string;
  confidence_level: number | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  last_updated_at: string;
  // Trading Signal Columns (New)
  timeframe: string | null;
  signal_direction: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  atr_14: number | null;
  risk_reward_ratio: number | null;
}

const ASSET_NAMES: Record<string, string> = {
  XAUUSD: "Gold / USD",
  XAGUSD: "Silver / USD",
  EURUSD: "Euro / USD",
  GBPUSD: "British Pound / USD",
  USDJPY: "USD / Japanese Yen",
  AUDUSD: "Australian Dollar / USD",
  USDCHF: "USD / Swiss Franc",
  USDCAD: "USD / Canadian Dollar",
  NZDUSD: "New Zealand Dollar / USD",
  EURGBP: "Euro / British Pound",
  AAPL: "Apple Inc.",
  TSLA: "Tesla, Inc.",
  NVDA: "NVIDIA Corporation",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  META: "Meta Platforms Inc.",
  JPM: "JPMorgan Chase & Co.",
  V: "Visa Inc.",
  WMT: "Walmart Inc.",
  JNJ: "Johnson & Johnson",
  PG: "Procter & Gamble Co.",
  XOM: "Exxon Mobil Corp.",
  CVX: "Chevron Corporation",
  BAC: "Bank of America Corp.",
};

export default function StockDetailPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  
  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceChange, setLivePriceChange] = useState<number | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch signal data from database
        const { data: signalData, error: signalError } = await supabase
          .from("signals_cache")
          .select("*")
          .eq("symbol", symbol.toUpperCase())
          .single();

        if (signalError) throw signalError;
        setSignal(signalData);

        // Fetch live price from API (same source as chart)
        try {
          const priceRes = await fetch(`/api/historical?symbol=${symbol.toUpperCase()}&range=1d`);
          const priceData = await priceRes.json();
          if (priceData.success && priceData.currentPrice) {
            setLivePrice(priceData.currentPrice);
            setLivePriceChange(priceData.changePercent);
          }
        } catch (e) {
          console.warn("Live price fetch failed, using cached");
        }

        // Check if user is premium
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Session check:", session ? `User: ${session.user.email}` : "No session");
        
        if (session?.user) {
          // Hardcoded premium emails (bypass RLS issues)
          const PREMIUM_EMAILS = [
            "ahmedsolihin250@gmail.com",
          ];
          
          const userEmail = session.user.email?.toLowerCase();
          console.log("Checking premium for:", userEmail);
          
          if (userEmail && PREMIUM_EMAILS.includes(userEmail)) {
            setIsPremium(true);
            console.log("✅ Premium user (hardcoded):", userEmail);
          } else {
            // Try to get profile from database
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("is_premium")
              .eq("id", session.user.id)
              .single();
            
            console.log("Profile query result:", profile, profileError);
            setIsPremium(profile?.is_premium ?? false);
          }
        } else {
          console.log("❌ No session - user not logged in");
        }
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    if (symbol) {
      fetchData();
    }
  }, [symbol]);

  const getSignalColor = (verdict: string) => {
    switch (verdict) {
      case "STRONG_BUY":
      case "BUY":
        return "text-buy";
      case "STRONG_SELL":
      case "SELL":
        return "text-sell";
      default:
        return "text-text-secondary";
    }
  };

  const getSignalBadge = (verdict: string) => {
    switch (verdict) {
      case "STRONG_BUY":
        return "bg-buy text-white";
      case "BUY":
        return "bg-buy-bg text-buy border border-buy/30";
      case "STRONG_SELL":
        return "bg-sell text-white";
      case "SELL":
        return "bg-sell-bg text-sell border border-sell/30";
      default:
        return "bg-card border border-border text-text-secondary";
    }
  };

  const getSentimentColor = (label: string | null) => {
    switch (label) {
      case "POSITIVE":
        return "text-buy";
      case "NEGATIVE":
        return "text-sell";
      default:
        return "text-text-secondary";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <span className="ml-3 text-text-secondary">Loading {symbol}...</span>
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-sell mb-4">{error || "Symbol not found"}</p>
        <Link href="/" className="text-accent hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Screener
        </Link>
      </div>
    );
  }

  const priceChange = livePriceChange ?? signal.price_change_24h ?? 0;
  const displayPrice = livePrice ?? signal.current_price;
  const priceColor = priceChange >= 0 ? "text-buy" : "text-sell";

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Screener
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{signal.symbol}</h1>
                {signal.timeframe && (
                  <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-sm font-mono">
                    {signal.timeframe}
                  </span>
                )}
                <span className={`${getSignalBadge(signal.hybrid_verdict)} px-4 py-1 rounded-full text-sm font-semibold`}>
                  {signal.hybrid_verdict}
                </span>
              </div>
              <p className="text-text-secondary mt-1">
                {ASSET_NAMES[signal.symbol] || signal.asset_type}
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-3xl font-bold font-mono">
                ${displayPrice?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: displayPrice && displayPrice < 10 ? 4 : 2
                }) ?? "N/A"}
              </p>
              <p className={`font-mono flex items-center justify-end gap-1 ${priceColor}`}>
                {priceChange >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                <span className="text-text-muted ml-1">24h</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart - Available to everyone */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Price Chart</h2>
              </div>
              <PriceChart symbol={signal.symbol} height={350} />
            </div>

            {/* Technical Analysis - Available to everyone */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Technical Analysis</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">RSI (14)</p>
                  <p className="text-2xl font-bold font-mono">
                    {signal.rsi_14 ? Number(signal.rsi_14).toFixed(1) : "N/A"}
                  </p>
                  <p className={`text-sm ${
                    signal.rsi_signal === "oversold" ? "text-buy" : 
                    signal.rsi_signal === "overbought" ? "text-sell" : 
                    "text-text-secondary"
                  }`}>
                    {signal.rsi_signal || "Neutral"}
                  </p>
                </div>
                
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">SMA 20</p>
                  <p className="text-2xl font-bold font-mono">
                    {signal.sma_20 ? `$${Number(signal.sma_20).toFixed(2)}` : "N/A"}
                  </p>
                </div>
                
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">SMA 50</p>
                  <p className="text-2xl font-bold font-mono">
                    {signal.sma_50 ? `$${Number(signal.sma_50).toFixed(2)}` : "N/A"}
                  </p>
                </div>
                
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">ATR (14)</p>
                  <p className="text-2xl font-bold font-mono">
                    {signal.atr_14 ? `$${Number(signal.atr_14).toFixed(2)}` : "N/A"}
                  </p>
                  <p className="text-xs text-text-muted">Volatility</p>
                </div>
              </div>

              {/* Price Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-text-secondary text-sm">24h High</p>
                  <p className="font-mono text-buy">
                    ${signal.high_24h?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">24h Low</p>
                  <p className="font-mono text-sell">
                    ${signal.low_24h?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">Volume</p>
                  <p className="font-mono">
                    {signal.volume_24h 
                      ? `$${(Number(signal.volume_24h) / 1000000).toFixed(2)}M` 
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trading Signal Card - SL/TP Premium Only */}
            <SignalCard
              direction={signal.signal_direction}
              entryPrice={signal.entry_price}
              stopLoss={signal.stop_loss}
              takeProfit1={signal.take_profit_1}
              takeProfit2={signal.take_profit_2}
              riskRewardRatio={signal.risk_reward_ratio}
              atr={signal.atr_14}
              isPremium={isPremium}
            />

            {/* Sentiment Analysis - Premium Only */}
            <PremiumGate isPremium={isPremium} featureName="Sentiment Analysis">
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Newspaper className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">Sentiment Analysis</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Sentiment Score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            signal.sentiment_label === "POSITIVE" ? "bg-buy" :
                            signal.sentiment_label === "NEGATIVE" ? "bg-sell" :
                            "bg-text-secondary"
                          }`}
                          style={{ width: `${(signal.sentiment_score ?? 0.5) * 100}%` }}
                        />
                      </div>
                      <span className={`font-mono font-bold ${getSentimentColor(signal.sentiment_label)}`}>
                        {signal.sentiment_score 
                          ? `${(Number(signal.sentiment_score) * 100).toFixed(0)}%`
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Sentiment Label</p>
                    <p className={`text-lg font-semibold ${getSentimentColor(signal.sentiment_label)}`}>
                      {signal.sentiment_label || "Neutral"}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-text-secondary text-sm mb-1">News Articles Analyzed</p>
                    <p className="text-lg font-mono">{signal.news_count ?? 0}</p>
                  </div>
                </div>
              </div>
            </PremiumGate>

            {/* AI Verdict - Premium Only */}
            <PremiumGate isPremium={isPremium} featureName="AI Verdict">
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">AI Hybrid Verdict</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <p className={`text-4xl font-bold ${getSignalColor(signal.hybrid_verdict)}`}>
                      {signal.hybrid_verdict}
                    </p>
                    <p className="text-text-secondary mt-1">
                      Hybrid Score: {signal.hybrid_score ? Number(signal.hybrid_score).toFixed(1) : "N/A"}/100
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Confidence Level</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${signal.confidence_level ?? 0}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-accent">
                        {signal.confidence_level ? `${Number(signal.confidence_level).toFixed(0)}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                  
                  {signal.ai_summary && (
                    <div>
                      <p className="text-text-secondary text-sm mb-2">AI Summary</p>
                      <p className="text-sm text-text-primary leading-relaxed">
                        {signal.ai_summary}
                      </p>
                    </div>
                  )}
                  
                  {signal.ai_recommendation && (
                    <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-accent font-medium">
                        {signal.ai_recommendation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </PremiumGate>

            {/* Last Updated */}
            <div className="flex items-center justify-center gap-2 text-text-muted text-sm">
              <Clock className="h-4 w-4" />
              Last updated: {new Date(signal.last_updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
