"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  Lightbulb,
  Star
} from "lucide-react";
import PriceChart from "@/components/PriceChart";
import SignalCard from "@/components/SignalCard";

const SUPABASE_URL = 'https://famxbhnsogvfeoxmqhmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXhiaG5zb2d2ZmVveG1xaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTY1MTgsImV4cCI6MjA4MzEzMjUxOH0.xu41qUk6ApxAuMr6e_y77fyYTNtDYq0oH6fIklWaIng';

interface SignalDetail {
  id: string;
  symbol: string;
  asset_type?: string;
  current_price: number | null;
  price_change_24h: number | null;
  price_change_pct: number | null;
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
  AAPL: "Apple Inc.",
  TSLA: "Tesla, Inc.",
  NVDA: "NVIDIA Corporation",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  META: "Meta Platforms Inc.",
};

export default function StockDetailPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  
  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/signals_cache?symbol=eq.${symbol.toUpperCase()}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        
        const data = await response.json();
        if (data && data.length > 0) {
          setSignal(data[0]);
        } else {
          setError("Symbol not found");
        }

        const watchlist = JSON.parse(localStorage.getItem('stocklens_watchlist') || '[]');
        setInWatchlist(watchlist.includes(symbol.toUpperCase()));
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    if (symbol) fetchData();
  }, [symbol]);

  const toggleWatchlist = () => {
    const watchlist = JSON.parse(localStorage.getItem('stocklens_watchlist') || '[]');
    const updated = inWatchlist 
      ? watchlist.filter((s: string) => s !== symbol.toUpperCase())
      : [...watchlist, symbol.toUpperCase()];
    localStorage.setItem('stocklens_watchlist', JSON.stringify(updated));
    setInWatchlist(!inWatchlist);
  };

  const getSignalColor = (verdict: string) => {
    if (verdict === "STRONG_BUY" || verdict === "BUY") return "text-buy";
    if (verdict === "STRONG_SELL" || verdict === "SELL") return "text-sell";
    return "text-text-secondary";
  };

  const getSignalBadge = (verdict: string) => {
    switch (verdict) {
      case "STRONG_BUY": return "bg-buy text-white";
      case "BUY": return "bg-buy-bg text-buy border border-buy/30";
      case "STRONG_SELL": return "bg-sell text-white";
      case "SELL": return "bg-sell-bg text-sell border border-sell/30";
      default: return "bg-card border border-border text-text-secondary";
    }
  };

  const getSentimentColor = (label: string | null) => {
    if (label === "POSITIVE") return "text-buy";
    if (label === "NEGATIVE") return "text-sell";
    return "text-text-secondary";
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

  const priceChange = signal.price_change_pct ?? signal.price_change_24h ?? 0;
  const priceColor = priceChange >= 0 ? "text-buy" : "text-sell";

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Screener
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{signal.symbol}</h1>
                <button onClick={toggleWatchlist} className={`p-2 rounded-lg transition-colors ${inWatchlist ? 'bg-yellow-500/20 text-yellow-500' : 'bg-card-hover text-text-muted hover:text-yellow-500'}`}>
                  <Star className={`h-5 w-5 ${inWatchlist ? 'fill-yellow-500' : ''}`} />
                </button>
                {signal.timeframe && <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-sm font-mono">{signal.timeframe}</span>}
                <span className={`${getSignalBadge(signal.hybrid_verdict)} px-4 py-1 rounded-full text-sm font-semibold`}>{signal.hybrid_verdict}</span>
              </div>
              <p className="text-text-secondary mt-1">{ASSET_NAMES[signal.symbol] || signal.symbol}</p>
            </div>
            
            <div className="text-right">
              <p className="text-3xl font-bold font-mono">
                ${signal.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: signal.current_price && signal.current_price < 10 ? 4 : 2 }) ?? "N/A"}
              </p>
              <p className={`font-mono flex items-center justify-end gap-1 ${priceColor}`}>
                {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Price Chart</h2>
              </div>
              <PriceChart symbol={signal.symbol} height={350} />
            </div>

            {/* Technical Analysis */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Technical Analysis</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">RSI (14)</p>
                  <p className="text-2xl font-bold font-mono">{signal.rsi_14 ? Number(signal.rsi_14).toFixed(1) : "N/A"}</p>
                  <p className={`text-sm ${signal.rsi_signal === "oversold" ? "text-buy" : signal.rsi_signal === "overbought" ? "text-sell" : "text-text-secondary"}`}>
                    {signal.rsi_signal || "Neutral"}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">SMA 20</p>
                  <p className="text-2xl font-bold font-mono">{signal.sma_20 ? `$${Number(signal.sma_20).toFixed(2)}` : "N/A"}</p>
                </div>
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">SMA 50</p>
                  <p className="text-2xl font-bold font-mono">{signal.sma_50 ? `$${Number(signal.sma_50).toFixed(2)}` : "N/A"}</p>
                </div>
                <div className="bg-background rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">ATR (14)</p>
                  <p className="text-2xl font-bold font-mono">{signal.atr_14 ? `$${Number(signal.atr_14).toFixed(2)}` : "N/A"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-text-secondary text-sm">24h High</p>
                  <p className="font-mono text-buy">${signal.high_24h?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">24h Low</p>
                  <p className="font-mono text-sell">${signal.low_24h?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm">Volume</p>
                  <p className="font-mono">{signal.volume_24h ? `$${(Number(signal.volume_24h) / 1000000).toFixed(2)}M` : "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - ALL FREE */}
          <div className="space-y-6">
            <SignalCard direction={signal.signal_direction} entryPrice={signal.entry_price} stopLoss={signal.stop_loss} takeProfit1={signal.take_profit_1} takeProfit2={signal.take_profit_2} riskRewardRatio={signal.risk_reward_ratio} atr={signal.atr_14} isPremium={true} />

            {/* Sentiment - FREE */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Sentiment Analysis</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-text-secondary text-sm mb-1">Score</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${signal.sentiment_label === "POSITIVE" ? "bg-buy" : signal.sentiment_label === "NEGATIVE" ? "bg-sell" : "bg-text-secondary"}`} style={{ width: `${(signal.sentiment_score ?? 0.5) * 100}%` }} />
                    </div>
                    <span className={`font-mono font-bold ${getSentimentColor(signal.sentiment_label)}`}>
                      {signal.sentiment_score ? `${(Number(signal.sentiment_score) * 100).toFixed(0)}%` : "N/A"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-text-secondary text-sm mb-1">Label</p>
                  <p className={`text-lg font-semibold ${getSentimentColor(signal.sentiment_label)}`}>{signal.sentiment_label || "Neutral"}</p>
                </div>
              </div>
            </div>

            {/* AI Verdict - FREE */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">AI Verdict</h2>
              </div>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className={`text-4xl font-bold ${getSignalColor(signal.hybrid_verdict)}`}>{signal.hybrid_verdict}</p>
                  <p className="text-text-secondary mt-1">Score: {signal.hybrid_score ? Number(signal.hybrid_score).toFixed(1) : "N/A"}/100</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm mb-1">Confidence</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${signal.confidence_level ?? 0}%` }} />
                    </div>
                    <span className="font-mono font-bold text-accent">{signal.confidence_level ? `${Number(signal.confidence_level).toFixed(0)}%` : "N/A"}</span>
                  </div>
                </div>
                {signal.ai_summary && <div><p className="text-text-secondary text-sm mb-2">Summary</p><p className="text-sm">{signal.ai_summary}</p></div>}
                {signal.ai_recommendation && (
                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-accent font-medium">{signal.ai_recommendation}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-text-muted text-sm">
              <Clock className="h-4 w-4" />
              Updated: {new Date(signal.last_updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
