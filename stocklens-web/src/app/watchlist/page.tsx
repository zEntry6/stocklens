"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Lock, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Signal {
  symbol: string;
  current_price: number | null;
  price_change_pct: number | null;
  signal_direction: string | null;
  hybrid_verdict: string;
}

const ASSET_NAMES: Record<string, string> = {
  XAUUSD: "Gold / USD",
  EURUSD: "Euro / USD",
  GBPUSD: "British Pound / USD",
  TSLA: "Tesla, Inc.",
  AAPL: "Apple Inc.",
  NVDA: "NVIDIA Corporation",
};

export default function WatchlistPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(["XAUUSD", "TSLA", "AAPL"]); // Default watchlist
  const [refreshing, setRefreshing] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const fetchSignals = useCallback(async () => {
    try {
      console.log("[Watchlist] Fetching signals for:", watchlist);
      const { data, error } = await supabase
        .from("signals_cache")
        .select("symbol, current_price, price_change_pct, signal_direction, hybrid_verdict")
        .in("symbol", watchlist);

      console.log("[Watchlist] Fetch result:", { data: data?.length, error });
      if (error) throw error;
      setSignals(data || []);
    } catch (err) {
      console.error("[Watchlist] Fetch error:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    async function checkAuth() {
      console.log("[Watchlist] Checking auth...");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[Watchlist] Session:", session ? "exists" : "null");
      if (session?.user) {
        setUser(session.user);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      }
      setLoading(false);
    }
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      fetchSignals();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSignals();
    setRefreshing(false);
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <span className="ml-3 text-text-secondary">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <Lock className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Login Required</h1>
          <p className="text-text-secondary mb-6">
            Create a free account to save your favorite assets to your watchlist.
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-medium transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="block w-full bg-card-hover hover:bg-border text-text-primary py-3 rounded-lg font-medium transition-colors"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Logged in view with real data
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Star className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">My Watchlist</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-card-hover hover:bg-border text-text-primary px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link 
            href="/"
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </Link>
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="card text-center py-12">
          <Star className="h-12 w-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary mb-2">Your watchlist is empty</p>
          <p className="text-text-muted text-sm">Go to the screener and add assets to your watchlist</p>
        </div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-secondary text-sm border-b border-border">
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">24h Change</th>
                <th className="py-3 px-4 text-center">Signal</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {signals.map((item) => {
                const priceChange = item.price_change_pct ?? 0;
                return (
                  <tr key={item.symbol} className="border-b border-border hover:bg-card-hover transition-colors">
                    <td className="py-4 px-4">
                      <Link href={`/stock/${item.symbol}`} className="flex items-center gap-3 hover:text-accent">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <div>
                          <p className="font-medium">{item.symbol}</p>
                          <p className="text-xs text-text-muted">{ASSET_NAMES[item.symbol] || item.symbol}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-4 px-4 font-mono text-right">
                      ${item.current_price?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: item.current_price && item.current_price < 10 ? 4 : 2
                      }) ?? "N/A"}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`flex items-center justify-end gap-1 ${priceChange >= 0 ? "text-buy" : "text-sell"}`}>
                        {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`${getSignalBadge(item.hybrid_verdict, item.signal_direction)} px-3 py-1 rounded-full text-xs font-semibold`}>
                        {item.signal_direction === "LONG" ? "LONG" : 
                         item.signal_direction === "SHORT" ? "SHORT" : 
                         item.hybrid_verdict}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button 
                        onClick={() => removeFromWatchlist(item.symbol)}
                        className="p-2 hover:bg-sell/10 rounded-lg text-text-muted hover:text-sell transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
