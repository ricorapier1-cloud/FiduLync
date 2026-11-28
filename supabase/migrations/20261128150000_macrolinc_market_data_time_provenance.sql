alter table public.macrolinc_market_quotes
  add column if not exists server_utc_offset_minutes smallint not null default 0,
  add column if not exists time_basis text not null default 'BROKER_SERVER_CURRENT_OFFSET';

alter table public.macrolinc_market_candles
  add column if not exists server_utc_offset_minutes smallint not null default 0,
  add column if not exists time_basis text not null default 'BROKER_SERVER_CURRENT_OFFSET';

alter table public.macrolinc_market_quotes
  add constraint macrolinc_market_quotes_offset_valid
  check (server_utc_offset_minutes between -840 and 840);

alter table public.macrolinc_market_candles
  add constraint macrolinc_market_candles_offset_valid
  check (server_utc_offset_minutes between -840 and 840);

alter table public.macrolinc_market_quotes
  add constraint macrolinc_market_quotes_time_basis_valid
  check (time_basis = 'BROKER_SERVER_CURRENT_OFFSET');

alter table public.macrolinc_market_candles
  add constraint macrolinc_market_candles_time_basis_valid
  check (time_basis = 'BROKER_SERVER_CURRENT_OFFSET');