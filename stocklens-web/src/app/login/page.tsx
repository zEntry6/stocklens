"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Mail, Lock, Loader2, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Verify session was created
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Login successful, session:", session ? "exists" : "null");

      if (session) {
        // Create/update profile record - use rpc or skip if types don't match
        try {
          await supabase
            .from("profiles")
            .upsert({
              id: session.user.id,
              email: session.user.email?.toLowerCase(),
              updated_at: new Date().toISOString(),
            } as any, { onConflict: "id" });
        } catch (profileError) {
          console.warn("Profile upsert warning:", profileError);
        }

        // Force a full page reload to ensure cookies are set
        window.location.href = "/";
      } else {
        throw new Error("Session not created. Please try again.");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err?.message || "Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold">
            <TrendingUp className="h-8 w-8 text-accent" />
            <span>Stock<span className="text-accent">Lens</span></span>
          </Link>
          <p className="text-text-secondary mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-sell/10 border border-sell/30 rounded-lg text-sell text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-lg focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-accent hover:underline">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-text-muted">Don't have an account?</span>
            </div>
          </div>

          {/* Register Link */}
          <Link
            href="/register"
            className="block w-full text-center bg-card-hover hover:bg-border text-text-primary py-3 rounded-lg font-medium transition-colors"
          >
            Create Free Account
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-sm mt-6">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
