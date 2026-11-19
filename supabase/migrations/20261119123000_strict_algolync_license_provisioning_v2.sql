CREATE OR REPLACE FUNCTION public.provision_algolync_license_v2(
  p_payment_reference text, p_license_key text, p_mt5_account bigint, p_email text,
  p_tier text, p_expires_at timestamptz, p_ea_slug text, p_currency text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_license public.licenses%ROWTYPE; v_product public.ea_products%ROWTYPE; v_created boolean := false;
BEGIN
  IF p_payment_reference IS NULL OR length(p_payment_reference)<20 OR p_license_key IS NULL OR length(p_license_key)<16
     OR p_email IS NULL OR position('@' in p_email)<2 OR p_tier NOT IN ('INSTITUTIONAL_MONTHLY','INSTITUTIONAL_LIFETIME')
     OR p_ea_slug IS NULL OR p_currency NOT IN ('NGN','USD') THEN RAISE EXCEPTION 'Invalid AlgoLync license provisioning input'; END IF;
  SELECT * INTO v_product FROM public.ea_products WHERE slug=p_ea_slug AND is_active=true FOR SHARE;
  IF NOT FOUND OR v_product.category='SANDBOX' THEN RAISE EXCEPTION 'AlgoLync product is not active for paid licensing'; END IF;
  SELECT * INTO v_license FROM public.licenses WHERE payment_reference=p_payment_reference FOR UPDATE;
  IF FOUND THEN
    IF lower(v_license.email)<>lower(p_email) OR v_license.ea_slug<>p_ea_slug OR v_license.tier<>p_tier OR v_license.currency<>p_currency
    THEN RAISE EXCEPTION 'Payment reference is already bound to a different entitlement'; END IF;
  ELSE
    INSERT INTO public.licenses(license_key,payment_reference,mt5_account,email,tier,status,expires_at,ea_slug,currency,included_live_seats,included_demo_seats,extra_live_seats)
    VALUES(p_license_key,p_payment_reference,p_mt5_account,lower(p_email),p_tier,'active',p_expires_at,p_ea_slug,p_currency,v_product.included_live_seats,v_product.included_demo_seats,0)
    RETURNING * INTO v_license;
    v_created:=true;
  END IF;
  RETURN jsonb_build_object('license_key',v_license.license_key,'payment_reference',v_license.payment_reference,
    'mt5_account',v_license.mt5_account,'email',v_license.email,'tier',v_license.tier,'status',v_license.status,
    'expires_at',v_license.expires_at,'ea_slug',v_license.ea_slug,'created',v_created);
END;
$$;
REVOKE ALL ON FUNCTION public.provision_algolync_license_v2(text,text,bigint,text,text,timestamptz,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_algolync_license_v2(text,text,bigint,text,text,timestamptz,text,text) TO service_role;