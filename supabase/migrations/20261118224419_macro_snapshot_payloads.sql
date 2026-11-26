-- Store the complete, provenance-tagged macro snapshot separately from the
-- existing compact owner-dashboard summary table.
create table if not exists public.macro_snapshot_payloads (
  snapshot_key text primary key check (snapshot_key = 'global'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  refreshed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.macro_snapshot_payloads enable row level security;
revoke all on table public.macro_snapshot_payloads from anon, authenticated, service_role;
grant select, insert, update on table public.macro_snapshot_payloads to service_role;
revoke delete, truncate, references, trigger on table public.macro_snapshot_payloads from anon, authenticated, service_role;
