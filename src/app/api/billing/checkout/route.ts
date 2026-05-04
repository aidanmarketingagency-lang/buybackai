import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, stripeConfigured, PRICE_PRO, PRICE_FOUNDER } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripeConfigured || !stripe) {
    return NextResponse.json(
      { error: "billing_not_configured", message: "Stripe is not yet wired in this environment." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = (await request.json().catch(() => ({}))) as { plan?: string };
  const priceId =
    plan === "founder" ? PRICE_FOUNDER : plan === "pro" ? PRICE_PRO : null;
  if (!priceId) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buybackai.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard?canceled=1`,
    subscription_data: { metadata: { supabase_user_id: user.id } },
    metadata: { supabase_user_id: user.id, plan: plan! },
  });

  return NextResponse.json({ url: session.url });
}
