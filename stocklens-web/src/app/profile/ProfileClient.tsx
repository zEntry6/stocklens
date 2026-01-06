"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
  User, 
  Mail, 
  Crown, 
  Calendar, 
  LogOut, 
  Settings, 
  Bell,
  Shield,
  Loader2,
  TrendingUp,
  CreditCard,
  Star
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_premium: boolean;
  premium_until: string | null;
  created_at: string;
}

interface ProfileClientProps {
  user: { id: string; email: string; created_at?: string };
  profile: UserProfile;
}

export default function ProfileClient({ user, profile }: ProfileClientProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const supabase = createClient();

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
            <User className="h-8 w-8 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.full_name || "User"}</h1>
            <p className="text-text-secondary">{user.email}</p>
          </div>
        </div>
        {profile.is_premium && (
          <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full">
            <Crown className="h-5 w-5" />
            <span className="font-semibold">Premium</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Info */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            Account Information
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-text-muted" />
              <div>
                <p className="text-xs text-text-muted">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-text-muted" />
              <div>
                <p className="text-xs text-text-muted">Member Since</p>
                <p className="font-medium">{formatDate(profile.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-text-muted" />
              <div>
                <p className="text-xs text-text-muted">Account Status</p>
                <p className="font-medium text-buy">Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent" />
            Subscription
          </h2>
          {profile.is_premium ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg">
                <Star className="h-6 w-6 text-yellow-500" />
                <div>
                  <p className="font-semibold text-yellow-500">Premium Active</p>
                  <p className="text-xs text-text-secondary">
                    Valid until {profile.premium_until ? formatDate(profile.premium_until) : 'Lifetime'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                Enjoy unlimited access to all premium features including advanced signals, 
                real-time alerts, and detailed analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-text-secondary">
                Upgrade to Premium for unlimited access to all features.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-text-secondary">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  Advanced AI Signals
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Bell className="h-4 w-4 text-accent" />
                  Real-time Alerts
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Star className="h-4 w-4 text-accent" />
                  Priority Support
                </div>
              </div>
              <Link
                href="/premium"
                className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-medium transition-colors"
              >
                <CreditCard className="h-5 w-5" />
                Upgrade to Premium
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent" />
            Quick Actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Link
              href="/watchlist"
              className="flex items-center gap-3 p-3 bg-card-hover hover:bg-border rounded-lg transition-colors"
            >
              <Star className="h-5 w-5 text-yellow-500" />
              <span>My Watchlist</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 p-3 bg-card-hover hover:bg-border rounded-lg transition-colors"
            >
              <TrendingUp className="h-5 w-5 text-accent" />
              <span>Screener</span>
            </Link>
            <Link
              href="/alerts"
              className="flex items-center gap-3 p-3 bg-card-hover hover:bg-border rounded-lg transition-colors"
            >
              <Bell className="h-5 w-5 text-accent" />
              <span>Alerts</span>
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-3 p-3 bg-card-hover hover:bg-sell/10 hover:text-sell rounded-lg transition-colors text-left"
            >
              {loggingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
              <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
