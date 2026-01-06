import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WatchlistClient from "./WatchlistClient";

const SUPABASE_URL = 'https://famxbhnsogvfeoxmqhmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXhiaG5zb2d2ZmVveG1xaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTY1MTgsImV4cCI6MjA4MzEzMjUxOH0.xu41qUk6ApxAuMr6e_y77fyYTNtDYq0oH6fIklWaIng';

interface Signal {
  symbol: string;
  current_price: number | null;
  price_change_pct: number | null;
  signal_direction: string | null;
  hybrid_verdict: string;
}

// Server Component - runs on server, fast auth check via cookies
export default async function WatchlistPage() {
  const supabase = createClient();
  
  // Server-side auth check (uses cookies, very fast)
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login?redirect=/watchlist");
  }

  // Fetch initial data on server
  const defaultWatchlist = ["XAUUSD", "TSLA", "AAPL"];
  const symbols = defaultWatchlist.map(s => `"${s}"`).join(',');
  
  let initialSignals: Signal[] = [];
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/signals_cache?select=symbol,current_price,price_change_pct,signal_direction,hybrid_verdict&symbol=in.(${symbols})`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
      }
    );
    initialSignals = await response.json();
  } catch (err) {
    console.error("[Watchlist] Server fetch error:", err);
  }

  return (
    <WatchlistClient 
      user={{ email: user.email || '' }} 
      initialSignals={initialSignals}
      initialWatchlist={defaultWatchlist}
    />
  );
}
