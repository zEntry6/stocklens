import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  // This is for demo/testing - simulate successful payment
  const transactionId = request.nextUrl.searchParams.get("transaction_id");
  const status = request.nextUrl.searchParams.get("status");
  const email = request.nextUrl.searchParams.get("email");

  if (status === "success" && (transactionId || email)) {
    return handlePaymentSuccess(transactionId, email);
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle different payment gateway webhooks
    // Midtrans format
    if (body.transaction_status) {
      return handleMidtransWebhook(body);
    }
    
    // Xendit format
    if (body.event) {
      return handleXenditWebhook(body);
    }

    // Generic/Demo format
    if (body.transaction_id && body.status) {
      return handlePaymentSuccess(body.transaction_id, body.email);
    }

    return NextResponse.json({ error: "Unknown webhook format" }, { status: 400 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handlePaymentSuccess(transactionId: string | null, email: string | null) {
  try {
    let userEmail = email;
    let userId: string | null = null;

    // If we have transaction ID, get user info from transaction
    if (transactionId) {
      const { data: transaction } = await supabaseAdmin
        .from("transactions")
        .select("user_id, email")
        .eq("id", transactionId)
        .single();

      if (transaction) {
        userId = transaction.user_id;
        userEmail = transaction.email;

        // Update transaction status
        await supabaseAdmin
          .from("transactions")
          .update({ status: "success", paid_at: new Date().toISOString() })
          .eq("id", transactionId);
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Calculate premium expiration (30 days from now)
    const premiumExpiresAt = new Date();
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30);

    // Update profile to premium
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_premium: true,
        premium_expires_at: premiumExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail.toLowerCase());

    if (updateError) {
      // Try update by user_id if email update failed
      if (userId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            is_premium: true,
            premium_expires_at: premiumExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      }
    }

    console.log(`✅ Premium activated for ${userEmail} until ${premiumExpiresAt.toISOString()}`);

    // Return JSON response
    return NextResponse.json({
      success: true,
      message: "Premium activated successfully!",
      email: userEmail,
      premium_expires_at: premiumExpiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Payment success handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleMidtransWebhook(body: any) {
  // Midtrans webhook handler
  const { order_id, transaction_status, fraud_status } = body;
  
  if (transaction_status === "capture" || transaction_status === "settlement") {
    if (fraud_status === "accept" || !fraud_status) {
      return handlePaymentSuccess(order_id, null);
    }
  }
  
  return NextResponse.json({ received: true });
}

async function handleXenditWebhook(body: any) {
  // Xendit webhook handler
  const { event, data } = body;
  
  if (event === "payment.succeeded" || event === "invoice.paid") {
    const email = data?.customer?.email || data?.payer_email;
    const externalId = data?.external_id || data?.id;
    return handlePaymentSuccess(externalId, email);
  }
  
  return NextResponse.json({ received: true });
}
