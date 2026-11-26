-- Private, read-only MT5 account intelligence. No broker credentials are stored.
create table if not exists public.macrolinc_account_snapshots (
  account_key text primary key check (length(account_key) = 64),
  account_login text not null,
  broker text,
  server text not null,
  currency text not null,
  leverage integer not null check (leverage > 0),
  account_mode text not null check (account_mode in ('REAL','DEMO','CONTEST','UNKNOWN')),
  balance numeric(24,8) not null,
  equity numeric(24,8) not null,
  margin numeric(24,8) not null,
  free_margin numeric(24,8) not null,
  margin_level numeric(24,8),
  positions jsonb not null default '[]'::jsonb check (jsonb_typeof(positions) = 'array'),
  observed_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists macrolinc_account_snapshots_received_idx
  on public.macrolinc_account_snapshots (received_at desc);

create table if not exists public.macrolinc_account_deals (
  account_key text not null references public.macrolinc_account_snapshots(account_key) on delete cascade,
  deal_ticket text not null,
  order_ticket text,
  position_id text,
  symbol text not null,
  side text not null check (side in ('BUY','SELL','BALANCE','CREDIT','CHARGE','CORRECTION','BONUS','OTHER')),
  entry_type text not null check (entry_type in ('IN','OUT','INOUT','OUT_BY','OTHER')),
  volume numeric(24,8) not null default 0 check (volume >= 0),
  price numeric(24,10) not null default 0,
  profit numeric(24,8) not null default 0,
  commission numeric(24,8) not null default 0,
  swap numeric(24,8) not null default 0,
  fee numeric(24,8) not null default 0,
  deal_time_server text not null,
  magic text,
  comment text,
  received_at timestamptz not null default now(),
  primary key (account_key, deal_ticket)
);

create index if not exists macrolinc_account_deals_history_idx
  on public.macrolinc_account_deals (account_key, deal_time_server desc);

alter table public.macrolinc_account_snapshots enable row level security;
alter table public.macrolinc_account_deals enable row level security;
revoke all on public.macrolinc_account_snapshots from anon, authenticated;
revoke all on public.macrolinc_account_deals from anon, authenticated;
grant all on public.macrolinc_account_snapshots to service_role;
grant all on public.macrolinc_account_deals to service_role;
