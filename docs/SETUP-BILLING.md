# Stripe billing — finish the setup

The code is wired. To turn it on you need to fill three env vars in Vercel and create one webhook in the Stripe dashboard. Total: ~10 minutes.

## 1. Create products and prices in Stripe

Stripe dashboard → **Products** → **Add product**.

Create two products. Pricing is up to you — this is what the code expects:

- **BuybackAI Pro** — $49/month, recurring subscription
- **BuybackAI Founder** — $149/month, recurring subscription

After creating each, copy the **Price ID** (starts with `price_...`) — not the product ID.

## 2. Add env vars to Vercel

Vercel project → Settings → Environment Variables. Add for **Production**:

```
STRIPE_SECRET_KEY      = sk_live_...   (Stripe → Developers → API keys)
STRIPE_PRICE_PRO       = price_...     (Pro price id from step 1)
STRIPE_PRICE_FOUNDER   = price_...     (Founder price id from step 1)
STRIPE_WEBHOOK_SECRET  = whsec_...     (filled in after step 3)
```

For local dev, add the same to `.env.local` with `sk_test_...` test keys.

## 3. Create the webhook in Stripe

Stripe dashboard → **Developers** → **Webhooks** → **Add endpoint**.

- URL: `https://buybackai.vercel.app/api/billing/webhook`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the **Signing secret** (starts with `whsec_...`) and paste it as `STRIPE_WEBHOOK_SECRET` in Vercel. Redeploy.

## 4. Test it

1. Sign in to the app.
2. Hit `/api/billing/checkout` from the dashboard's upgrade button (POST with `{"plan": "pro"}`).
3. Pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. After redirect, the user's `profiles.plan` should flip to `pro`. Verify in Supabase.
5. Cancel in the customer portal (`/api/billing/portal`) → `plan` flips back to `free`.

## Plan limits — already enforced server-side

`public.deploy_agent` (Postgres function) reads the user's plan and rejects deploy attempts that exceed:

| plan | active agents allowed |
|------|-----------------------|
| free | 1 |
| pro | 5 |
| founder | 999 |

So once Stripe is wired, `free` users hit the wall at the second deploy and the upgrade button takes them to checkout. No frontend gating needed.

## When Stripe is NOT configured

The checkout / portal endpoints return 503 `billing_not_configured` and the rest of the app keeps working — useful for local dev without Stripe keys.
