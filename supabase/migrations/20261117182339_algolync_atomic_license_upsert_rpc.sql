CREATE OR REPLACE FUNCTION public.provision_algolync_license(
  p_payment_reference TEXT,
  p_license_key TEXT,
  p_mt5_account BIGINT,
  p_email TEXT,
  p_tier TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  license_row public.licenses%ROWTYPE;
BEGIN
  IF p_payment_reference IS NULL OR length(p_payment_reference) < 20
     OR p_license_key IS NULL OR length(p_license_key) < 16
     OR p_email IS NULL OR position('@' in p_email) < 2
     OR p_tier NOT IN ('INSTITUTIONAL_MONTHLY', 'INSTITUTIONAL_LIFETIME') THEN
    RAISE EXCEPTION 'Invalid AlgoLync license provisioning input';
  END IF;

  INSERT INTO public.licenses (
    license_key, payment_reference, mt5_account, email, tier, status, expires_at
  )
  VALUES (
    p_license_key, p_payment_reference, p_mt5_account, lower(p_email), p_tier, 'active', p_expires_at
  )
  ON CONFLICT (payment_reference)
  DO UPDATE SET payment_reference = EXCLUDED.payment_reference
  RETURNING * INTO license_row;

  RETURN jsonb_build_object(
    'license_key', license_row.license_key,
    'payment_reference', license_row.payment_reference,
    'mt5_account', license_row.mt5_account,
    'email', license_row.email,
    'tier', license_row.tier,
    'status', license_row.status,
    'expires_at', license_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_algolync_license(TEXT, TEXT, BIGINT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_algolync_license(TEXT, TEXT, BIGINT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
