"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Check, Crown, Shield, Zap, Bell, Star, Loader2, CheckCircle, X, Building2, Smartphone, Lightbulb, QrCode } from "lucide-react";

const FREE_FEATURES = [
  "Real-time price data",
  "Basic Technical Analysis (RSI, SMA)",
  "Entry price signals",
  "19 Global Assets (Forex, Gold, Crypto, Stocks)",
  "Price charts",
];

const PREMIUM_FEATURES = [
  "Everything in Free, plus:",
  "Stop Loss & Take Profit levels",
  "ATR-based money management",
  "Risk:Reward ratio calculation",
  "Sentiment Analysis (News)",
  "AI Hybrid Verdict",
  "Priority support",
  "No ads",
];

function PricingContent() {
  const searchParams = useSearchParams();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpires, setPremiumExpires] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const monthlyPrice = 25000;
  const annualPrice = 250000;
  const currentPrice = isAnnual ? annualPrice : monthlyPrice;

  useEffect(() => {
    checkUserStatus();
    
    if (searchParams.get("success") === "true") {
      setShowSuccess(true);
      checkUserStatus();
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  async function checkUserStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);

    if (session?.user) {
      // Check hardcoded premium emails first
      const PREMIUM_EMAILS = ["ahmedsolihin250@gmail.com"];
      if (session.user.email && PREMIUM_EMAILS.includes(session.user.email.toLowerCase())) {
        setIsPremium(true);
        setPremiumExpires("2026-02-05");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_premium, premium_expires_at")
        .eq("id", session.user.id)
        .single();

      setIsPremium(profile?.is_premium || false);
      setPremiumExpires(profile?.premium_expires_at || null);
    }
  }

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleUpgrade = async () => {
    if (!user) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }
    setShowPaymentModal(true);
  };

  const handleMidtransPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payment/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: isAnnual ? "annual" : "monthly" }),
      });
      const data = await res.json();

      if (data.success && data.token) {
        // Load Midtrans Snap
        const snapScript = document.createElement("script");
        snapScript.src = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
          ? "https://app.midtrans.com/snap/snap.js"
          : "https://app.sandbox.midtrans.com/snap/snap.js";
        snapScript.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "");
        
        snapScript.onload = () => {
          // @ts-ignore
          window.snap.pay(data.token, {
            onSuccess: function(result: any) {
              console.log("Payment success:", result);
              setShowSuccess(true);
              setShowPaymentModal(false);
              checkUserStatus();
            },
            onPending: function(result: any) {
              console.log("Payment pending:", result);
              alert("Pembayaran sedang diproses. Silakan selesaikan pembayaran.");
              setShowPaymentModal(false);
            },
            onError: function(result: any) {
              console.log("Payment error:", result);
              alert("Pembayaran gagal. Silakan coba lagi.");
            },
            onClose: function() {
              console.log("Payment popup closed");
              setLoading(false);
            },
          });
        };
        
        document.body.appendChild(snapScript);
      } else {
        alert("Gagal membuat transaksi: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payment/webhook?email=${encodeURIComponent(user.email)}&status=success`);
      const data = await res.json();
      
      if (data.success) {
        setShowSuccess(true);
        setShowPaymentModal(false);
        setIsPremium(true);
        setPremiumExpires(data.premium_expires_at);
        setTimeout(() => setShowSuccess(false), 5000);
      } else {
        alert("Payment failed: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Success Banner */}
        {showSuccess && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-buy text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Premium activated successfully!</span>
          </div>
        )}

        {/* Already Premium Banner */}
        {isPremium && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-accent/10 border border-accent rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-accent" />
                <div>
                  <p className="font-medium text-accent">You're a Premium member!</p>
                  {premiumExpires && (
                    <p className="text-sm text-text-secondary">
                      Valid until {new Date(premiumExpires).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
              <Link href="/" className="text-accent hover:underline text-sm">
                Start Trading →
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Upgrade to <span className="text-accent">Premium</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Get precise Stop Loss & Take Profit levels with ATR-based money management.
            Make smarter trading decisions.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`font-medium ${!isAnnual ? "text-text-primary" : "text-text-muted"}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isAnnual ? "bg-accent" : "bg-border"
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                isAnnual ? "translate-x-8" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`font-medium ${isAnnual ? "text-text-primary" : "text-text-muted"}`}>
            Annual
            <span className="ml-2 text-xs bg-buy/20 text-buy px-2 py-0.5 rounded-full">
              Save 17%
            </span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="card border-2 border-border">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Free</h2>
              <p className="text-text-secondary">Get started with basic signals</p>
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl font-bold">Rp 0</span>
              <span className="text-text-muted">/forever</span>
            </div>

            <ul className="space-y-3 mb-8">
              {FREE_FEATURES.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-buy flex-shrink-0 mt-0.5" />
                  <span className="text-text-secondary">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="block w-full text-center bg-card-hover hover:bg-border text-text-primary py-3 rounded-lg font-medium transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Premium Plan */}
          <div className="card border-2 border-accent relative overflow-hidden">
            {/* Popular Badge */}
            <div className="absolute top-4 right-4">
              <span className="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <Crown className="h-3 w-3" />
                POPULAR
              </span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                <Crown className="h-6 w-6 text-accent" />
                Premium
              </h2>
              <p className="text-text-secondary">Full trading signals with SL/TP</p>
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl font-bold">{formatIDR(currentPrice)}</span>
              <span className="text-text-muted">/{isAnnual ? "year" : "month"}</span>
              {isAnnual && (
                <p className="text-sm text-buy mt-1">
                  {formatIDR(Math.round(annualPrice / 12))}/month billed annually
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {PREMIUM_FEATURES.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className={i === 0 ? "font-semibold text-text-primary" : "text-text-secondary"}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={isPremium}
              className={`block w-full text-center py-3 rounded-lg font-medium transition-colors ${
                isPremium 
                  ? "bg-buy/20 text-buy cursor-default"
                  : "bg-accent hover:bg-accent-hover text-white"
              }`}
            >
              {isPremium ? "Already Premium" : "Upgrade Now"}
            </button>

            <p className="text-center text-text-muted text-xs mt-4">
              Secure payment via Midtrans • Cancel anytime
            </p>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <p className="text-text-muted text-sm mb-6">Trusted by traders worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-text-secondary">
              <Shield className="h-5 w-5 text-buy" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-2 text-text-secondary">
              <Zap className="h-5 w-5 text-accent" />
              <span>Instant Access</span>
            </div>
            <div className="flex items-center gap-2 text-text-secondary">
              <Bell className="h-5 w-5 text-yellow-500" />
              <span>Real-time Updates</span>
            </div>
            <div className="flex items-center gap-2 text-text-secondary">
              <Star className="h-5 w-5 text-yellow-500" />
              <span>4.8/5 Rating</span>
            </div>
          </div>
        </div>

        {/* FAQ Preview */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-center mb-6">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div className="card">
              <h4 className="font-medium mb-2">What payment methods do you accept?</h4>
              <p className="text-text-secondary text-sm">
                We accept all major payment methods via Midtrans including Bank Transfer, 
                GoPay, OVO, DANA, Credit/Debit Cards, and more.
              </p>
            </div>
            <div className="card">
              <h4 className="font-medium mb-2">Can I cancel anytime?</h4>
              <p className="text-text-secondary text-sm">
                Yes! You can cancel your subscription at any time. You'll continue to have 
                premium access until the end of your billing period.
              </p>
            </div>
            <div className="card">
              <h4 className="font-medium mb-2">What's included in the SL/TP levels?</h4>
              <p className="text-text-secondary text-sm">
                Premium members get precise Stop Loss and Take Profit levels calculated using 
                ATR (Average True Range) for proper money management. SL = 2×ATR, TP1 = 1.5×ATR, TP2 = 3×ATR.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <Crown className="h-12 w-12 text-accent mx-auto mb-3" />
              <h2 className="text-xl font-bold">Upgrade to Premium</h2>
              <p className="text-text-secondary">{formatIDR(currentPrice)}/{isAnnual ? "year" : "month"}</p>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-text-secondary text-center mb-4">Select payment method:</p>
              
              {/* Midtrans - All Payment Methods */}
              <button 
                onClick={handleMidtransPayment}
                disabled={loading}
                className="w-full p-4 bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg text-left flex items-center gap-3 transition-colors text-white"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">Pay with Midtrans</p>
                  <p className="text-xs text-blue-200">Bank Transfer, E-Wallet, QRIS, Card</p>
                </div>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-text-muted">or choose specific method</span>
                </div>
              </div>

              {/* Bank Transfer */}
              <button 
                onClick={handleMidtransPayment}
                disabled={loading}
                className="w-full p-3 bg-background hover:bg-card-hover border border-border rounded-lg text-left flex items-center gap-3 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Bank Transfer</p>
                  <p className="text-xs text-text-muted">BCA, Mandiri, BNI, BRI, Permata</p>
                </div>
              </button>

              {/* E-Wallet */}
              <button 
                onClick={handleMidtransPayment}
                disabled={loading}
                className="w-full p-3 bg-background hover:bg-card-hover border border-border rounded-lg text-left flex items-center gap-3 transition-colors"
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">E-Wallet</p>
                  <p className="text-xs text-text-muted">GoPay, OVO, DANA, ShopeePay, LinkAja</p>
                </div>
              </button>

              {/* QRIS */}
              <button 
                onClick={handleMidtransPayment}
                disabled={loading}
                className="w-full p-3 bg-background hover:bg-card-hover border border-border rounded-lg text-left flex items-center gap-3 transition-colors"
              >
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">QRIS</p>
                  <p className="text-xs text-text-muted">Scan & pay with any banking app</p>
                </div>
              </button>

              {/* Demo Payment - for testing */}
              {process.env.NODE_ENV === "development" && (
                <button 
                  onClick={handleDemoPayment}
                  disabled={loading}
                  className="w-full p-3 bg-accent/10 hover:bg-accent/20 border border-accent rounded-lg text-left flex items-center gap-3 transition-colors"
                >
                  <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Zap className="h-5 w-5 text-accent" />}
                  </div>
                  <div>
                    <p className="font-medium text-accent">Demo Payment (Dev Only)</p>
                    <p className="text-xs text-text-muted">For testing - activates immediately</p>
                  </div>
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                SSL Secured
              </span>
              <span>Powered by Midtrans</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
