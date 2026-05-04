-- BuybackAI Database Schema

-- Profiles (extends Supabase auth.users) — client-readable.
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  hourly_rate integer not null default 250,
  plan text not null default 'free' check (plan in ('free', 'pro', 'founder')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  master_prompt text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Server-only secrets (Google OAuth tokens). No RLS policies for anon or
-- authenticated, so only service_role can read or write.
create table public.user_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_access_token text,
  google_refresh_token text,
  updated_at timestamptz not null default now()
);
alter table public.user_secrets enable row level security;
revoke all on public.user_secrets from authenticated;
revoke all on public.user_secrets from anon;

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Column-level lockdown: even with the broad RLS update policy above, users
-- can ONLY write to these specific columns. Fields like plan, stripe_*, and
-- google_* must be written via the service role.
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;
grant update (full_name, avatar_url, hourly_rate, master_prompt, onboarding_complete)
  on public.profiles to authenticated;

-- Audits
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  time_thieves jsonb not null default '[]',
  total_hours_wasted numeric not null default 0,
  total_dollar_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.audits enable row level security;
create policy "Users can view own audits" on public.audits for select using (auth.uid() = user_id);
-- Inserts/updates only via /api/audit (service role). No client write paths.
revoke insert, update, delete on public.audits from authenticated;
revoke insert, update, delete on public.audits from anon;

-- Agents
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  name text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'paused', 'stopped')),
  tasks_completed integer not null default 0,
  hours_saved numeric not null default 0,
  last_run_at timestamptz,
  -- Cursor for paging backwards through truncated Gmail windows. Set when a
  -- run was truncated; the next run uses it as a `before:` ceiling so it
  -- pulls strictly older messages. Null = window fully drained.
  oldest_unhandled_at timestamptz,
  -- Surfaces silent persistence failures from the cron (RPC error, etc.).
  last_error text,
  last_error_at timestamptz,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;
create policy "Users can view own agents" on public.agents for select using (auth.uid() = user_id);
-- Deploy / pause / cancel only via /api/agents/* (service role). Plan limits
-- and counter writes must be authoritative server-side.
revoke insert, update, delete on public.agents from authenticated;
revoke insert, update, delete on public.agents from anon;

-- Agent Actions (items in the AI Inbox)
create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  summary text not null,
  content jsonb not null default '{}',
  -- 'processing' is an intermediate state used by the approval handler to
  -- atomically claim an action before performing the (non-idempotent) Gmail
  -- draft side effect. Without it, two concurrent PATCHes both pass the
  -- pending_review check and both create drafts.
  status text not null default 'pending_review' check (status in ('pending_review', 'processing', 'approved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.agent_actions enable row level security;
create policy "Users can view own actions" on public.agent_actions for select using (auth.uid() = user_id);
-- Inserts come from the cron (service role). Approve/dismiss flows through
-- /api/agents/actions/[id] (also service role, scoped by user_id check).
revoke insert, update, delete on public.agent_actions from authenticated;
revoke insert, update, delete on public.agent_actions from anon;

-- Per-agent dedup of gmail messages — prevents the cron from inserting the
-- same email twice if a previous run partially failed and got retried.
alter table public.agent_actions
  add column gmail_message_id text generated always as (content->>'gmail_id') stored;
create unique index agent_actions_gmail_dedup
  on public.agent_actions (agent_id, gmail_message_id)
  where gmail_message_id is not null;

-- One active agent per type per user. Without this a quota check race or
-- a direct RPC could create duplicate Inbox Ivys, all triaging the same
-- inbox in parallel and burning Anthropic dollars.
create unique index agents_unique_active_per_type
  on public.agents (user_id, type)
  where status = 'active';

-- Atomic deploy: locks the caller's profile row, checks plan limit, inserts
-- the agent in one transaction. Concurrent deploys for the same user
-- serialize behind the lock so plan limits cannot be racing-bypassed.
create or replace function public.deploy_agent(p_type text, p_name text)
returns public.agents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan text;
  v_count int;
  v_limit int;
  v_agent public.agents;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select plan into v_plan
  from public.profiles
  where id = v_user_id
  for update;

  if v_plan is null then
    raise exception 'profile_missing' using errcode = 'P0001';
  end if;

  v_limit := case v_plan
    when 'free' then 1
    when 'pro' then 5
    when 'founder' then 999
    else 1
  end;

  select count(*) into v_count
  from public.agents
  where user_id = v_user_id and status = 'active';

  if v_count >= v_limit then
    raise exception 'plan_limit_reached: % of %', v_count, v_limit
      using errcode = 'P0002';
  end if;

  insert into public.agents (
    user_id, type, name, description, status, tasks_completed, hours_saved, config
  ) values (
    v_user_id, p_type, p_name,
    format('AI agent handling %s tasks', p_name),
    'active', 0, 0, '{}'::jsonb
  )
  returning * into v_agent;

  return v_agent;
end;
$$;
revoke all on function public.deploy_agent(text, text) from public;
-- Supabase ships default GRANTs to anon+authenticated on public functions,
-- so REVOKE FROM PUBLIC isn't enough. Strip anon explicitly.
revoke execute on function public.deploy_agent(text, text) from anon;
grant execute on function public.deploy_agent(text, text) to authenticated;

-- Atomic stat increments — used by the triage cron. Read-then-write of the
-- counter would lose updates under concurrent cron invocations.
create or replace function public.bump_agent_stats(
  p_agent_id uuid,
  p_tasks_delta int,
  p_hours_delta numeric,
  p_last_run_at timestamptz
)
returns public.agents
language sql
security definer
set search_path = public
as $$
  update public.agents
  set
    tasks_completed = tasks_completed + p_tasks_delta,
    hours_saved = hours_saved + p_hours_delta,
    last_run_at = p_last_run_at
  where id = p_agent_id
  returning *;
$$;
revoke all on function public.bump_agent_stats(uuid, int, numeric, timestamptz) from public;
-- Strip Supabase's default anon+authenticated grants. Cron only.
revoke execute on function public.bump_agent_stats(uuid, int, numeric, timestamptz) from anon;
revoke execute on function public.bump_agent_stats(uuid, int, numeric, timestamptz) from authenticated;
grant execute on function public.bump_agent_stats(uuid, int, numeric, timestamptz) to service_role;

-- Atomic audit start: in-flight check + daily quota + insert under a single
-- per-user FOR UPDATE lock. Concurrent POSTs to /api/audit serialize so two
-- requests can't both pass the quota check and double-spend Gmail/Anthropic.
create or replace function public.start_audit()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan text;
  v_inflight_id uuid;
  v_recent_count int;
  v_limit int;
  v_audit_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select plan into v_plan from public.profiles where id = v_user_id for update;
  if v_plan is null then raise exception 'profile_missing' using errcode = 'P0001'; end if;

  select id into v_inflight_id
  from public.audits
  where user_id = v_user_id and status = 'running'
    and created_at >= now() - interval '5 minutes'
  order by created_at desc limit 1;
  if v_inflight_id is not null then
    raise exception 'audit_in_progress: %', v_inflight_id using errcode = 'P0003';
  end if;

  v_limit := case v_plan when 'pro' then 20 when 'founder' then 100 else 3 end;
  select count(*) into v_recent_count
  from public.audits
  where user_id = v_user_id and created_at >= now() - interval '24 hours';
  if v_recent_count >= v_limit then
    raise exception 'rate_limit: %/%', v_recent_count, v_limit using errcode = 'P0004';
  end if;

  insert into public.audits (user_id, status, time_thieves, total_hours_wasted, total_dollar_cost)
  values (v_user_id, 'running', '[]'::jsonb, 0, 0)
  returning id into v_audit_id;
  return v_audit_id;
end;
$$;
revoke all on function public.start_audit() from public;
revoke execute on function public.start_audit() from anon;
grant execute on function public.start_audit() to authenticated;

-- Auto-update updated_at on profiles
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
