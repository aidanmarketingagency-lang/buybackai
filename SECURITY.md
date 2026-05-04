# Security Policy

## Reporting a vulnerability

If you find a security issue in BuybackAI, **please do not open a public issue.** Email **aidanmarketingagency@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- The impact you'd expect

You'll get a response within 48 hours. Confirmed issues get fixed, credited (if you want), and disclosed publicly once a fix is live.

## In scope

- The web app at https://buybackai.vercel.app and any preview deploys
- Server-side API routes under `src/app/api/`
- The Postgres schema and RPCs in `supabase/`

## Out of scope

- Third-party services (Supabase, Vercel, Stripe, Anthropic, Google, Resend) — report to them directly
- Social-engineering of the founder
- Denial-of-service / volumetric attacks
- Issues in dependencies that have a public CVE without exploit affecting BuybackAI specifically
