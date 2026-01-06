"use client";

import { TrendingUp, TrendingDown, Target, ShieldAlert, Lock, Crown } from "lucide-react";
import Link from "next/link";

interface SignalCardProps {
  direction: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  riskRewardRatio: number | null;
  atr: number | null;
  isPremium: boolean;
}

export default function SignalCard({
  direction,
  entryPrice,
  stopLoss,
  takeProfit1,
  takeProfit2,
  riskRewardRatio,
  atr,
  isPremium,
}: SignalCardProps) {
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const hasSignal = isLong || isShort;

  if (!hasSignal) {
    return (
      <div className="card border-2 border-dashed border-border">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-card-hover mb-4">
            <Target className="h-8 w-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-secondary mb-2">No Active Signal</h3>
          <p className="text-text-muted text-sm">
            RSI is in neutral zone (30-70). Wait for oversold/overbought conditions.
          </p>
        </div>
      </div>
    );
  }

  // Format price based on value (more decimals for forex)
  const formatPrice = (price: number | null) => {
    if (price === null) return "---";
    if (price < 10) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(2);
  };

  // Calculate risk/reward in dollars
  const risk = entryPrice && stopLoss ? Math.abs(entryPrice - stopLoss) : null;
  const reward = entryPrice && takeProfit2 ? Math.abs(takeProfit2 - entryPrice) : null;

  return (
    <div className={`card border-2 ${isLong ? "border-buy/50" : "border-sell/50"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-6 pb-4 border-b ${isLong ? "border-buy/20" : "border-sell/20"}`}>
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${isLong ? "bg-buy/20" : "bg-sell/20"}`}>
            {isLong ? (
              <TrendingUp className={`h-6 w-6 text-buy`} />
            ) : (
              <TrendingDown className={`h-6 w-6 text-sell`} />
            )}
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isLong ? "text-buy" : "text-sell"}`}>
              {isLong ? "LONG" : "SHORT"} Signal
            </h3>
            <p className="text-text-secondary text-sm">ATR-based money management</p>
          </div>
        </div>
        {riskRewardRatio && (
          <div className="text-right">
            <p className="text-text-secondary text-xs">Risk:Reward</p>
            <p className="text-lg font-bold font-mono text-accent">1:{riskRewardRatio}</p>
          </div>
        )}
      </div>

      {/* Entry Price - Always visible */}
      <div className="mb-4">
        <div className="flex items-center justify-between p-4 bg-accent/10 rounded-xl border border-accent/30">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            <span className="font-medium">Entry Price</span>
          </div>
          <span className="text-2xl font-bold font-mono">${formatPrice(entryPrice)}</span>
        </div>
      </div>

      {/* SL/TP Section - Premium Gated */}
      {isPremium ? (
        <div className="space-y-3">
          {/* Stop Loss */}
          <div className="flex items-center justify-between p-4 bg-sell/10 rounded-xl border border-sell/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-sell" />
              <div>
                <span className="font-medium text-sell">Stop Loss</span>
                {risk && <span className="text-text-muted text-xs ml-2">(-${formatPrice(risk)})</span>}
              </div>
            </div>
            <span className="text-xl font-bold font-mono text-sell">${formatPrice(stopLoss)}</span>
          </div>

          {/* Take Profit 1 */}
          <div className="flex items-center justify-between p-4 bg-buy/10 rounded-xl border border-buy/30">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-buy" />
              <span className="font-medium text-buy">Take Profit 1</span>
            </div>
            <span className="text-xl font-bold font-mono text-buy">${formatPrice(takeProfit1)}</span>
          </div>

          {/* Take Profit 2 */}
          <div className="flex items-center justify-between p-4 bg-buy/10 rounded-xl border border-buy/30">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-buy" />
              <div>
                <span className="font-medium text-buy">Take Profit 2</span>
                {reward && <span className="text-text-muted text-xs ml-2">(+${formatPrice(reward)})</span>}
              </div>
            </div>
            <span className="text-xl font-bold font-mono text-buy">${formatPrice(takeProfit2)}</span>
          </div>

          {/* ATR Info */}
          {atr && (
            <div className="mt-4 p-3 bg-card-hover rounded-lg text-center">
              <p className="text-text-muted text-xs">
                ATR (14): <span className="text-text-secondary font-mono">${formatPrice(atr)}</span>
                <span className="mx-2">•</span>
                SL = 2×ATR
                <span className="mx-2">•</span>
                TP = 1.5×ATR / 3×ATR
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Premium Locked State */
        <div className="relative">
          {/* Blurred preview */}
          <div className="space-y-3 blur-md pointer-events-none select-none opacity-50">
            <div className="flex items-center justify-between p-4 bg-sell/10 rounded-xl border border-sell/30">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-sell" />
                <span className="font-medium text-sell">Stop Loss</span>
              </div>
              <span className="text-xl font-bold font-mono text-sell">$X,XXX.XX</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-buy/10 rounded-xl border border-buy/30">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-buy" />
                <span className="font-medium text-buy">Take Profit 1</span>
              </div>
              <span className="text-xl font-bold font-mono text-buy">$X,XXX.XX</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-buy/10 rounded-xl border border-buy/30">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-buy" />
                <span className="font-medium text-buy">Take Profit 2</span>
              </div>
              <span className="text-xl font-bold font-mono text-buy">$X,XXX.XX</span>
            </div>
          </div>

          {/* Lock Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90 backdrop-blur-sm rounded-xl">
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-3">
                <Lock className="h-7 w-7 text-accent" />
              </div>
              <h4 className="text-lg font-semibold text-text-primary mb-1">
                Unlock SL/TP Levels
              </h4>
              <p className="text-text-secondary text-sm mb-4">
                Get precise Stop Loss & Take Profit targets
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Crown className="h-4 w-4" />
                Upgrade to Premium
              </Link>
              <p className="text-text-muted text-xs mt-2">
                Only IDR 25,000/month
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
