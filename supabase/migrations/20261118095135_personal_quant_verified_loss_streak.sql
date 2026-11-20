alter table public.mt5_account_snapshots
  add column if not exists consecutive_losses integer,
  add column if not exists loss_streak_verified boolean not null default false,
  add column if not exists history_synced_at timestamptz;

alter table public.mt5_account_snapshots
  drop constraint if exists mt5_account_snapshots_consecutive_losses_check;

alter table public.mt5_account_snapshots
  add constraint mt5_account_snapshots_consecutive_losses_check
  check (consecutive_losses is null or consecutive_losses between 0 and 10000);
