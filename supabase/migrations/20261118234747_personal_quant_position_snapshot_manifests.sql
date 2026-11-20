create table if not exists public.mt5_position_snapshot_manifests (
  id bigint generated always as identity primary key,
  installation_id uuid not null references public.mt5_installations(id) on delete cascade,
  account_login bigint not null,
  snapshot_id uuid not null,
  captured_at timestamptz not null,
  expected_positions integer not null check (expected_positions >= 0 and expected_positions <= 500),
  complete boolean not null default false,
  received_at timestamptz not null default now(),
  unique (installation_id, account_login, snapshot_id)
);
create index if not exists mt5_position_manifests_latest_idx
  on public.mt5_position_snapshot_manifests(installation_id, account_login, captured_at desc);
alter table public.mt5_position_snapshot_manifests enable row level security;
revoke all on public.mt5_position_snapshot_manifests from anon, authenticated;
grant select, insert on public.mt5_position_snapshot_manifests to service_role;
grant usage, select on sequence public.mt5_position_snapshot_manifests_id_seq to service_role;
