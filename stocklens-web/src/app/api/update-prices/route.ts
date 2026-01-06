import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Symbol mapping for Yahoo Finance
const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: "GC=F",      // Gold Futures
  EURUSD: "EURUSD=X",  // EUR/USD
  GBPUSD: "GBPUSD=X",  // GBP/USD
};

// Finnhub for US Stocks
const FINNHUB_SYMBOLS = ["AAPL", "TSLA", "NVDA"];

interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  source: string;
}

async function fetchYahooQuote(symbol: string, yahooSymbol: string): Promise<QuoteData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePercent = (change / prevClose) * 100;
    
    return {
      symbol,
      price,
      change,
      changePercent,
      source: "yahoo",
    };
  } catch (error) {
    console.error(`Yahoo fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchFinnhubQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;
    
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 0 } });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.c || data.c === 0) return null;
    
    return {
      symbol,
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      source: "finnhub",
    };
  } catch (error) {
    console.error(`Finnhub fetch error for ${symbol}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    const quotes: QuoteData[] = [];
    
    // Fetch Yahoo quotes (Forex & Commodities)
    const yahooPromises = Object.entries(YAHOO_SYMBOLS).map(([symbol, yahooSymbol]) =>
      fetchYahooQuote(symbol, yahooSymbol)
    );
    
    // Fetch Finnhub quotes (US Stocks)
    const finnhubPromises = FINNHUB_SYMBOLS.map((symbol) =>
      fetchFinnhubQuote(symbol)
    );
    
    const results = await Promise.all([...yahooPromises, ...finnhubPromises]);
    
    for (const result of results) {
      if (result) quotes.push(result);
    }
    
    // Update database
    const updates = quotes.map(async (quote) => {
      const { error } = await supabase
        .from("signals_cache")
        .update({
          current_price: quote.price,
          price_change_pct: quote.changePercent,
          last_updated_at: new Date().toISOString(),
        })
        .eq("symbol", quote.symbol);
      
      if (error) {
        console.error(`DB update error for ${quote.symbol}:`, error);
        return { symbol: quote.symbol, success: false, error: error.message };
      }
      
      return { symbol: quote.symbol, success: true, price: quote.price, source: quote.source };
    });
    
    const updateResults = await Promise.all(updates);
    
    return NextResponse.json({
      success: true,
      updated: updateResults.filter((r) => r.success).length,
      results: updateResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Update prices error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggers
export async function POST() {
  return GET();
}
