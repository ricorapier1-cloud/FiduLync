ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_status text NOT NULL DEFAULT 'free'
    CHECK (tier_status IN ('free', 'vip_active')),
  ADD COLUMN IF NOT EXISTS custom_fx_watchlist text[] NOT NULL DEFAULT ARRAY['EURUSD']::text[],
  ADD COLUMN IF NOT EXISTS macro_vip_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.macro_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS macro_api_keys_user_active_idx
  ON public.macro_api_keys (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.macro_subscriptions (
  reference text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  expected_amount integer NOT NULL CHECK (expected_amount > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'initializing'
    CHECK (status IN ('initializing', 'active', 'past_due', 'cancelled')),
  paystack_subscription_code text,
  paystack_customer_code text,
  last_charge_reference text,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS macro_subscriptions_paystack_code_idx
  ON public.macro_subscriptions (paystack_subscription_code)
  WHERE paystack_subscription_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.macro_snapshots (
  snapshot_key text PRIMARY KEY DEFAULT 'global' CHECK (snapshot_key = 'global'),
  payload jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.macro_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.macro_api_keys FROM anon, authenticated;
REVOKE ALL ON public.macro_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.macro_snapshots FROM anon, authenticated;

REVOKE UPDATE (tier_status, macro_vip_expires_at) ON public.profiles FROM authenticated;
GRANT UPDATE (custom_fx_watchlist) ON public.profiles TO authenticated;