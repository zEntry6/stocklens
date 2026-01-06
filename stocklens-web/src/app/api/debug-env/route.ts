import { NextResponse } from "next/server";

export async function GET() {
  // Check if env vars are loaded (don't expose full keys!)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return NextResponse.json({
    supabase_url_set: !!supabaseUrl,
    supabase_url_preview: supabaseUrl ? supabaseUrl.substring(0, 30) + "..." : "NOT SET",
    supabase_key_set: !!supabaseKey,
    supabase_key_length: supabaseKey ? supabaseKey.length : 0,
    supabase_key_preview: supabaseKey ? supabaseKey.substring(0, 20) + "..." : "NOT SET",
    node_env: process.env.NODE_ENV,
  });
}
