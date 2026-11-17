-- Source-controlled schema for the institutional AlgoLync subscription system.
-- Applied separately through Supabase migration tooling.
create table if not exists public.ea_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  tagline text not null default '',
  version text not null default '1.0.0',
  category text not null default 'GENERAL',
  monthly_price_ngn bigint not null default 0 check (monthly_price_ngn >= 0),
  monthly_price_usd numeric(12,2) not null default 0 check (monthly_price_usd >= 0),
  annual_price_ngn bigint not null default 0 check (annual_price_ngn >= 0),
  annual_price_usd numeric(12,2) not null default 0 check (annual_price_usd >= 0),
  extra_seat_price_ngn bigint not null default 0 check (extra_seat_price_ngn >= 0),
  extra_seat_price_usd numeric(12,2) not null default 0 check (extra_seat_price_usd >= 0),
  demo_days integer not null default 14 check (demo_days between 1 and 30),
  included_live_seats integer not null default 1 check (included_live_seats >= 0),
  included_demo_seats integer not null default 2 check (included_demo_seats >= 0),
  metrics_json jsonb not null default '{}'::jsonb,
  ex5_artifact_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ea_products enable row level security;
drop policy if exists "Active EA products are publicly readable" on public.ea_products;
create policy "Active EA products are publicly readable" on public.ea_products for select to anon, authenticated using (is_active = true);
revoke insert, update, delete on public.ea_products from anon, authenticated;
grant select on public.ea_products to anon, authenticated;

alter table public.licenses
  add column if not exists ea_slug text,
  add column if not exists billing_cycle text check (billing_cycle is null or billing_cycle in ('MONTHLY','ANNUAL')),
  add column if not exists currency text check (currency is null or currency in ('NGN','USD')),
  add column if not exists included_live_seats integer not null default 1,
  add column if not exists included_demo_seats integer not null default 2,
  add column if not exists extra_live_seats integer not null default 0,
  add column if not exists grace_until timestamptz,
  add column if not exists renewal_reminder_due boolean not null default false,
  add column if not exists paystack_subscription_code text,
  add column if not exists period_ends_at timestamptz,
  add column if not exists account_mode text;

create table if not exists public.ea_demo_trials (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ea_slug text not null references public.ea_products(slug),
  mt5_login bigint not null check (mt5_login > 0),
  license_key text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email, ea_slug),
  unique (mt5_login)
);
alter table public.ea_demo_trials enable row level security;
revoke all on public.ea_demo_trials from anon, authenticated;

create table if not exists public.ea_license_seats (
  id uuid primary key default gen_random_uuid(),
  license_key text not null references public.licenses(license_key) on delete cascade,
  ea_slug text not null references public.ea_products(slug),
  slot_type text not null check (slot_type in ('LIVE','DEMO')),
  slot_number integer not null check (slot_number > 0),
  mt5_login bigint,
  broker_server text,
  bound_at timestamptz,
  rebind_available_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (license_key, slot_type, slot_number),
  unique (slot_type, mt5_login)
);
create index if not exists ea_license_seats_license_idx on public.ea_license_seats(license_key);
alter table public.ea_license_seats enable row level security;
revoke all on public.ea_license_seats from anon, authenticated;

create table if not exists public.paystack_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  event_type text not null,
  reference text,
  payload_hash text not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);
alter table public.paystack_webhook_events enable row level security;
revoke all on public.paystack_webhook_events from anon, authenticated;

insert into public.ea_products
(slug,name,tagline,version,category,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,demo_days,included_live_seats,included_demo_seats,metrics_json,is_active)
values
('eridam-nexus-pro','Eridam Nexus Adaptive Pro','Multi-regime volatility and macro-bias execution engine','4.2','FLAGSHIP',65000,49,650000,490,12000,9,14,1,2,'{"win_rate":"64.8%","profit_factor":"2.34","sharpe":"2.18","max_drawdown":"5.4%","equity_curve":[100,102,101,105,108,107,112,116,115,121,126,124,131,138,142],"provenance":"Simulated historical reference; not verified live performance"}',false),
('velocity-vault','Velocity Vault Momentum','London and New York momentum continuation','2.7','MOMENTUM',45000,35,450000,350,9000,7,14,1,2,'{"win_rate":"59.2%","profit_factor":"2.05","sharpe":"1.92","max_drawdown":"4.8%","equity_curve":[100,101,104,103,107,110,109,114,118,117,122,125,129,133,137],"provenance":"Historical reference; not verified live performance"}',false),
('macro-atr-breakout','MacroLync G10 ATR Breakout','Open-source sandbox strategy','1.0','SANDBOX',0,0,0,0,0,0,14,0,99,'{"provenance":"Open-source sandbox; metrics are illustrative"}',true)
on conflict (slug) do nothing;
