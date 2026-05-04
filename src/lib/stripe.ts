import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key ? new Stripe(key) : null;

export const stripeConfigured = Boolean(key);

export const PRICE_PRO = process.env.STRIPE_PRICE_PRO ?? "";
export const PRICE_FOUNDER = process.env.STRIPE_PRICE_FOUNDER ?? "";

export type PlanTier = "free" | "pro" | "founder";

export function priceIdToPlan(priceId: string | null | undefined): PlanTier {
  if (!priceId) return "free";
  if (priceId === PRICE_PRO) return "pro";
  if (priceId === PRICE_FOUNDER) return "founder";
  return "free";
}
