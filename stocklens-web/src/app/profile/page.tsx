import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

const SUPABASE_URL = 'https://famxbhnsogvfeoxmqhmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbXhiaG5zb2d2ZmVveG1xaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTY1MTgsImV4cCI6MjA4MzEzMjUxOH0.xu41qUk6ApxAuMr6e_y77fyYTNtDYq0oH6fIklWaIng';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_premium: boolean;
  premium_until: string | null;
  created_at: string;
}

// Server Component - runs on server, fast auth check via cookies
export default async function ProfilePage() {
  const supabase = createClient();
  
  // Server-side auth check (uses cookies, very fast)
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login?redirect=/profile");
  }

  // Fetch profile data on server
  let profile: UserProfile | null = null;
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
      }
    );
    const profiles = await response.json();
    profile = profiles?.[0] || null;
  } catch (err) {
    console.error("[Profile] Server fetch error:", err);
  }

  // If no profile, create default one
  if (!profile) {
    const isPremium = user.email?.toLowerCase() === 'ahmedsolihin250@gmail.com';
    profile = {
      id: user.id,
      email: user.email || '',
      full_name: null,
      is_premium: isPremium,
      premium_until: isPremium ? '2026-12-31' : null,
      created_at: user.created_at || new Date().toISOString(),
    };
  }

  return (
    <ProfileClient 
      user={{ 
        id: user.id, 
        email: user.email || '',
        created_at: user.created_at 
      }} 
      profile={profile}
    />
  );
}
