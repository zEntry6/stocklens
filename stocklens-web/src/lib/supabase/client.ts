import { createBrowserClient } from '@supabase/ssr';

// HARDCODED credentials - bypass env var issues completely
const SUPABASE_URL = 'https://famxbhnsogvfeoxmqhmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXhiaG5zb2d2ZmVveG1xaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTY1MTgsImV4cCI6MjA4MzEzMjUxOH0.xu41qUk6ApxAuMr6e_y77fyYTNtDYq0oH6fIklWaIng';

// Singleton client instance
let browserClient: any = null;

/**
 * Create a Supabase client for use in the browser (Client Components)
 * Uses singleton pattern to avoid multiple instances
 */
export function createClient() {
  if (!browserClient) {
    console.log('[Supabase] Creating new browser client');
    browserClient = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }
  return browserClient;
}

// Export constants for other components that need them directly
export { SUPABASE_URL, SUPABASE_ANON_KEY };

