-- Each checkout intent receives a dedicated Paystack plan code. This allows
-- subscription.create webhooks to resolve the exact pending customer intent.
create unique index if not exists ea_subscription_intents_plan_code_uidx
  on public.ea_subscription_intents(paystack_plan_code)
  where paystack_plan_code is not null;
