# Resend transactional emails — finish setup

Code is wired. To turn it on, you need a Resend account, an API key, and (recommended) a verified sender domain.

## 1. Create a Resend account
https://resend.com/signup → free tier covers 3,000 emails/mo and 100/day, plenty for early users.

## 2. (Recommended) Verify your domain
Without a domain, emails come from `onboarding@resend.dev` and go to spam more often.

If you own a domain (or buy one — Namecheap, ~$10/yr):
1. Resend Dashboard → **Domains** → **+ Add Domain**
2. Enter `buybackai.com` (or your domain)
3. Resend gives you 3 DNS records (TXT/MX/SPF/DKIM)
4. Paste them into your DNS provider (Vercel handles this if domain is on Vercel)
5. Click **Verify** in Resend after DNS propagates (5–20 min)

## 3. Get an API key
Resend Dashboard → **API Keys** → **+ Create API Key** → name it `buybackai-prod` → **full access** → copy `re_...`.

## 4. Add env vars to Vercel
```
RESEND_API_KEY        = re_...
RESEND_FROM_EMAIL     = BuybackAI <notify@buybackai.com>     (or any email at your verified domain)
RESEND_REPLY_TO       = aidanmarketingagency@gmail.com        (where user replies land)
EMAIL_UNSUB_SECRET    = <random 32+ char string>              (signs unsubscribe tokens)
```

For the `EMAIL_UNSUB_SECRET`, generate one with:
```bash
openssl rand -hex 32
```
Or use any random string — once set, **never change it** (existing unsubscribe links would break).

If you skip `RESEND_FROM_EMAIL`, emails ship from `onboarding@resend.dev`. Works, but not on-brand.

## 5. Redeploy
Env vars only apply on new builds. From local repo:
```
vercel --prod
```

## What gets sent

| Trigger | Email | Cadence |
|---|---|---|
| User completes audit | "Your audit: $X recoverable / wk" | Once per audit |
| User has pending agent actions | Daily digest with up to 8 items | At most once per 18h, 13:30 UTC cron |

Both are skipped for users with `email_unsubscribed_at` set (i.e., users who clicked the unsubscribe link in any prior email).

## Test it

1. Sign in with your own account.
2. Run an audit at https://buybackai.vercel.app/audit
3. Within 30s, the audit-ready email should land in your inbox (check spam if no domain verified).
4. To test the digest manually, hit:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://buybackai.vercel.app/api/cron/email-digest
   ```
   (Returns JSON with `digested`, `skipped`, `errors`.)

## Troubleshooting

- **Email never arrives**: Resend Dashboard → **Logs** → look for the most recent send. If status is "delivered" it's in spam; if "bounced" the recipient address is wrong; if no row at all, the API key isn't set in Vercel (or wasn't picked up — redeploy).
- **`resend_not_configured` in logs**: `RESEND_API_KEY` isn't set in production env. Add it and redeploy.
- **Unsubscribe link invalid**: `EMAIL_UNSUB_SECRET` was changed after sending the email. Use the same secret across deploys.
