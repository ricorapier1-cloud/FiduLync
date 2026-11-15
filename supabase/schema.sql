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
