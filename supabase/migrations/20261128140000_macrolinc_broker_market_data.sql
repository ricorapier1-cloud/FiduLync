create table if not exists public.macrolinc_market_quotes (
  account_key text not null references public.macrolinc_account_snapshots(account_key) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z]{6}$'),
  bid double precision not null check (bid > 0),
  ask double precision not null check (ask >= bid),
  quote_time timestamptz not null,
  spread_points double precision not null check (spread_points >= 0),
  digits integer not null check (digits between 0 and 12),
  point double precision not null check (point > 0),
  broker text,
  server text not null,
  received_at timestamptz not null default now(),
  primary key (account_key, symbol)
);

create table if not exists public.macrolinc_market_candles (
  id bigint generated always as identity primary key,
  account_key text not null references public.macrolinc_account_snapshots(account_key) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z]{6}$'),
  timeframe text not null check (timeframe in ('M5', 'D1')),
  bar_time timestamptz not null,
  open double precision not null check (open > 0),
  high double precision not null check (high > 0),
  low double precision not null check (low > 0),
  close double precision not null check (close > 0),
  tick_volume bigint not null default 0 check (tick_volume >= 0),
  spread_points double precision not null default 0 check (spread_points >= 0),
  real_volume bigint not null default 0 check (real_volume >= 0),
  is_closed boolean not null default true check (is_closed),
  digits integer not null check (digits between 0 and 12),
  point double precision not null check (point > 0),
  received_at timestamptz not null default now(),
  constraint macrolinc_market_candle_ohlc_valid check (
    high >= low and open between low and high and close between low and high
  ),
  constraint macrolinc_market_candle_unique unique (account_key, symbol, timeframe, bar_time)
);

create index if not exists macrolinc_market_candles_lookup_idx
  on public.macrolinc_market_candles(account_key, symbol, timeframe, bar_time desc);
create index if not exists macrolinc_market_quotes_received_idx
  on public.macrolinc_market_quotes(account_key, received_at desc);

alter table public.macrolinc_market_quotes enable row level security;
alter table public.macrolinc_market_candles enable row level security;
revoke all on public.macrolinc_market_quotes from anon, authenticated;
revoke all on public.macrolinc_market_candles from anon, authenticated;
grant all on public.macrolinc_market_quotes to service_role;
grant all on public.macrolinc_market_candles to service_role;
grant usage, select on sequence public.macrolinc_market_candles_id_seq to service_role;
