CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  mt5_account BIGINT NOT NULL,
  email TEXT NOT NULL,
  tier TEXT DEFAULT 'INSTITUTIONAL_PRO',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  mt5_account BIGINT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ea_heartbeats (
  mt5_account BIGINT PRIMARY KEY,
  license_key TEXT NOT NULL,
  balance NUMERIC NOT NULL,
  equity NUMERIC NOT NULL,
  drawdown_pct NUMERIC DEFAULT 0,
  open_positions INT DEFAULT 0,
  vps_ping_ms INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_heartbeats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';

CREATE TABLE IF NOT EXISTS public.macro_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    regime_label TEXT NOT NULL,
    top_long TEXT NOT NULL,
    top_short TEXT NOT NULL,
    policy_spread NUMERIC NOT NULL,
    provenance TEXT DEFAULT 'LIVE',
    csi_scores JSONB NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.macro_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ea_heartbeats
  ADD COLUMN IF NOT EXISTS ea_name TEXT NOT NULL DEFAULT 'MT5 Expert Advisor',
  ADD COLUMN IF NOT EXISTS floating_pnl NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RUNNING';

CREATE TABLE IF NOT EXISTS public.trade_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mt5_account BIGINT NOT NULL,
  license_key TEXT NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  ticket TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  profit_usd NUMERIC NOT NULL,
  r_multiple NUMERIC NOT NULL,
  confluence_score INTEGER NOT NULL CHECK (confluence_score BETWEEN -100 AND 100),
  regime TEXT NOT NULL,
  closed_at_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trade_ledger_account_ticket_symbol_unique UNIQUE (mt5_account, ticket, symbol)
);
CREATE INDEX IF NOT EXISTS trade_ledger_account_closed_idx ON public.trade_ledger (mt5_account, closed_at_utc DESC);
CREATE INDEX IF NOT EXISTS ea_heartbeats_license_account_idx ON public.ea_heartbeats (license_key, mt5_account);
ALTER TABLE public.trade_ledger ENABLE ROW LEVEL SECURITY;

-- Expert Advisors Catalog
CREATE TABLE IF NOT EXISTS public.expert_advisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  tier_category TEXT NOT NULL DEFAULT 'PRO',
  monthly_price_ngn NUMERIC NOT NULL DEFAULT 65000,
  monthly_price_usd NUMERIC NOT NULL DEFAULT 49,
  lifetime_price_ngn NUMERIC DEFAULT 250000,
  lifetime_price_usd NUMERIC DEFAULT 199,
  paystack_plan_code_ngn TEXT,
  max_live_accounts INT NOT NULL DEFAULT 1,
  max_demo_accounts INT NOT NULL DEFAULT 2,
  download_demo_path TEXT NOT NULL DEFAULT '/downloads/MacroLync_G10_Breakout_Test.mq5',
  download_live_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Multi-Account Seat Binding with 72-Hour Cooldown
CREATE TABLE IF NOT EXISTS public.license_bound_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  account_number BIGINT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'LIVE' CHECK (account_type IN ('LIVE', 'DEMO')),
  broker_server TEXT,
  rebind_cooldown_until TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT license_bound_account_unique UNIQUE (license_key, account_number)
);

ALTER TABLE public.expert_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_bound_accounts ENABLE ROW LEVEL SECURITY;
