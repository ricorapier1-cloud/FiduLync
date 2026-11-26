create table if not exists public.macro_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(provider) between 1 and 80),
  series_id text not null check (length(series_id) between 1 and 160),
  region_code text not null check (length(region_code) between 2 and 12),
  observation_period date not null,
  value numeric not null,
  unit text,
  observation_at timestamptz not null,
  released_at timestamptz not null,
  retrieved_at timestamptz not null default now(),
  vintage_at timestamptz,
  revision_at timestamptz,
  source_url text,
  source_hash text check (source_hash is null or source_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint macro_observation_release_order check (observation_at <= released_at),
  constraint macro_observation_retrieval_order check (retrieved_at >= released_at),
  constraint macro_observation_vintage_order check (vintage_at is null or vintage_at >= released_at)
);
create index if not exists macro_observations_point_in_time_idx on public.macro_observations (series_id, released_at desc, vintage_at desc);
create index if not exists macro_observations_period_idx on public.macro_observations (region_code, observation_period desc);

create table if not exists public.feed_health_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  feed_name text not null,
  state text not null check (state in ('HEALTHY','DEGRADED','STALE','CIRCUIT_OPEN','UNAVAILABLE')),
  observed_at timestamptz,
  checked_at timestamptz not null default now(),
  age_ms bigint check (age_ms is null or age_ms >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists feed_health_latest_idx on public.feed_health_events (provider, feed_name, checked_at desc);

create table if not exists public.cross_asset_snapshots (
  id uuid primary key default gen_random_uuid(),
  as_of timestamptz not null,
  universe text[] not null,
  window_label text not null,
  method text not null,
  correlations jsonb not null default '{}'::jsonb,
  regression_spreads jsonb not null default '{}'::jsonb,
  currency_strength jsonb not null default '{}'::jsonb,
  cot_positioning jsonb not null default '{}'::jsonb,
  source_manifest jsonb not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists cross_asset_asof_idx on public.cross_asset_snapshots (as_of desc);

create table if not exists public.research_hypotheses (
  id uuid primary key default gen_random_uuid(),
  hypothesis_key text not null unique,
  title text not null check (length(title) between 3 and 180),
  thesis text not null,
  instruments text[] not null default '{}',
  timeframes text[] not null default '{}',
  features jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  null_hypothesis text,
  falsification_criteria jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','TESTING','REJECTED','SUPPORTED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_hypotheses_status_idx on public.research_hypotheses (status, updated_at desc);

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid references public.research_hypotheses(id) on delete restrict,
  run_key text not null unique,
  dataset_fingerprint text not null check (dataset_fingerprint ~ '^[a-f0-9]{64}$'),
  code_fingerprint text not null check (code_fingerprint ~ '^[a-f0-9]{64}$'),
  source_manifest jsonb not null,
  parameters jsonb not null,
  in_sample_start timestamptz not null,
  in_sample_end timestamptz not null,
  validation_start timestamptz,
  validation_end timestamptz,
  out_of_sample_start timestamptz,
  out_of_sample_end timestamptz,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','COMPLETED','FAILED','INVALIDATED')),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint research_run_period_order check (in_sample_start < in_sample_end),
  constraint research_run_validation_order check (validation_start is null or validation_end is not null and validation_start < validation_end),
  constraint research_run_oos_order check (out_of_sample_start is null or out_of_sample_end is not null and out_of_sample_start < out_of_sample_end)
);
create index if not exists research_runs_hypothesis_idx on public.research_runs (hypothesis_id, created_at desc);
create index if not exists research_runs_dataset_idx on public.research_runs (dataset_fingerprint, code_fingerprint);

create table if not exists public.validation_reports (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.research_runs(id) on delete restrict,
  report_type text not null check (report_type in ('OOS','WFA','MONTE_CARLO','COST_STRESS','PARAMETER_STABILITY')),
  evidence jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  blockers text[] not null default '{}',
  eligible_for_review boolean not null default false,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now()
);
create index if not exists validation_reports_run_idx on public.validation_reports (research_run_id, created_at desc);

comment on table public.macro_observations is 'Point-in-time macro observations. Release and retrieval timestamps are retained to prevent look-ahead bias.';
comment on table public.feed_health_events is 'Append-only upstream feed health, staleness and circuit-breaker observations.';
comment on table public.cross_asset_snapshots is 'Versioned cross-asset correlation, currency strength, COT and regression-spread snapshots with source manifests.';
comment on table public.research_hypotheses is 'Owner-only quantitative hypothesis registry; no public strategy marketplace.';
comment on table public.research_runs is 'Reproducible hypothesis runs keyed by immutable dataset and code fingerprints.';
comment on table public.validation_reports is 'OOS, walk-forward, Monte Carlo and execution-cost validation evidence. Reports are not broker execution authorization.';

do $$
declare t text;
begin
  foreach t in array array['macro_observations','feed_health_events','cross_asset_snapshots','research_hypotheses','research_runs','validation_reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;
