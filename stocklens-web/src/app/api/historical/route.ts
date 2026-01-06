import { NextRequest, NextResponse } from "next/server";

// Symbol mapping for Yahoo Finance
const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: "GC=F",      // Gold Futures
  EURUSD: "EURUSD=X",  // EUR/USD
  GBPUSD: "GBPUSD=X",  // GBP/USD
  AAPL: "AAPL",
  TSLA: "TSLA",
  NVDA: "NVDA",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "3mo"; // 1d, 5d, 1mo, 3mo, 6mo, 1y

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const yahooSymbol = YAHOO_SYMBOLS[symbol] || symbol;
    
    // Determine interval based on range
    let interval = "1d";
    if (range === "1d") interval = "5m";
    else if (range === "5d") interval = "15m";
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;
    
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      throw new Error("No data returned from Yahoo Finance");
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];

    // Format data for lightweight-charts
    const chartData = timestamps.map((ts: number, i: number) => {
      const date = new Date(ts * 1000);
      const value = closes[i];
      
      // Format time based on interval
      let time: string;
      if (interval === "1d") {
        time = date.toISOString().split("T")[0]; // YYYY-MM-DD
      } else {
        // For intraday, use Unix timestamp
        time = date.toISOString().split("T")[0];
      }

      return {
        time,
        value: value !== null ? Number(value.toFixed(4)) : null,
      };
    }).filter((d: any) => d.value !== null);

    // Get current price and metadata
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;

    return NextResponse.json({
      success: true,
      symbol,
      yahooSymbol,
      currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      data: chartData,
      currency: meta.currency,
    });
  } catch (error: any) {
    console.error("Historical data error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
