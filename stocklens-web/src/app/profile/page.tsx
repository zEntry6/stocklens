"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = 'https://famxbhnsogvfeoxmqhmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXhiaG5zb2d2ZmVveG1xaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTY1MTgsImV4cCI6MjA4MzEzMjUxOH0.xu41qUk6ApxAuMr6e_y77fyYTNtDYq0oH6fIklWaIng';

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
  Lock,
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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          router.push("/login");
          return;
        }

        setUser(user);

        // Try to get profile via REST API
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        const profiles = await response.json();
        const profileData = profiles?.[0];

        if (profileData) {
          setProfile(profileData);
        } else {
          // Create default profile object from auth user
          setProfile({
            id: user.id,
            email: user.email || "",
            full_name: user.user_metadata?.full_name || null,
            is_premium: false,
            premium_until: null,
            created_at: user.created_at,
          });
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <span className="ml-3 text-text-secondary">Loading profile...</span>
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
            Please sign in to view your profile.
          </p>
          <Link
            href="/login"
            className="block w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const memberSince = new Date(profile?.created_at || user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-text-secondary">Manage your account settings</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="card text-center">
              {/* Avatar */}
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-accent/20 mb-4">
                <User className="h-12 w-12 text-accent" />
              </div>

              {/* Name & Email */}
              <h2 className="text-xl font-bold mb-1">
                {profile?.full_name || "Trader"}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{user.email}</p>

              {/* Premium Badge */}
              {profile?.is_premium ? (
                <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <Crown className="h-4 w-4" />
                  Premium Member
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-card-hover text-text-secondary px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <User className="h-4 w-4" />
                  Free Account
                </div>
              )}

              {/* Member Since */}
              <div className="flex items-center justify-center gap-2 text-text-muted text-sm">
                <Calendar className="h-4 w-4" />
                Member since {memberSince}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-card hover:bg-sell/10 text-text-secondary hover:text-sell py-3 rounded-lg font-medium transition-colors border border-border"
            >
              {loggingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
              {loggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>

          {/* Settings Panels */}
          <div className="md:col-span-2 space-y-6">
            {/* Subscription Status */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold">Subscription</h3>
              </div>

              {profile?.is_premium ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/30">
                    <div className="flex items-center gap-3">
                      <Crown className="h-6 w-6 text-accent" />
                      <div>
                        <p className="font-medium text-accent">Premium Active</p>
                        <p className="text-sm text-text-secondary">
                          Expires: {profile.premium_until 
                            ? new Date(profile.premium_until).toLocaleDateString() 
                            : "Lifetime"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/pricing"
                      className="text-sm text-accent hover:underline"
                    >
                      Manage
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Shield className="h-4 w-4 text-buy" />
                      Stop Loss & Take Profit
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <TrendingUp className="h-4 w-4 text-buy" />
                      ATR Money Management
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Star className="h-4 w-4 text-buy" />
                      Sentiment Analysis
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Bell className="h-4 w-4 text-buy" />
                      AI Hybrid Verdict
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-card-hover rounded-lg border border-border">
                    <div>
                      <p className="font-medium">Free Plan</p>
                      <p className="text-sm text-text-secondary">
                        Basic signals and technical analysis
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Crown className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Upgrade to Premium</p>
                        <p className="text-sm text-text-secondary mb-3">
                          Get Stop Loss & Take Profit levels with ATR-based money management
                        </p>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Crown className="h-4 w-4" />
                          Upgrade for IDR 25k/mo
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Account Settings */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-card-hover rounded-lg">
                  <Settings className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="text-lg font-semibold">Account Settings</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-text-muted" />
                    <div>
                      <p className="text-sm text-text-secondary">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                  <button className="text-sm text-accent hover:underline">
                    Change
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-text-muted" />
                    <div>
                      <p className="text-sm text-text-secondary">Password</p>
                      <p className="font-medium">••••••••</p>
                    </div>
                  </div>
                  <button className="text-sm text-accent hover:underline">
                    Change
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-text-muted" />
                    <div>
                      <p className="text-sm text-text-secondary">Notifications</p>
                      <p className="font-medium">Email alerts enabled</p>
                    </div>
                  </div>
                  <button className="text-sm text-accent hover:underline">
                    Manage
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-sell/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-sell/10 rounded-lg">
                  <Shield className="h-5 w-5 text-sell" />
                </div>
                <h3 className="text-lg font-semibold text-sell">Danger Zone</h3>
              </div>

              <div className="flex items-center justify-between p-3 bg-sell/5 rounded-lg border border-sell/20">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-text-secondary">
                    Permanently delete your account and all data
                  </p>
                </div>
                <button className="text-sm text-sell hover:underline">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
