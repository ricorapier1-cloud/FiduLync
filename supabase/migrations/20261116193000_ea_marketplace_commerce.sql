-- Reproducible migration for the independent FiduLync EA marketplace.
-- No escrow tables, policies, routes, or business logic are referenced.
create table if not exists public.ea_marketplace_sellers (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null unique references auth.users(id) on delete restrict,
 display_name text not null, support_email text not null, country_code char(2) not null default 'NG',
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 onboarding_notes text, approved_at timestamptz, approved_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ea_marketplace_products (
 id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.ea_marketplace_sellers(id) on delete restrict,
 slug text not null unique, name text not null, short_description text not null default '', description text not null default '',
 version text not null default '1.0.0', tier text not null default 'advanced' check(tier in ('essential','advanced','professional','institutional','enterprise')),
 strategy_style text not null default 'systematic', platform text not null default 'MT5', asset_classes text[] not null default array['FX']::text[],
 symbols text[] not null default array[]::text[], timeframes text[] not null default array[]::text[], account_modes text[] not null default array['hedging','netting']::text[],
 broker_requirements text[] not null default array[]::text[], recommended_vps text, minimum_deposit numeric(18,2),
 risk_profile text not null default 'not_assessed' check(risk_profile in ('conservative','moderate','aggressive','not_assessed')),
 factsheet jsonb not null default '{}'::jsonb,
 evidence_status text not null default 'unverified' check(evidence_status in ('unverified','backtest_only','demo_forward','live_forward','independently_verified')),
 evidence_provider text, evidence_url text, evidence_checked_at timestamptz, backtest_start date, backtest_end date, forward_start date, forward_end date,
 sample_trade_count integer check(sample_trade_count is null or sample_trade_count>=0),
 profit_factor numeric(12,4) check(profit_factor is null or profit_factor>=0),
 max_drawdown_pct numeric(8,4) check(max_drawdown_pct is null or max_drawdown_pct between 0 and 100),
 win_rate_pct numeric(8,4) check(win_rate_pct is null or win_rate_pct between 0 and 100),
 sharpe_ratio numeric(12,4), sortino_ratio numeric(12,4), recovery_factor numeric(12,4), net_return_pct numeric(14,4),
 execution_assumptions jsonb not null default '{}'::jsonb,
 risk_disclosure text not null default 'Trading involves substantial risk. Historical results do not guarantee future performance.',
 status text not null default 'draft' check(status in ('draft','submitted','published','rejected','suspended','archived')),
 reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz, review_notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ea_marketplace_plans (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.ea_marketplace_products(id) on delete cascade,
 code text not null, label text not null, billing_type text not null check(billing_type in ('one_time','rental')),
 amount_minor bigint not null check(amount_minor>0), currency char(3) not null default 'USD' check(currency in ('USD','NGN')),
 duration_days integer, max_mt5_accounts integer not null default 1 check(max_mt5_accounts between 1 and 100),
 platform_commission_bps integer not null default 2000 check(platform_commission_bps between 0 and 5000),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(product_id,code), check((billing_type='one_time' and duration_days is null) or (billing_type='rental' and duration_days between 1 and 3650))
);
create table if not exists public.ea_marketplace_orders (
 id uuid primary key default gen_random_uuid(), order_ref text not null unique,
 product_id uuid not null references public.ea_marketplace_products(id) on delete restrict,
 plan_id uuid not null references public.ea_marketplace_plans(id) on delete restrict,
 seller_id uuid not null references public.ea_marketplace_sellers(id) on delete restrict,
 buyer_user_id uuid references auth.users(id) on delete set null, buyer_email text not null, buyer_mt5_account bigint,
 currency char(3) not null check(currency in ('USD','NGN')), amount_minor bigint not null check(amount_minor>0),
 commission_bps integer not null check(commission_bps between 0 and 5000), platform_fee_minor bigint not null check(platform_fee_minor>=0),
 seller_gross_minor bigint not null check(seller_gross_minor>=0), provider_fee_minor bigint not null default 0 check(provider_fee_minor>=0),
 seller_net_minor bigint not null check(seller_net_minor>=0), payment_provider text not null default 'paystack',
 payment_reference text unique, payment_status text not null default 'pending' check(payment_status in ('pending','paid','failed','refunded','disputed')),
 checkout_url text, paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ea_marketplace_entitlements (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.ea_marketplace_orders(id) on delete restrict,
 product_id uuid not null references public.ea_marketplace_products(id) on delete restrict,
 buyer_user_id uuid references auth.users(id) on delete set null, buyer_email text not null, license_key text not null unique,
 max_mt5_accounts integer not null default 1 check(max_mt5_accounts between 1 and 100),
 status text not null default 'active' check(status in ('active','expired','suspended','revoked')),
 starts_at timestamptz not null default now(), expires_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check(expires_at is null or expires_at>starts_at)
);
create table if not exists public.ea_marketplace_activations (
 id uuid primary key default gen_random_uuid(), entitlement_id uuid not null references public.ea_marketplace_entitlements(id) on delete cascade,
 mt5_account bigint not null check(mt5_account>0), broker_server text,
 status text not null default 'active' check(status in ('active','released','blocked')),
 activated_at timestamptz not null default now(), last_seen_at timestamptz, unique(entitlement_id,mt5_account)
);
create table if not exists public.ea_marketplace_payout_ledger (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.ea_marketplace_orders(id) on delete restrict,
 seller_id uuid not null references public.ea_marketplace_sellers(id) on delete restrict, currency char(3) not null check(currency in ('USD','NGN')),
 gross_minor bigint not null check(gross_minor>=0), platform_fee_minor bigint not null check(platform_fee_minor>=0),
 provider_fee_minor bigint not null default 0 check(provider_fee_minor>=0), net_minor bigint not null check(net_minor>=0),
 status text not null default 'pending' check(status in ('pending','approved','processing','paid','failed','held')),
 provider_reference text, created_at timestamptz not null default now(), paid_at timestamptz
);
create table if not exists public.ea_marketplace_audit_events (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id) on delete set null,
 order_id uuid references public.ea_marketplace_orders(id) on delete set null,
 product_id uuid references public.ea_marketplace_products(id) on delete set null,
 entitlement_id uuid references public.ea_marketplace_entitlements(id) on delete set null,
 event_type text not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists ea_marketplace_products_public_idx on public.ea_marketplace_products(status,tier,created_at desc);
create index if not exists ea_marketplace_products_seller_idx on public.ea_marketplace_products(seller_id,status,updated_at desc);
create index if not exists ea_marketplace_plans_product_idx on public.ea_marketplace_plans(product_id,active);
create index if not exists ea_marketplace_orders_buyer_idx on public.ea_marketplace_orders(buyer_user_id,created_at desc);
create index if not exists ea_marketplace_orders_seller_idx on public.ea_marketplace_orders(seller_id,created_at desc);
create index if not exists ea_marketplace_orders_payment_idx on public.ea_marketplace_orders(payment_status,created_at desc);
create index if not exists ea_marketplace_entitlements_buyer_idx on public.ea_marketplace_entitlements(buyer_user_id,status,expires_at);
create index if not exists ea_marketplace_activations_account_idx on public.ea_marketplace_activations(mt5_account,status);
create index if not exists ea_marketplace_payout_seller_idx on public.ea_marketplace_payout_ledger(seller_id,status,created_at desc);
create index if not exists ea_marketplace_audit_created_idx on public.ea_marketplace_audit_events(created_at desc);
create index if not exists ea_marketplace_audit_actor_idx on public.ea_marketplace_audit_events(actor_user_id);
create index if not exists ea_marketplace_audit_order_idx on public.ea_marketplace_audit_events(order_id);
create index if not exists ea_marketplace_audit_product_idx on public.ea_marketplace_audit_events(product_id);
create index if not exists ea_marketplace_audit_entitlement_idx on public.ea_marketplace_audit_events(entitlement_id);
create index if not exists ea_marketplace_entitlements_product_idx on public.ea_marketplace_entitlements(product_id);
create index if not exists ea_marketplace_orders_product_idx on public.ea_marketplace_orders(product_id);
create index if not exists ea_marketplace_orders_plan_idx on public.ea_marketplace_orders(plan_id);
create index if not exists ea_marketplace_products_reviewer_idx on public.ea_marketplace_products(reviewed_by);
create index if not exists ea_marketplace_sellers_approver_idx on public.ea_marketplace_sellers(approved_by);
do $$
declare t text;
begin
 foreach t in array array['ea_marketplace_sellers','ea_marketplace_products','ea_marketplace_plans','ea_marketplace_orders','ea_marketplace_entitlements','ea_marketplace_activations','ea_marketplace_payout_ledger','ea_marketplace_audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
