create table if not exists public.mt5_account_snapshots (
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  account_login bigint not null,
  broker text,
  server text,
  currency text not null,
  balance double precision not null check (balance >= 0),
  equity double precision not null check (equity > 0),
  margin double precision not null check (margin >= 0),
  free_margin double precision not null check (free_margin >= 0),
  margin_level double precision,
  open_positions integer not null check (open_positions >= 0),
  open_risk_cash double precision not null check (open_risk_cash >= 0),
  open_risk_verified boolean not null default false,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (installation_id, account_login)
);
create index if not exists mt5_account_snapshots_fresh_idx
  on public.mt5_account_snapshots(installation_id, account_login, captured_at desc);

create table if not exists public.mt5_risk_state (
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  account_login bigint not null,
  daily_anchor_date date not null,
  weekly_anchor_date date not null,
  daily_start_equity double precision not null check (daily_start_equity > 0),
  weekly_start_equity double precision not null check (weekly_start_equity > 0),
  high_water_mark_equity double precision not null check (high_water_mark_equity > 0),
  updated_at timestamptz not null default now(),
  primary key (installation_id, account_login)
);

create table if not exists public.mt5_risk_decisions (
  id bigint generated always as identity primary key,
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  account_login bigint not null,
  request_id text not null,
  symbol text not null,
  decision text not null check (decision in ('APPROVE','REJECT','ABSTAIN','DEGRADED')),
  approved_risk_pct double precision not null default 0,
  approved_volume double precision not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  unique (installation_id, request_id)
);

create or replace function public.update_mt5_risk_anchors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  utc_day date := (new.captured_at at time zone 'UTC')::date;
  utc_week date := date_trunc('week', new.captured_at at time zone 'UTC')::date;
begin
  insert into public.mt5_risk_state (
    installation_id, account_login, daily_anchor_date, weekly_anchor_date,
    daily_start_equity, weekly_start_equity, high_water_mark_equity, updated_at
  ) values (
    new.installation_id, new.account_login, utc_day, utc_week,
    new.equity, new.equity, new.equity, now()
  )
  on conflict (installation_id, account_login) do update set
    daily_start_equity = case
      when public.mt5_risk_state.daily_anchor_date <> excluded.daily_anchor_date then excluded.daily_start_equity
      else public.mt5_risk_state.daily_start_equity end,
    daily_anchor_date = excluded.daily_anchor_date,
    weekly_start_equity = case
      when public.mt5_risk_state.weekly_anchor_date <> excluded.weekly_anchor_date then excluded.weekly_start_equity
      else public.mt5_risk_state.weekly_start_equity end,
    weekly_anchor_date = excluded.weekly_anchor_date,
    high_water_mark_equity = greatest(public.mt5_risk_state.high_water_mark_equity, excluded.high_water_mark_equity),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists mt5_account_snapshot_risk_anchors on public.mt5_account_snapshots;
create trigger mt5_account_snapshot_risk_anchors
after insert or update of equity, captured_at on public.mt5_account_snapshots
for each row execute function public.update_mt5_risk_anchors();

alter table public.mt5_account_snapshots enable row level security;
alter table public.mt5_risk_state enable row level security;
alter table public.mt5_risk_decisions enable row level security;
revoke all on public.mt5_account_snapshots from anon, authenticated;
revoke all on public.mt5_risk_state from anon, authenticated;
revoke all on public.mt5_risk_decisions from anon, authenticated;
grant all on public.mt5_account_snapshots to service_role;
grant all on public.mt5_risk_state to service_role;
grant all on public.mt5_risk_decisions to service_role;
grant usage, select on sequence public.mt5_risk_decisions_id_seq to service_role;
