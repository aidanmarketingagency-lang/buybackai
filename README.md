# BuybackAI

> A marketplace of focused AI agents you hire to take $20-an-hour work off your plate.

**Live:** [buybackai.vercel.app](https://buybackai.vercel.app) · **Status:** v0.1 beta · invite-only

---

## What this is

Most founders aren't starved for tools. They're drowning in $20-an-hour work wearing a CEO's hat.

BuybackAI runs a 2-minute audit on your Gmail and Calendar, prices your week at your hourly rate, and shows you — in dollars — exactly what hours an AI agent could've handled. Then you hire one of the agents in the marketplace and it starts working that hour.

Three agents at launch:

| Agent | Job | Price |
|---|---|---|
| **Inbox Ivy** | Triages email by urgency, drafts replies in your voice | included in Pro |
| **Meeting Marv** | One-page brief 5 min before any call: who, what, three things to raise | included in Pro |
| **Follow-up Fred** | Watches sent threads, drafts a nudge when they go quiet | included in Pro |

Read-only Gmail and Calendar scopes. Nothing is sent without you approving each draft.

## Pricing

- **Free** — run the audit, hire 1 agent, forever.
- **Pro $49/mo** — all 3 agents, up to 5 active.
- **Founder $149/mo** — unlimited agents, custom agent requests, founder Slack.

See [/pricing](https://buybackai.vercel.app/pricing) for the live page.

## Stack

- **App** — Next.js 16 (App Router) + React 19 + Tailwind v4
- **Auth + DB** — Supabase (Postgres + RLS + Auth)
- **AI** — Anthropic Claude (Haiku 4.5 for triage/briefs, Sonnet for audits)
- **Integrations** — Google Gmail + Calendar APIs (read-only)
- **Billing** — Stripe Checkout + Customer Portal + signed webhooks
- **Email** — Resend (transactional)
- **Hosting** — Vercel (with Cron for agents and email digest)

Crons:

| Path | Cadence | Job |
|---|---|---|
| `/api/cron/triage-email` | every 15m | Inbox Ivy — triage new mail |
| `/api/cron/meeting-prep` | hourly | Meeting Marv — brief upcoming meetings |
| `/api/cron/follow-up` | every 6h | Follow-up Fred — draft nudges |
| `/api/cron/email-digest` | daily, 13:30 UTC | Email summary of pending actions |

## Local development

Requires Node 20+, a Supabase project, and Anthropic + Google OAuth credentials.

```bash
git clone https://github.com/aidanmarketingagency-lang/buybackai.git
cd buybackai
npm install
cp .env.local.example .env.local   # fill in keys
npm run dev
```

App boots at `http://localhost:3000`.

### Required env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CRON_SECRET                       # any random string; required by Vercel cron auth
NEXT_PUBLIC_APP_URL               # e.g. http://localhost:3000 in dev
```

### Optional — turn on billing

See [docs/SETUP-BILLING.md](docs/SETUP-BILLING.md). Without these vars, `/api/billing/*` returns `503 billing_not_configured` and the rest of the app keeps working.

```
STRIPE_SECRET_KEY
STRIPE_PRICE_PRO
STRIPE_PRICE_FOUNDER
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

### Optional — turn on transactional email

See [docs/SETUP-EMAIL.md](docs/SETUP-EMAIL.md).

```
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_REPLY_TO
EMAIL_UNSUB_SECRET                # signs unsubscribe tokens — never rotate after going live
```

## Repo layout

```
src/
  app/
    page.tsx                  # marketing landing
    pricing/                  # /pricing
    auth/                     # signup, login, callback
    onboarding/               # master-prompt generator
    audit/                    # the 2-minute audit
    dashboard/                # actions inbox + agents
    agents/                   # agents marketplace
    unsubscribe/              # email opt-out (HMAC token)
    api/
      audit/                  # POST = run audit, sends "ready" email
      agents/deploy           # deploy an agent (RPC w/ plan limits)
      agents/actions/[id]     # approve / dismiss action
      billing/                # checkout, portal, webhook
      cron/                   # 4 crons (see above)
      onboarding/             # master prompt generation, onboarding finalize
  lib/
    agents/                   # inbox-ivy, meeting-marv, follow-up-fred
    google/                   # auth, gmail, calendar, sent-threads
    email/                    # resend client + templates
    supabase/                 # client / server / admin
    stripe.ts                 # configured-or-null Stripe SDK
  components/
    motion.tsx                # Reveal / Stagger / StaggerItem primitives
    AnimatedCounter.tsx
    OrbField.tsx              # background 3D orbs (landing only)
    UpgradeButton.tsx
    BillingPortalButton.tsx
supabase/
  schema.sql                  # full schema + RPCs (deploy_agent, start_audit, bump_agent_stats)
  migrations/                 # forward migrations only
docs/
  MOTION-SPEC.md              # design system motion bible
  SETUP-BILLING.md            # wire Stripe in 10 min
  SETUP-EMAIL.md              # wire Resend in 5 min
outreach/                     # cold email + LinkedIn + X scripts (build in public)
```

## Design

The whole product follows a single motion design system documented in [docs/MOTION-SPEC.md](docs/MOTION-SPEC.md). The product sells "buying back time" — so motion is calm, deliberate, never frantic. CSS tokens in `globals.css` and Framer Motion primitives in `components/motion.tsx` share the same easing/duration/stagger values; reduced motion is a first-class state.

## Security

- Google OAuth tokens stored in a service-role-only `user_secrets` table — RLS denies all `authenticated` access.
- Sensitive profile fields (`plan`, `stripe_*`, `master_prompt`) are column-level revoked from the `authenticated` role; only the service role can write them.
- Agent deploy and audit start go through Postgres RPCs that lock the user row, enforce plan/quota limits, and insert in a single transaction — race-condition-safe.
- Stripe webhooks verify signatures with the `STRIPE_WEBHOOK_SECRET`.
- Cron endpoints accept only `Authorization: Bearer <CRON_SECRET>`.
- Unsubscribe tokens are HMAC-SHA256 signed, timing-safe verified.
- Inbox-Ivy + Meeting-Marv prompts treat email/calendar bodies as untrusted input and refuse embedded prompt-injection attempts.

If you find a security issue, please email aidanmarketingagency@gmail.com rather than opening a public issue.

## Status / roadmap

This is a real product. It's small on purpose. Next on the list:

- [ ] Custom domain
- [ ] Resend transactional emails (code shipped, awaiting `RESEND_API_KEY`)
- [ ] Recap Rita, Recon Rex, Repurpose Ren agents (UI exists, agent code TBD)
- [ ] Slack + GoHighLevel integrations
- [ ] Per-agent custom configuration UI

## License

MIT — see [LICENSE](LICENSE).

## Built by

[Aidan](mailto:aidanmarketingagency@gmail.com), solo. Inspired by Dan Martell's *Buy Back Your Time*. Not affiliated with Dan Martell.
