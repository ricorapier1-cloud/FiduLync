-- Customer self-service account transfer. OTP hashes only; no plaintext codes are stored.
CREATE TABLE IF NOT EXISTS public.license_transfer_requests (
  id UUID PRIMARY KEY,
  license_key TEXT NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  current_mt5_account BIGINT NOT NULL,
  new_mt5_account BIGINT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT license_transfer_accounts_differ CHECK (current_mt5_account <> new_mt5_account)
);

CREATE INDEX IF NOT EXISTS license_transfer_requests_license_created_idx
  ON public.license_transfer_requests (license_key, created_at DESC);

ALTER TABLE public.license_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.complete_license_transfer(
  p_request_id UUID,
  p_license_key TEXT,
  p_current_mt5_account BIGINT,
  p_new_mt5_account BIGINT,
  p_code_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  transfer_request public.license_transfer_requests%ROWTYPE;
  license_row public.licenses%ROWTYPE;
BEGIN
  SELECT * INTO transfer_request
  FROM public.license_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR transfer_request.consumed_at IS NOT NULL
     OR transfer_request.expires_at <= now()
     OR transfer_request.attempts >= 5
     OR transfer_request.license_key <> p_license_key
     OR transfer_request.current_mt5_account <> p_current_mt5_account
     OR transfer_request.new_mt5_account <> p_new_mt5_account THEN
    RETURN jsonb_build_object('success', false, 'reason', 'This transfer request is invalid or expired.');
  END IF;

  IF transfer_request.code_hash <> p_code_hash THEN
    UPDATE public.license_transfer_requests SET attempts = attempts + 1 WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'reason', 'The verification code is incorrect.');
  END IF;

  SELECT * INTO license_row
  FROM public.licenses
  WHERE license_key = p_license_key
  FOR UPDATE;

  IF NOT FOUND OR license_row.mt5_account <> p_current_mt5_account
     OR license_row.status <> 'active'
     OR (license_row.expires_at IS NOT NULL AND license_row.expires_at <= now())
     OR lower(license_row.email) <> lower(transfer_request.email) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'The license is no longer eligible for transfer.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.licenses
    WHERE mt5_account = p_new_mt5_account
      AND license_key <> p_license_key
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'The destination MT5 account already has an active license.');
  END IF;

  UPDATE public.licenses
  SET mt5_account = p_new_mt5_account
  WHERE license_key = p_license_key;

  -- Do not carry the previous account's live heartbeat onto the new account.
  DELETE FROM public.ea_heartbeats
  WHERE mt5_account = p_current_mt5_account
    AND license_key = p_license_key;

  UPDATE public.license_transfer_requests
  SET consumed_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'mt5_account', p_new_mt5_account);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_license_transfer(UUID, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_license_transfer(UUID, TEXT, BIGINT, BIGINT, TEXT) TO service_role;
