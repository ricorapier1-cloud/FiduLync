-- FiduLync owner entitlement audit and safe hybrid MT5 ingestion hardening.
-- Existing license, installation, quote and candle tables are retained.
CREATE TABLE IF NOT EXISTS public.fidulync_owner_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL CHECK (lower(owner_email) = 'ricorapier1@gmail.com'),
  action text NOT NULL CHECK (action IN ('OWNER_LIFETIME_LICENSE_ISSUED','MT5_INSTALLATION_CREATED','MT5_INSTALLATION_REVOKED')),
  subject_id uuid,
  mt5_account bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fidulync_owner_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fidulync_owner_audit FROM anon, authenticated;
GRANT ALL ON public.fidulync_owner_audit TO service_role;

CREATE INDEX IF NOT EXISTS mt5_market_candles_signal_lookup_idx
  ON public.mt5_market_candles (symbol, timeframe, bar_time DESC)
  WHERE is_closed = true;
CREATE INDEX IF NOT EXISTS mt5_market_quotes_freshness_idx
  ON public.mt5_market_quotes (symbol, quote_time DESC);
CREATE INDEX IF NOT EXISTS mt5_installations_owner_active_idx
  ON public.mt5_installations (user_id, created_at DESC)
  WHERE status = 'active';
