import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import midtransClient from "midtrans-client";

// Initialize Midtrans Snap client
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

// Price in IDR
const PRICES = {
  monthly: 25000,
  annual: 250000,
};

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
    const price = PRICES[plan as keyof typeof PRICES] || PRICES.monthly;

    // Generate unique order ID
    const orderId = `SL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create Midtrans transaction
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: price,
      },
      customer_details: {
        email: session.user.email,
        first_name: session.user.email?.split("@")[0] || "User",
      },
      item_details: [
        {
          id: `premium-${plan}`,
          price: price,
          quantity: 1,
          name: `StockLens Premium (${plan === "annual" ? "Annual" : "Monthly"})`,
        },
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?success=true`,
      },
      custom_field1: session.user.id,
      custom_field2: session.user.email,
      custom_field3: plan,
    };

    const transaction = await snap.createTransaction(parameter);

    // Store transaction in database
    await supabase.from("transactions").insert({
      id: orderId,
      user_id: session.user.id,
      email: session.user.email,
      amount: price,
      currency: "IDR",
      status: "pending",
      plan: plan,
      midtrans_token: transaction.token,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id: orderId,
    });
  } catch (error: any) {
    console.error("Midtrans create transaction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create transaction" },
      { status: 500 }
    );
  }
}
