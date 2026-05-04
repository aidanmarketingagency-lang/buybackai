-- Email opt-out flag. One column, one timestamp. Set when a user clicks
-- the unsubscribe link in any transactional email; the email-sending
-- code skips users with a non-null value.
--
-- We don't carve out per-category preferences yet — first-party founder
-- product, mostly daily-cadence emails, granular prefs aren't needed.
-- If we later add weekly/monthly/etc. cadences, swap this for a jsonb
-- prefs column.

alter table public.profiles
  add column if not exists email_unsubscribed_at timestamptz;

-- Last-digest timestamp so the digest cron doesn't double-send within
-- the same morning if it re-runs.
alter table public.profiles
  add column if not exists last_digest_sent_at timestamptz;

-- Allow self-update of the unsub flag — the unsubscribe page hits the
-- service role, so this isn't required for that flow, but it lets future
-- per-user preference UI work without a server hop.
grant update (email_unsubscribed_at, last_digest_sent_at)
  on public.profiles to authenticated;
