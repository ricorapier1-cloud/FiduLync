alter table public.mt5_risk_state
  add column if not exists last_snapshot_at timestamptz;

update public.mt5_risk_state
set last_snapshot_at = coalesce(last_snapshot_at, updated_at, now())
where last_snapshot_at is null;

alter table public.mt5_risk_state
  alter column last_snapshot_at set not null,
  alter column last_snapshot_at set default now();

create or replace function public.reject_stale_mt5_account_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.captured_at < old.captured_at then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists mt5_account_snapshot_no_time_rewind on public.mt5_account_snapshots;
create trigger mt5_account_snapshot_no_time_rewind
before update on public.mt5_account_snapshots
for each row execute function public.reject_stale_mt5_account_snapshot();

create or replace function public.update_mt5_risk_anchors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  utc_day date := (new.captured_at at time zone 'UTC')::date;
  utc_week date := date_trunc('week', new.captured_at at time zone 'UTC')::date;
begin
  insert into public.mt5_risk_state (
    installation_id, account_login, daily_anchor_date, weekly_anchor_date,
    daily_start_equity, weekly_start_equity, high_water_mark_equity, last_snapshot_at, updated_at
  ) values (
    new.installation_id, new.account_login, utc_day, utc_week,
    new.equity, new.equity, new.equity, new.captured_at, now()
  )
  on conflict (installation_id, account_login) do update set
    daily_start_equity = case
      when excluded.last_snapshot_at >= public.mt5_risk_state.last_snapshot_at
       and public.mt5_risk_state.daily_anchor_date <> excluded.daily_anchor_date
      then excluded.daily_start_equity else public.mt5_risk_state.daily_start_equity end,
    daily_anchor_date = case
      when excluded.last_snapshot_at >= public.mt5_risk_state.last_snapshot_at
      then excluded.daily_anchor_date else public.mt5_risk_state.daily_anchor_date end,
    weekly_start_equity = case
      when excluded.last_snapshot_at >= public.mt5_risk_state.last_snapshot_at
       and public.mt5_risk_state.weekly_anchor_date <> excluded.weekly_anchor_date
      then excluded.weekly_start_equity else public.mt5_risk_state.weekly_start_equity end,
    weekly_anchor_date = case
      when excluded.last_snapshot_at >= public.mt5_risk_state.last_snapshot_at
      then excluded.weekly_anchor_date else public.mt5_risk_state.weekly_anchor_date end,
    high_water_mark_equity = case
      when excluded.last_snapshot_at >= public.mt5_risk_state.last_snapshot_at
      then greatest(public.mt5_risk_state.high_water_mark_equity, excluded.high_water_mark_equity)
      else public.mt5_risk_state.high_water_mark_equity end,
    last_snapshot_at = greatest(public.mt5_risk_state.last_snapshot_at, excluded.last_snapshot_at),
    updated_at = now();
  return new;
end;
$$;
