create extension if not exists pgcrypto;

create table if not exists public.mt5_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'MT5 terminal',
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  broker text,
  server text
);
create index if not exists mt5_installations_user_id_idx on public.mt5_installations(user_id, created_at desc);

create table if not exists public.mt5_market_candles (
  id bigint generated always as identity primary key,
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  symbol text not null,
  timeframe text not null check (timeframe in ('H1','H4','D1')),
  bar_time timestamptz not null,
  open double precision not null check (open > 0),
  high double precision not null check (high > 0),
  low double precision not null check (low > 0),
  close double precision not null check (close > 0),
  tick_volume bigint not null default 0 check (tick_volume >= 0),
  spread_points double precision not null default 0 check (spread_points >= 0),
  real_volume bigint not null default 0 check (real_volume >= 0),
  is_closed boolean not null default true,
  broker text,
  server text,
  digits integer,
  point double precision,
  tick_size double precision,
  tick_value double precision,
  contract_size double precision,
  received_at timestamptz not null default now(),
  constraint mt5_candle_ohlc_valid check (high >= low and open between low and high and close between low and high),
  constraint mt5_candle_unique unique (installation_id, symbol, timeframe, bar_time)
);
create index if not exists mt5_candles_lookup_idx on public.mt5_market_candles(installation_id, symbol, timeframe, bar_time desc);

create table if not exists public.mt5_market_quotes (
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  symbol text not null,
  bid double precision not null check (bid > 0),
  ask double precision not null check (ask >= bid),
  quote_time timestamptz not null,
  spread_points double precision not null check (spread_points >= 0),
  digits integer,
  point double precision,
  tick_size double precision,
  tick_value double precision,
  contract_size double precision,
  broker text,
  server text,
  received_at timestamptz not null default now(),
  primary key (installation_id, symbol)
);

create table if not exists public.mt5_ingest_nonces (
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  nonce uuid not null,
  created_at timestamptz not null default now(),
  primary key (installation_id, nonce)
);
create index if not exists mt5_ingest_nonces_created_at_idx on public.mt5_ingest_nonces(created_at);

alter table public.mt5_installations enable row level security;
alter table public.mt5_market_candles enable row level security;
alter table public.mt5_market_quotes enable row level security;
alter table public.mt5_ingest_nonces enable row level security;
revoke all on public.mt5_installations from anon, authenticated;
revoke all on public.mt5_market_candles from anon, authenticated;
revoke all on public.mt5_market_quotes from anon, authenticated;
revoke all on public.mt5_ingest_nonces from anon, authenticated;
grant all on public.mt5_installations to service_role;
grant all on public.mt5_market_candles to service_role;
grant all on public.mt5_market_quotes to service_role;
grant all on public.mt5_ingest_nonces to service_role;
grant usage, select on sequence public.mt5_market_candles_id_seq to service_role;
