import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// HARDCODED credentials
const SUPABASE_URL = 'https://famxbhnsogvfeoxmqhmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXhiaG5zb2d2ZmVveG1xaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTY1MTgsImV4cCI6MjA4MzEzMjUxOH0.xu41qUk6ApxAuMr6e_y77fyYTNtDYq0oH6fIklWaIng';

// Create client immediately (not lazy)
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function createClient() {
  return supabase;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };

