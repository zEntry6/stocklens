"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Zap, Filter, Lock } from "lucide-react";
import StockTable from "@/components/StockTable";

export default function Home() {
  const [filter, setFilter] = useState("All");

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Smart Trading Decisions for{" "}
            <span className="text-accent">Global Markets</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            AI-powered Forex, Commodities & US Stock predictions combining Technical Analysis (RSI, MACD) 
            and Sentiment Analysis (News) to give you clear Buy/Sell signals.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-buy-bg rounded-lg">
              <TrendingUp className="h-6 w-6 text-buy" />
            </div>
            <div>
              <p className="text-text-secondary text-sm">Strongest Signal</p>
              <p className="text-xl font-bold text-buy">STRONG_BUY</p>
            </div>
          </div>
          
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-sell-bg rounded-lg">
              <TrendingDown className="h-6 w-6 text-sell" />
            </div>
            <div>
              <p className="text-text-secondary text-sm">Risk Alert</p>
              <p className="text-xl font-bold text-sell">STRONG_SELL</p>
            </div>
          </div>
          
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Zap className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-text-secondary text-sm">Markets Covered</p>
              <p className="text-xl font-bold">Forex • Commodities • US Stocks</p>
            </div>
          </div>
        </div>

        {/* Stock Screener */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold">Market Screener</h2>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-secondary" />
              <select 
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="All">All Assets</option>
                <option value="Buy Only">Buy Signals</option>
                <option value="Sell Only">Sell Signals</option>
                <option value="Commodities">Commodities</option>
                <option value="Forex">Forex</option>
                <option value="Stocks">US Stocks</option>
              </select>
            </div>
          </div>

          <StockTable filter={filter} />

          {/* Premium CTA */}
          <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-accent" />
                <p className="font-medium">Unlock Stop Loss & Take Profit Levels</p>
                <p className="text-text-secondary text-sm">Get precise Entry, SL & TP targets with ATR-based money management</p>
              </div>
              <a 
                href="/pricing"
                className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                IDR 25k/mo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-text-secondary text-sm">
            <p>© 2026 StockLens. Global Markets Only.</p>
            <p>Data provided by AlphaVantage & Marketaux</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
