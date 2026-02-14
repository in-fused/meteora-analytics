-- ═══════════════════════════════════════════════════════════════════════════
-- METEORA ANALYTICS — SUPABASE SCHEMA
-- Run this in the Supabase SQL Editor to create all tables
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. USER ALERTS
-- Persists price/metric alerts so they survive page reloads
create table if not exists user_alerts (
  id            text primary key,
  wallet_address text not null,
  pool_id       text not null,
  pool_name     text not null,
  metric        text not null check (metric in ('apr','tvl','volume','score','fees')),
  condition     text not null check (condition in ('above','below')),
  value         double precision not null,
  enabled       boolean not null default true,
  created_at    bigint not null
);

create index if not exists idx_user_alerts_wallet on user_alerts (wallet_address);

-- 2. TRIGGERED ALERTS
-- Audit log of alerts that fired, with the value at trigger time
create table if not exists triggered_alerts (
  id            text primary key default gen_random_uuid()::text,
  alert_id      text not null,
  wallet_address text not null,
  pool_id       text not null,
  pool_name     text not null,
  metric        text not null,
  condition     text not null,
  value         double precision not null,
  current_value double precision not null,
  triggered_at  bigint not null,
  read          boolean not null default false
);

create index if not exists idx_triggered_alerts_wallet on triggered_alerts (wallet_address);
create index if not exists idx_triggered_alerts_time on triggered_alerts (triggered_at desc);

-- 3. USER PREFERENCES
-- Filters, active tab, JupShield setting — one row per wallet
create table if not exists user_preferences (
  wallet_address text primary key,
  active_tab     text not null default 'opportunities',
  jupshield      boolean not null default true,
  min_tvl        double precision not null default 0,
  min_volume     double precision not null default 0,
  safe_only      boolean not null default false,
  farm_only      boolean not null default false,
  pool_type      text not null default 'all',
  sort_by        text not null default 'score',
  updated_at     timestamptz not null default now()
);

-- 4. POOL SNAPSHOTS
-- Historical pool data for trend charts (captured every refresh cycle)
create table if not exists pool_snapshots (
  id            bigint generated always as identity primary key,
  pool_address  text not null,
  pool_name     text not null,
  protocol      text not null,
  tvl           double precision not null,
  volume        double precision not null,
  apr           text not null,
  fees          double precision not null,
  score         double precision not null,
  captured_at   timestamptz not null default now()
);

create index if not exists idx_pool_snapshots_address on pool_snapshots (pool_address, captured_at desc);

-- Auto-cleanup: keep only 7 days of snapshots
-- Run this as a cron job or pg_cron extension:
-- select cron.schedule('cleanup-snapshots', '0 3 * * *',
--   $$delete from pool_snapshots where captured_at < now() - interval '7 days'$$);

-- 5. WALLET BALANCES
-- Balance time-series per wallet for sparkline charts
create table if not exists wallet_balances (
  id              bigint generated always as identity primary key,
  wallet_address  text not null,
  balance_sol     double precision not null,
  captured_at     timestamptz not null default now()
);

create index if not exists idx_wallet_balances_wallet on wallet_balances (wallet_address, captured_at desc);

-- 6. SESSION METRICS
-- Analytics events per session (replaces fragile localStorage)
create table if not exists session_metrics (
  id              bigint generated always as identity primary key,
  wallet_address  text,
  session_id      text not null,
  page_views      integer not null default 0,
  pool_clicks     integer not null default 0,
  execution_attempts integer not null default 0,
  events_json     jsonb not null default '[]'::jsonb,
  session_start   timestamptz not null default now(),
  session_end     timestamptz
);

create index if not exists idx_session_metrics_wallet on session_metrics (wallet_address);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Each user only sees their own data, keyed by wallet_address
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all user-scoped tables
alter table user_alerts enable row level security;
alter table triggered_alerts enable row level security;
alter table user_preferences enable row level security;
alter table wallet_balances enable row level security;
alter table session_metrics enable row level security;

-- Pool snapshots are global (read by everyone, written by server)
alter table pool_snapshots enable row level security;

-- Policies: allow all operations for anon/authenticated for now
-- (wallet_address filtering is done at the application level)
-- In production, replace these with JWT-based policies

create policy "Allow all on user_alerts" on user_alerts
  for all using (true) with check (true);

create policy "Allow all on triggered_alerts" on triggered_alerts
  for all using (true) with check (true);

create policy "Allow all on user_preferences" on user_preferences
  for all using (true) with check (true);

create policy "Allow all on wallet_balances" on wallet_balances
  for all using (true) with check (true);

create policy "Allow all on session_metrics" on session_metrics
  for all using (true) with check (true);

create policy "Allow all on pool_snapshots" on pool_snapshots
  for all using (true) with check (true);
