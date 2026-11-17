create table if not exists public.ea_subscription_intents (
  reference text primary key,
  email text not null,
  ea_slug text not null references public.ea_products(slug),
  billing_cycle text not null check (billing_cycle in ('MONTHLY','ANNUAL')),
  currency text not null check (currency in ('NGN','USD')),
  extra_live_seats integer not null default 0 check (extra_live_seats in (0,1,3,5)),
  amount_minor bigint not null check (amount_minor > 0),
  paystack_plan_code text not null,
  subscription_code text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ea_subscription_intents_subscription_code_idx on public.ea_subscription_intents(subscription_code) where subscription_code is not null;
alter table public.ea_subscription_intents enable row level security;
revoke all on public.ea_subscription_intents from anon, authenticated;
create table if not exists public.ea_subscriptions (
  id uuid primary key default gen_random_uuid(),
  initial_reference text not null unique references public.ea_subscription_intents(reference),
  license_key text not null unique references public.licenses(license_key),
  subscription_code text unique,
  email text not null,
  ea_slug text not null references public.ea_products(slug),
  billing_cycle text not null check (billing_cycle in ('MONTHLY','ANNUAL')),
  currency text not null check (currency in ('NGN','USD')),
  extra_live_seats integer not null default 0,
  status text not null default 'ACTIVE',
  period_ends_at timestamptz not null,
  grace_until timestamptz,
  renewal_reminder_due boolean not null default false,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ea_subscriptions enable row level security;
revoke all on public.ea_subscriptions from anon, authenticated;
create table if not exists public.ea_subscription_payments (
  reference text primary key,
  subscription_id uuid not null references public.ea_subscriptions(id) on delete cascade,
  amount_minor bigint not null,
  currency text not null check (currency in ('NGN','USD')),
  paid_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null
);
alter table public.ea_subscription_payments enable row level security;
revoke all on public.ea_subscription_payments from anon, authenticated;
