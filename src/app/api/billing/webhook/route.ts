import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeConfigured, priceIdToPlan } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(request: Request) {
  if (!stripeConfigured || !stripe) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }
  if (!WEBHOOK_SECRET) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET missing — refusing to process");
    return NextResponse.json({ error: "webhook_misconfigured" }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe webhook] signature failed:", err);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.metadata?.supabase_user_id ??
          (typeof session.customer === "string"
            ? await resolveUserIdFromCustomer(session.customer)
            : null);
        if (!userId || !session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await applySubscription(userId, sub);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ??
          (typeof sub.customer === "string"
            ? await resolveUserIdFromCustomer(sub.customer)
            : null);
        if (!userId) break;
        await applySubscription(userId, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ??
          (typeof sub.customer === "string"
            ? await resolveUserIdFromCustomer(sub.customer)
            : null);
        if (!userId) break;
        await downgradeToFree(userId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler crashed", event.type, err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function applySubscription(userId: string, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const plan = priceIdToPlan(priceId);
  const active =
    sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  await supabaseAdmin
    .from("profiles")
    .update({
      plan: active ? plan : "free",
      stripe_subscription_id: sub.id,
    })
    .eq("id", userId);
}

async function downgradeToFree(userId: string) {
  await supabaseAdmin
    .from("profiles")
    .update({ plan: "free", stripe_subscription_id: null })
    .eq("id", userId);
}
