"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { Search, CheckCircle, XCircle } from "lucide-react";

export default function AuthDebugPage() {
  const [authState, setAuthState] = useState<any>({
    loading: true,
    session: null,
    user: null,
    error: null,
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkAuth() {
      try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Check user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        setAuthState({
          loading: false,
          session: session,
          user: user,
          error: sessionError || userError,
        });
      } catch (err) {
        setAuthState({
          loading: false,
          session: null,
          user: null,
          error: err,
        });
      }
    }

    checkAuth();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth event:", event);
        setAuthState((prev: any) => ({
          ...prev,
          session: session,
          user: session?.user || null,
        }));
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Search className="h-6 w-6" />
          Auth Debug Page
        </h1>

        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Auth State:</h2>
          
          {authState.loading ? (
            <p>Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-text-muted mb-1">Session:</p>
                <p className={`font-mono flex items-center gap-2 ${authState.session ? "text-buy" : "text-sell"}`}>
                  {authState.session ? <><CheckCircle className="h-4 w-4" /> EXISTS</> : <><XCircle className="h-4 w-4" /> NULL</>}
                </p>
              </div>

              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-text-muted mb-1">User:</p>
                <p className={`font-mono flex items-center gap-2 ${authState.user ? "text-buy" : "text-sell"}`}>
                  {authState.user ? <><CheckCircle className="h-4 w-4" /> EXISTS</> : <><XCircle className="h-4 w-4" /> NULL</>}
                </p>
                {authState.user && (
                  <p className="text-sm mt-2">Email: {authState.user.email}</p>
                )}
              </div>

              {authState.error && (
                <div className="p-4 bg-sell/10 rounded-lg">
                  <p className="text-sm text-text-muted mb-1">Error:</p>
                  <p className="text-sell font-mono text-sm">
                    {JSON.stringify(authState.error, null, 2)}
                  </p>
                </div>
              )}

              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-text-muted mb-2">Raw Session Data:</p>
                <pre className="text-xs overflow-auto max-h-40 bg-card p-2 rounded">
                  {JSON.stringify(authState.session, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {authState.user ? (
            <>
              <button
                onClick={handleLogout}
                className="bg-sell hover:bg-sell/80 text-white px-4 py-2 rounded-lg"
              >
                Logout
              </button>
              <Link
                href="/watchlist"
                className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg"
              >
                Go to Watchlist
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg"
            >
              Go to Login
            </Link>
          )}
          <Link
            href="/"
            className="bg-card-hover hover:bg-border text-text-primary px-4 py-2 rounded-lg"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
