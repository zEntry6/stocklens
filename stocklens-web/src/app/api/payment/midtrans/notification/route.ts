import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("Midtrans webhook received:", JSON.stringify(body, null, 2));

    const {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
      signature_key,
      status_code,
    } = body;

    // Verify signature (important for security!)
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const expectedSignature = crypto
      .createHash("sha512")
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest("hex");

    if (signature_key !== expectedSignature) {
      console.error("Invalid signature!");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // Get transaction from database
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", order_id)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found:", order_id);
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Handle different transaction statuses
    let newStatus = "pending";
    let shouldActivatePremium = false;

    if (transaction_status === "capture") {
      if (fraud_status === "accept") {
        newStatus = "success";
        shouldActivatePremium = true;
      } else if (fraud_status === "challenge") {
        newStatus = "challenge";
      }
    } else if (transaction_status === "settlement") {
      newStatus = "success";
      shouldActivatePremium = true;
    } else if (transaction_status === "pending") {
      newStatus = "pending";
    } else if (
      transaction_status === "deny" ||
      transaction_status === "cancel" ||
      transaction_status === "expire"
    ) {
      newStatus = transaction_status;
    }

    // Update transaction status
    await supabaseAdmin
      .from("transactions")
      .update({
        status: newStatus,
        midtrans_status: transaction_status,
        paid_at: shouldActivatePremium ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    // Activate premium if payment successful
    if (shouldActivatePremium) {
      const plan = transaction.plan || "monthly";
      const daysToAdd = plan === "annual" ? 365 : 30;
      
      const premiumExpiresAt = new Date();
      premiumExpiresAt.setDate(premiumExpiresAt.getDate() + daysToAdd);

      // Update user profile to premium
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_premium: true,
          premium_expires_at: premiumExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.user_id);

      if (profileError) {
        console.error("Failed to update profile:", profileError);
        // Try by email as fallback
        await supabaseAdmin
          .from("profiles")
          .update({
            is_premium: true,
            premium_expires_at: premiumExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("email", transaction.email?.toLowerCase());
      }

      console.log(`Premium activated for ${transaction.email} until ${premiumExpiresAt.toISOString()}`);
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Midtrans webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also handle GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: "Midtrans webhook endpoint",
    status: "active" 
  });
}
