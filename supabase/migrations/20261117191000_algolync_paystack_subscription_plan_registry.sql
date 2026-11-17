create table if not exists public.paystack_subscription_plans (
 id uuid primary key default gen_random_uuid(),ea_slug text not null references public.ea_products(slug),
 billing_cycle text not null check(billing_cycle in ('MONTHLY','ANNUAL')),currency text not null check(currency in ('NGN','USD')),
 extra_live_seats integer not null default 0 check(extra_live_seats in (0,1,3,5)),amount_minor bigint not null check(amount_minor>0),
 paystack_plan_code text not null unique,created_at timestamptz not null default now(),
 unique(ea_slug,billing_cycle,currency,extra_live_seats)
);
alter table public.paystack_subscription_plans enable row level security;
revoke all on public.paystack_subscription_plans from anon,authenticated;
