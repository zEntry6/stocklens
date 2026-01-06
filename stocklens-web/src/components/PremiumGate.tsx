"use client";

import { Lock, Crown } from "lucide-react";
import Link from "next/link";

interface PremiumGateProps {
  children: React.ReactNode;
  isPremium: boolean;
  featureName?: string;
}

export default function PremiumGate({ children, isPremium, featureName = "this feature" }: PremiumGateProps) {
  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-md pointer-events-none select-none opacity-50">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <Lock className="h-8 w-8 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Premium Feature
          </h3>
          <p className="text-text-secondary text-sm mb-4 max-w-xs">
            Unlock {featureName} with StockLens Premium for advanced trading insights.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Crown className="h-4 w-4" />
            Upgrade to Premium
          </Link>
          <p className="text-text-muted text-xs mt-3">
            Only IDR 25,000/month
          </p>
        </div>
      </div>
    </div>
  );
}
