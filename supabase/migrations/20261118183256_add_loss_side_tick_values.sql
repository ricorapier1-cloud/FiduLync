alter table public.mt5_market_quotes
  add column if not exists tick_value_loss double precision,
  add column if not exists tick_value_profit double precision;

comment on column public.mt5_market_quotes.tick_value_loss is
  'Broker-reported loss-side tick value per lot in account currency, supplied by the MT5 terminal.';
comment on column public.mt5_market_quotes.tick_value_profit is
  'Broker-reported profit-side tick value per lot in account currency, supplied by the MT5 terminal.';
