import { NextRequest, NextResponse } from "next/server";

// Symbol mapping for Yahoo Finance
const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: "GC=F",      // Gold Futures
  EURUSD: "EURUSD=X",  // EUR/USD
  GBPUSD: "GBPUSD=X",  // GBP/USD
  AAPL: "AAPL",
  TSLA: "TSLA",
  NVDA: "NVDA",
  MSFT: "MSFT",
  GOOGL: "GOOGL",
  AMZN: "AMZN",
  META: "META",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const yahooSymbol = YAHOO_SYMBOLS[symbol] || symbol;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 }, // No cache for real-time
    });

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) {
      throw new Error("No data returned from Yahoo Finance");
    }
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const currency = meta.currency;
    return NextResponse.json({
      success: true,
      symbol,
      yahooSymbol,
      price: currentPrice,
      currency,
    });
  } catch (error: any) {
    console.error("Yahoo price error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
