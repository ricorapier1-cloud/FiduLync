create table if not exists public.mt5_open_position_snapshots (
  id bigint generated always as identity primary key,
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  account_login bigint not null,
  snapshot_id uuid not null,
  captured_at timestamptz not null,
  position_ticket bigint not null,
  position_identifier bigint,
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  volume double precision not null check (volume > 0),
  price_open double precision not null check (price_open > 0),
  stop_loss double precision,
  take_profit double precision,
  profit_account_currency double precision,
  contract_size double precision,
  tick_size double precision,
  tick_value_loss double precision,
  quote_currency text,
  base_currency text,
  snapshot_complete boolean not null default false,
  received_at timestamptz not null default now(),
  unique (installation_id, account_login, snapshot_id, position_ticket)
);
create index if not exists mt5_open_positions_latest_idx
  on public.mt5_open_position_snapshots(installation_id, account_login, captured_at desc);
create index if not exists mt5_open_positions_symbol_idx
  on public.mt5_open_position_snapshots(installation_id, account_login, symbol, captured_at desc);

create table if not exists public.quant_model_registry (
  id bigint generated always as identity primary key,
  model_key text not null,
  model_version text not null,
  market_scope text[] not null default '{}',
  timeframe_scope text[] not null default '{}',
  status text not null default 'PENDING'
    check (status in ('PENDING','IN_REVIEW','APPROVED','REJECTED','RETIRED')),
  dataset_fingerprint text,
  code_fingerprint text,
  evidence jsonb not null default '{}'::jsonb,
  validation_metrics jsonb not null default '{}'::jsonb,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_key, model_version),
  check (status <> 'APPROVED' or (
    dataset_fingerprint is not null and code_fingerprint is not null
    and reviewer_id is not null and reviewed_at is not null
    and jsonb_typeof(evidence) = 'object'
    and jsonb_typeof(validation_metrics) = 'object'
  ))
);
create index if not exists quant_model_registry_status_idx
  on public.quant_model_registry(status, updated_at desc);

create table if not exists public.mt5_execution_quality_events (
  id bigint generated always as identity primary key,
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  account_login bigint not null,
  event_id text not null,
  event_type text not null check (event_type in ('ORDER_REQUEST','FILL','REJECT','CANCEL','REQUOTE','DEAL_CLOSE')),
  symbol text not null,
  side text check (side in ('BUY','SELL')),
  requested_price double precision,
  fill_price double precision,
  volume double precision check (volume is null or volume > 0),
  spread_points double precision check (spread_points is null or spread_points >= 0),
  slippage_points double precision,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  broker_code text,
  event_time timestamptz not null,
  received_at timestamptz not null default now(),
  evidence_hash text,
  unique (installation_id, event_id)
);
create index if not exists mt5_execution_quality_window_idx
  on public.mt5_execution_quality_events(installation_id, account_login, event_time desc);

alter table public.mt5_open_position_snapshots enable row level security;
alter table public.quant_model_registry enable row level security;
alter table public.mt5_execution_quality_events enable row level security;
revoke all on public.mt5_open_position_snapshots from anon, authenticated;
revoke all on public.quant_model_registry from anon, authenticated;
revoke all on public.mt5_execution_quality_events from anon, authenticated;
grant select, insert on public.mt5_open_position_snapshots to service_role;
grant usage, select on sequence public.mt5_open_position_snapshots_id_seq to service_role;
grant select, insert, update on public.quant_model_registry to service_role;
grant usage, select on sequence public.quant_model_registry_id_seq to service_role;
grant select, insert on public.mt5_execution_quality_events to service_role;
grant usage, select on sequence public.mt5_execution_quality_events_id_seq to service_role;

create or replace function public.prevent_execution_quality_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'execution quality evidence is append-only' using errcode = '55000';
end;
$$;
drop trigger if exists mt5_execution_quality_append_only on public.mt5_execution_quality_events;
create trigger mt5_execution_quality_append_only
before update or delete on public.mt5_execution_quality_events
for each row execute function public.prevent_execution_quality_mutation();
revoke update, delete, truncate on public.mt5_execution_quality_events from service_role, anon, authenticated;
