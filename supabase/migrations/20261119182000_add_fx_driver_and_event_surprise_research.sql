create table if not exists public.macro_event_surprises (
 id uuid primary key default gen_random_uuid(),
 provider text not null,
 event_code text not null,
 currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
 scheduled_at timestamptz,
 released_at timestamptz not null,
 retrieved_at timestamptz not null,
 actual numeric,
 consensus numeric,
 previous numeric,
 revised_previous numeric,
 unit text,
 surprise_z numeric,
 source_url text,
 source_hash text not null unique check (source_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 constraint macro_event_release_retrieval_order check (retrieved_at >= released_at)
);
create index if not exists macro_event_surprise_currency_time_idx on public.macro_event_surprises(currency_code,released_at desc);
create table if not exists public.forex_driver_snapshots (
 id uuid primary key default gen_random_uuid(),
 pair text not null check (pair ~ '^[A-Z]{6}$'),
 as_of timestamptz not null,
 macro_score numeric not null check (macro_score between -100 and 100),
 technical_score numeric check (technical_score is null or technical_score between -100 and 100),
 combined_score numeric not null check (combined_score between -100 and 100),
 confidence numeric not null check (confidence between 0 and 1),
 evidence_coverage numeric not null check (evidence_coverage between 0 and 1),
 directional_agreement numeric not null check (directional_agreement between 0 and 1),
 setup text not null check (setup in ('LONG_BIAS','SHORT_BIAS','NO_SETUP')),
 dominant_drivers text[] not null default '{}',
 blockers text[] not null default '{}',
 excluded_inputs jsonb not null default '[]'::jsonb,
 source_manifest jsonb not null,
 methodology_version text not null,
 source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(pair,as_of,source_hash)
);
create index if not exists forex_driver_snapshots_pair_time_idx on public.forex_driver_snapshots(pair,as_of desc);
alter table public.macro_event_surprises enable row level security;
alter table public.forex_driver_snapshots enable row level security;
revoke all on table public.macro_event_surprises, public.forex_driver_snapshots from anon, authenticated;
grant all on table public.macro_event_surprises, public.forex_driver_snapshots to service_role;
comment on table public.macro_event_surprises is 'Point-in-time macro event actuals, consensus, revisions and robust surprise metrics.';
comment on table public.forex_driver_snapshots is 'Versioned evidence-weighted FX driver assessments. A bias is not execution permission.';
