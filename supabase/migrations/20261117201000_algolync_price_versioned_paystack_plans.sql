alter table public.ea_subscriptions add column if not exists paystack_plan_code text, add column if not exists amount_minor bigint;
alter table public.paystack_subscription_plans drop constraint if exists paystack_subscription_plans_ea_slug_billing_cycle_currency_extra_live_seats_key;
create unique index if not exists paystack_subscription_plans_price_version_unique on public.paystack_subscription_plans(ea_slug,billing_cycle,currency,extra_live_seats,amount_minor);

create or replace function public.provision_or_extend_ea_subscription(
 p_reference text,p_subscription_code text,p_email text,p_ea_slug text,p_billing_cycle text,p_currency text,
 p_extra_live_seats integer,p_amount_minor bigint,p_license_key_candidate text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_intent public.ea_subscription_intents%rowtype; v_sub public.ea_subscriptions%rowtype; v_license jsonb;
 v_expected bigint; v_period_start timestamptz; v_period_end timestamptz; v_days integer; v_code text;
begin
 if p_reference is null or p_reference='' or p_ea_slug is null or p_billing_cycle not in('MONTHLY','ANNUAL')
  or p_currency not in('NGN','USD') or p_extra_live_seats not in(0,1,3,5) or p_amount_minor<=0 then raise exception 'Invalid subscription payment input'; end if;
 select * into v_intent from public.ea_subscription_intents where reference=p_reference for update;
 v_code:=coalesce(nullif(p_subscription_code,''),v_intent.subscription_code);
 if found then
  if lower(v_intent.email)<>lower(p_email) or v_intent.ea_slug<>p_ea_slug or v_intent.billing_cycle<>p_billing_cycle
   or v_intent.currency<>p_currency or v_intent.extra_live_seats<>p_extra_live_seats or v_intent.amount_minor<>p_amount_minor then raise exception 'Subscription payment does not match stored checkout intent'; end if;
  select * into v_sub from public.ea_subscriptions where initial_reference=p_reference for update;
 elsif v_code is not null then
  select * into v_sub from public.ea_subscriptions where subscription_code=v_code for update;
  if not found then raise exception 'Subscription record not found for recurring payment'; end if;
  if lower(v_sub.email)<>lower(p_email) or v_sub.ea_slug<>p_ea_slug or v_sub.billing_cycle<>p_billing_cycle
   or v_sub.currency<>p_currency or v_sub.extra_live_seats<>p_extra_live_seats then raise exception 'Recurring payment metadata does not match subscription'; end if;
 else raise exception 'No subscription intent or subscription code found'; end if;
 if v_sub.id is not null then
  if exists(select 1 from public.ea_subscription_payments where reference=p_reference) then
   return jsonb_build_object('license_key',v_sub.license_key,'created',false,'idempotent_replay',true,'period_ends_at',v_sub.period_ends_at); end if;
  v_expected:=v_sub.amount_minor;
  if v_expected is null or v_expected<>p_amount_minor then raise exception 'Recurring payment amount does not match the subscription price'; end if;
  v_period_start:=greatest(v_sub.period_ends_at,now()); v_days:=case when p_billing_cycle='ANNUAL' then 365 else 30 end;
  v_period_end:=v_period_start+make_interval(days=>v_days);
  insert into public.ea_subscription_payments(reference,subscription_id,amount_minor,currency,period_start,period_end) values(p_reference,v_sub.id,p_amount_minor,p_currency,v_period_start,v_period_end);
  update public.ea_subscriptions set period_ends_at=v_period_end,status='ACTIVE',grace_until=null,renewal_reminder_due=false,cancel_at_period_end=false,subscription_code=coalesce(v_code,subscription_code),updated_at=now() where id=v_sub.id;
  update public.licenses set status='ACTIVE',expires_at=v_period_end,period_ends_at=v_period_end,grace_until=null,renewal_reminder_due=false,paystack_subscription_code=coalesce(v_code,paystack_subscription_code),updated_at=now() where license_key=v_sub.license_key;
  if v_intent.reference is not null then update public.ea_subscription_intents set subscription_code=coalesce(v_code,subscription_code),status='ACTIVE',updated_at=now() where reference=v_intent.reference; end if;
  return jsonb_build_object('license_key',v_sub.license_key,'created',false,'idempotent_replay',false,'period_ends_at',v_period_end);
 end if;
 v_period_start:=now(); v_days:=case when p_billing_cycle='ANNUAL' then 365 else 30 end; v_period_end:=v_period_start+make_interval(days=>v_days);
 select public.provision_algolync_license(p_reference,p_license_key_candidate,null,p_email,'INSTITUTIONAL_MONTHLY',v_period_end) into v_license;
 if v_license is null or v_license->>'license_key' is null then raise exception 'License provisioning RPC failed'; end if;
 insert into public.ea_subscriptions(initial_reference,license_key,subscription_code,email,ea_slug,billing_cycle,currency,extra_live_seats,status,period_ends_at,paystack_plan_code,amount_minor)
 values(p_reference,v_license->>'license_key',v_code,lower(p_email),p_ea_slug,p_billing_cycle,p_currency,p_extra_live_seats,'ACTIVE',v_period_end,v_intent.paystack_plan_code,p_amount_minor) returning * into v_sub;
 insert into public.ea_subscription_payments(reference,subscription_id,amount_minor,currency,period_start,period_end) values(p_reference,v_sub.id,p_amount_minor,p_currency,v_period_start,v_period_end);
 update public.licenses set ea_slug=p_ea_slug,billing_cycle=p_billing_cycle,currency=p_currency,
 tier=case when p_billing_cycle='ANNUAL' then 'INSTITUTIONAL_ANNUAL' else 'INSTITUTIONAL_MONTHLY' end,
 included_live_seats=1,included_demo_seats=2,extra_live_seats=p_extra_live_seats,status='ACTIVE',expires_at=v_period_end,period_ends_at=v_period_end,
 paystack_subscription_code=v_code,renewal_reminder_due=false,grace_until=null where license_key=v_license->>'license_key';
 update public.ea_subscription_intents set subscription_code=coalesce(v_code,subscription_code),status='ACTIVE',updated_at=now() where reference=p_reference;
 return jsonb_build_object('license_key',v_license->>'license_key','created',true,'idempotent_replay',false,'period_ends_at',v_period_end);
end; $$;
revoke all on function public.provision_or_extend_ea_subscription(text,text,text,text,text,text,integer,bigint,text) from public,anon,authenticated;
grant execute on function public.provision_or_extend_ea_subscription(text,text,text,text,text,text,integer,bigint,text) to service_role;
