import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Price in IDR
const PREMIUM_PRICE = 25000; // IDR 25,000

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Please login first" }, { status: 401 });
    }

    const { plan = "monthly" } = await request.json();

    // Create transaction record
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { error: txError } = await supabase.from("transactions").insert({
      id: transactionId,
      user_id: session.user.id,
      email: session.user.email,
      amount: PREMIUM_PRICE,
      currency: "IDR",
      status: "pending",
      plan: plan,
      created_at: new Date().toISOString(),
    });

    if (txError) {
      console.error("Transaction create error:", txError);
      // Continue anyway - transaction table might not exist
    }

    // For demo: Return payment info
    // In production, integrate with Midtrans/Xendit/Stripe
    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      amount: PREMIUM_PRICE,
      currency: "IDR",
      // Demo payment methods
      payment_methods: [
        {
          type: "bank_transfer",
          bank: "BCA",
          account: "1234567890",
          name: "StockLens Premium",
        },
        {
          type: "ewallet",
          provider: "GoPay/OVO/Dana",
          number: "081234567890",
        },
        {
          type: "demo",
          note: "Use this for testing - instant activation",
        },
      ],
      // In production, this would be a payment gateway URL
      demo_activate_url: `/api/payment/webhook?transaction_id=${transactionId}&status=success`,
    });
  } catch (error: any) {
    console.error("Payment create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
