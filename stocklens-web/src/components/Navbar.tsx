"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Activity, Crown, LogIn, User, Menu, X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface UserProfile {
  is_premium: boolean;
  email: string | null;
}

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Get current session
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_premium, email")
          .eq("id", user.id)
          .single();
        
        setProfile(profileData);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("is_premium, email")
            .eq("id", session.user.id)
            .single();
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    // Redirect to login page instead of OAuth
    window.location.href = "/login";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Activity className="h-8 w-8 text-accent" />
            <span className="text-xl font-bold text-text-primary">StockLens</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Screener
            </Link>
            <Link 
              href="/watchlist" 
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Watchlist
            </Link>
            
            {/* Auth Section */}
            {user ? (
              <div className="flex items-center gap-4">
                {profile?.is_premium ? (
                  <span className="flex items-center gap-1 text-yellow-500 text-sm">
                    <Crown className="h-4 w-4" />
                    Premium
                  </span>
                ) : (
                  <Link
                    href="/pricing"
                    className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    Upgrade to Premium
                  </Link>
                )}
                <div className="relative group">
                  <button className="flex items-center gap-2 text-text-secondary hover:text-text-primary">
                    <User className="h-5 w-5" />
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="p-3 border-b border-border">
                      <p className="text-sm text-text-primary truncate">
                        {profile?.email || user.email}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      className="block w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors"
                    >
                      My Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-text-secondary hover:text-text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-2">
              {/* User Info (if logged in) */}
              {user && (
                <div className="px-3 py-3 mb-2 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {profile?.email || user.email}
                      </p>
                      {profile?.is_premium ? (
                        <span className="flex items-center gap-1 text-yellow-500 text-xs">
                          <Crown className="h-3 w-3" />
                          Premium Member
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Free Account</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <Link 
                href="/" 
                className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-card-hover rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Screener
              </Link>
              <Link 
                href="/watchlist" 
                className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-card-hover rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Watchlist
              </Link>
              
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-card-hover rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Profile
                  </Link>
                  <Link
                    href="/pricing"
                    className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-card-hover rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  
                  {/* Upgrade Button (if not premium) */}
                  {!profile?.is_premium && (
                    <Link
                      href="/pricing"
                      className="mt-2 bg-accent hover:bg-accent-hover text-white px-4 py-3 rounded-lg font-medium transition-colors text-center flex items-center justify-center gap-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Crown className="h-4 w-4" />
                      Upgrade to Premium
                    </Link>
                  )}
                  
                  <div className="border-t border-border mt-2 pt-2">
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sell hover:bg-card-hover rounded-lg transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-2">
                  <Link
                    href="/login"
                    className="block w-full text-center bg-accent hover:bg-accent-hover text-white px-4 py-3 rounded-lg font-medium transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="block w-full text-center bg-card-hover hover:bg-border text-text-primary px-4 py-3 rounded-lg font-medium transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
