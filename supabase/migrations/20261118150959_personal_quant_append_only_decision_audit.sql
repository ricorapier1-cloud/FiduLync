create or replace function public.prevent_mt5_risk_decision_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'mt5_risk_decisions is append-only; % is prohibited', tg_op
    using errcode = '55000';
end;
$$;

drop trigger if exists mt5_risk_decisions_append_only on public.mt5_risk_decisions;
create trigger mt5_risk_decisions_append_only
before update or delete on public.mt5_risk_decisions
for each row execute function public.prevent_mt5_risk_decision_mutation();

revoke all on function public.prevent_mt5_risk_decision_mutation() from public, anon, authenticated;
revoke update, delete, truncate on public.mt5_risk_decisions from public, anon, authenticated, service_role;
grant select, insert on public.mt5_risk_decisions to service_role;

alter table public.mt5_risk_decisions
  drop constraint if exists mt5_risk_decisions_installation_id_fkey;
alter table public.mt5_risk_decisions
  add constraint mt5_risk_decisions_installation_id_fkey
  foreign key (installation_id)
  references public.mt5_installations(id)
  on delete restrict;
