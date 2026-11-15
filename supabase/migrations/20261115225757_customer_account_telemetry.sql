-- Customer-scoped MT5 telemetry. No broker credentials are collected or stored.
-- Keep heartbeat rows isolated by the verified customer license.
ALTER TABLE public.ea_heartbeats
  ADD COLUMN IF NOT EXISTS license_key TEXT REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ea_name TEXT NOT NULL DEFAULT 'MT5 Expert Advisor',
  ADD COLUMN IF NOT EXISTS floating_pnl NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RUNNING';

-- The API upserts one heartbeat per MT5 account using on_conflict=mt5_account.
CREATE UNIQUE INDEX IF NOT EXISTS ea_heartbeats_mt5_account_unique
  ON public.ea_heartbeats (mt5_account);

CREATE INDEX IF NOT EXISTS ea_heartbeats_license_account_idx
  ON public.ea_heartbeats (license_key, mt5_account);

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

CREATE INDEX IF NOT EXISTS trade_ledger_account_closed_idx
  ON public.trade_ledger (mt5_account, closed_at_utc DESC);

ALTER TABLE public.trade_ledger ENABLE ROW LEVEL SECURITY;
