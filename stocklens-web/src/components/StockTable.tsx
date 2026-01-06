"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, TrendingUp, TrendingDown, ArrowUpDown, Clock, RefreshCw } from "lucide-react";

interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  current_price: number | null;
  price_change_pct: number | null;
  rsi_14: number | null;
  signal_direction: string | null;
  entry_price: number | null;
  hybrid_verdict: string;
  confidence_level: number | null;
  last_updated_at: string;
}

type SortField = "symbol" | "current_price" | "price_change_pct" | "rsi_14" | "hybrid_verdict";
type SortDirection = "asc" | "desc";

const ASSET_NAMES: Record<string, string> = {
  XAUUSD: "Gold / USD",
  EURUSD: "Euro / USD",
  GBPUSD: "British Pound / USD",
  TSLA: "Tesla, Inc.",
  AAPL: "Apple Inc.",
  NVDA: "NVIDIA Corporation",
};

const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

interface StockTableProps {
  filter?: string;
}

export default function StockTable({ filter = "All" }: StockTableProps) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("symbol");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000);

  // Create supabase client once using useMemo
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Fast fetch from database only (no API calls)
  const fetchSignals = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from("signals_cache")
        .select("id, symbol, timeframe, current_price, price_change_pct, rsi_14, signal_direction, entry_price, hybrid_verdict, confidence_level, last_updated_at")
        .order("last_updated_at", { ascending: false });

      if (fetchError) throw fetchError;
      setSignals(data || []);
      setLastUpdate(new Date());
      setCountdown(AUTO_REFRESH_INTERVAL / 1000);
      setError(null);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  // Background price update (only on manual refresh)
  const updatePrices = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetch("/api/update-prices", { method: "POST" });
      await fetchSignals(true);
    } catch (e) {
      console.warn("Price update failed");
    } finally {
      setRefreshing(false);
    }
  }, [fetchSignals]);

  // Initial fetch only once
  useEffect(() => {
    fetchSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh from database every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSignals(true);
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : AUTO_REFRESH_INTERVAL / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    updatePrices(); // Full update with API calls
  };

  // Filter signals
  const filteredSignals = signals.filter((s) => {
    if (filter === "All") return true;
    if (filter === "Buy Only") return s.hybrid_verdict === "BUY" || s.hybrid_verdict === "STRONG_BUY";
    if (filter === "Sell Only") return s.hybrid_verdict === "SELL" || s.hybrid_verdict === "STRONG_SELL";
    if (filter === "Active Signals") return s.signal_direction && s.signal_direction !== "NONE";
    return true;
  });

  // Sort signals
  const sortedSignals = [...filteredSignals].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (aVal === null) aVal = sortDirection === "asc" ? Infinity : -Infinity;
    if (bVal === null) bVal = sortDirection === "asc" ? Infinity : -Infinity;

    if (typeof aVal === "string") {
      return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSignalBadge = (verdict: string, direction: string | null) => {
    if (direction === "LONG") return "bg-buy text-white";
    if (direction === "SHORT") return "bg-sell text-white";
    
    switch (verdict) {
      case "STRONG_BUY":
      case "BUY":
        return "bg-buy-bg text-buy border border-buy/30";
      case "STRONG_SELL":
      case "SELL":
        return "bg-sell-bg text-sell border border-sell/30";
      default:
        return "bg-card border border-border text-text-secondary";
    }
  };

  const getDirectionLabel = (direction: string | null, verdict: string) => {
    if (direction === "LONG") return "LONG";
    if (direction === "SHORT") return "SHORT";
    return verdict;
  };

  const SortHeader = ({ field, label, className = "" }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`py-3 px-4 cursor-pointer hover:text-text-primary transition-colors group ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ${
          sortField === field ? "opacity-100 text-accent" : ""
        }`} />
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <span className="ml-3 text-text-secondary">Loading market data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sell mb-2">Error loading data</p>
        <p className="text-text-secondary text-sm">{error}</p>
        <button 
          onClick={handleManualRefresh}
          className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (sortedSignals.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary">No signals found.</p>
        <p className="text-text-muted text-sm mt-1">Run the analysis engine to generate signals.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-between mb-4 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>Updating prices...</span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-buy animate-pulse" />
              <span>Live • Next update in {countdown}s</span>
            </>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-card-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
        <thead>
          <tr className="border-b border-border text-text-secondary text-sm">
            <SortHeader field="symbol" label="Symbol" className="text-left" />
            <th className="text-left py-3 px-4">Name</th>
            <th className="text-center py-3 px-4">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                TF
              </div>
            </th>
            <SortHeader field="current_price" label="Price" className="text-right" />
            <SortHeader field="price_change_pct" label="Change" className="text-right" />
            <SortHeader field="rsi_14" label="RSI" className="text-center" />
            <SortHeader field="hybrid_verdict" label="Signal" className="text-center" />
          </tr>
        </thead>
        <tbody>
          {sortedSignals.map((signal) => {
            const priceChange = signal.price_change_pct ?? 0;
            const priceColor = priceChange > 0 ? "text-buy" : priceChange < 0 ? "text-sell" : "text-text-secondary";
            const hasActiveSignal = signal.signal_direction && signal.signal_direction !== "NONE";

            return (
              <tr 
                key={signal.id} 
                className={`border-b border-border hover:bg-card-hover transition-colors ${
                  hasActiveSignal ? "bg-card-hover/50" : ""
                }`}
              >
                <td className="py-4 px-4">
                  <Link 
                    href={`/stock/${signal.symbol}`}
                    className="font-semibold text-text-primary hover:text-accent transition-colors"
                  >
                    {signal.symbol}
                  </Link>
                </td>
                <td className="py-4 px-4">
                  <Link 
                    href={`/stock/${signal.symbol}`}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {ASSET_NAMES[signal.symbol] || signal.symbol}
                  </Link>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="text-xs bg-card border border-border px-2 py-1 rounded">
                    {signal.timeframe || "H1"}
                  </span>
                </td>
                <td className="py-4 px-4 font-mono text-right text-text-primary">
                  {signal.current_price 
                    ? `$${signal.current_price.toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: signal.current_price < 10 ? 4 : 2 
                      })}` 
                    : "N/A"}
                </td>
                <td className={`py-4 px-4 font-mono text-right ${priceColor}`}>
                  <div className="flex items-center justify-end gap-1">
                    {priceChange > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : priceChange < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : null}
                    {priceChange > 0 ? "+" : ""}{priceChange.toFixed(2)}%
                  </div>
                </td>
                <td className="py-4 px-4 font-mono text-center">
                  <span className={
                    signal.rsi_14 && signal.rsi_14 < 30 ? "text-buy" :
                    signal.rsi_14 && signal.rsi_14 > 70 ? "text-sell" :
                    "text-text-secondary"
                  }>
                    {signal.rsi_14 ? Number(signal.rsi_14).toFixed(1) : "N/A"}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <Link href={`/stock/${signal.symbol}`}>
                    <span className={`${getSignalBadge(signal.hybrid_verdict, signal.signal_direction)} px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1`}>
                      {signal.signal_direction === "LONG" && <TrendingUp className="h-3 w-3" />}
                      {signal.signal_direction === "SHORT" && <TrendingDown className="h-3 w-3" />}
                      {getDirectionLabel(signal.signal_direction, signal.hybrid_verdict)}
                    </span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
