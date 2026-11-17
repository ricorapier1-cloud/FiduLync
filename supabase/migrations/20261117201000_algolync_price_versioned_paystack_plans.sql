alter table public.ea_subscriptions add column if not exists paystack_plan_code text, add column if not exists amount_minor bigint;
alter table public.paystack_subscription_plans drop constraint if exists paystack_subscription_plans_ea_slug_billing_cycle_currency_extra_live_seats_key;
create unique index if not exists paystack_subscription_plans_price_version_unique on public.paystack_subscription_plans(ea_slug,billing_cycle,currency,extra_live_seats,amount_minor);
-- Renewal provisioning now uses ea_subscriptions.amount_minor so existing subscribers keep their contracted price after catalog price changes.
