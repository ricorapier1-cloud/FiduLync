alter table public.mt5_market_quotes
  add column if not exists volume_min double precision,
  add column if not exists volume_max double precision,
  add column if not exists volume_step double precision,
  add column if not exists stop_level_points double precision,
  add column if not exists margin_per_lot_buy double precision,
  add column if not exists margin_per_lot_sell double precision;
