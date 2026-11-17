ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE public.licenses
  ALTER COLUMN mt5_account DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS licenses_payment_reference_uidx
  ON public.licenses (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS licenses_email_status_idx
  ON public.licenses (lower(email), status);

CREATE OR REPLACE FUNCTION public.complete_initial_license_binding(
  p_request_id UUID,
  p_license_key TEXT,
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
     OR transfer_request.current_mt5_account <> 0
     OR transfer_request.license_key <> p_license_key
     OR transfer_request.new_mt5_account <> p_new_mt5_account THEN
    RETURN jsonb_build_object('success', false, 'reason', 'This binding request is invalid or expired.');
  END IF;

  IF transfer_request.code_hash <> p_code_hash THEN
    UPDATE public.license_transfer_requests SET attempts = attempts + 1 WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'reason', 'The verification code is incorrect.');
  END IF;

  SELECT * INTO license_row
  FROM public.licenses
  WHERE license_key = p_license_key
  FOR UPDATE;

  IF NOT FOUND OR license_row.mt5_account IS NOT NULL
     OR license_row.status <> 'active'
     OR (license_row.expires_at IS NOT NULL AND license_row.expires_at <= now())
     OR lower(license_row.email) <> lower(transfer_request.email) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'The license is no longer eligible for initial binding.');
  END IF;

  UPDATE public.licenses
  SET mt5_account = p_new_mt5_account
  WHERE license_key = p_license_key;

  UPDATE public.license_transfer_requests
  SET consumed_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'mt5_account', p_new_mt5_account);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_initial_license_binding(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_initial_license_binding(UUID, TEXT, BIGINT, TEXT) TO service_role;
