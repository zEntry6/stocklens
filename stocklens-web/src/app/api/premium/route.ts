import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, action } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // For security, only allow specific emails in development
    const allowedEmails = [
      "ahmedsolihin250@gmail.com",
      // Add more test emails here
    ];

    if (!allowedEmails.includes(email.toLowerCase())) {
      return NextResponse.json({ error: "Email not authorized" }, { status: 403 });
    }

    // First, try to get the user from auth (we need their ID)
    // Since we can't list users with anon key, we'll create/update profile by email
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    const isPremium = action === "activate";
    const premiumUntil = isPremium 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      : null;

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from("profiles")
        .update({
          is_premium: isPremium,
          premium_until: premiumUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email.toLowerCase());

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Premium ${isPremium ? "activated" : "deactivated"} for ${email}`,
        premium_until: premiumUntil,
      });
    } else {
      // Create new profile (need user_id, but we don't have it from email alone)
      // Instead, we'll use a workaround - store email-based premium status
      
      // For now, return instruction to login first
      return NextResponse.json({
        success: false,
        message: "Profile not found. Please login first, then try again.",
        hint: "The profile is created when you login for the first time.",
      }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Premium activation error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  
  if (!email) {
    return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_premium, premium_until")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !profile) {
    return NextResponse.json({ is_premium: false, profile_exists: false });
  }

  return NextResponse.json({
    is_premium: profile.is_premium,
    premium_until: profile.premium_until,
    profile_exists: true,
  });
}
