-- Atomic AlgoLync seat assignment and 72-hour re-binding.
CREATE OR REPLACE FUNCTION public.bind_algolync_seat(
  p_license_key text, p_account_number bigint, p_account_type text,
  p_broker_server text DEFAULT NULL, p_previous_account_number bigint DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_license public.licenses%ROWTYPE; v_seat public.ea_license_seats%ROWTYPE;
        v_seat_count integer; v_slot_limit integer;
BEGIN
  IF p_license_key IS NULL OR length(p_license_key) < 16 OR p_account_number IS NULL OR p_account_number <= 0
     OR p_account_type NOT IN ('LIVE','DEMO') OR (p_previous_account_number IS NOT NULL AND p_previous_account_number <= 0) THEN
    RAISE EXCEPTION 'Invalid seat-binding input';
  END IF;
  SELECT * INTO v_license FROM public.licenses WHERE license_key=p_license_key FOR UPDATE;
  IF NOT FOUND OR lower(coalesce(v_license.status,'')) <> 'active'
     OR (v_license.expires_at IS NOT NULL AND v_license.expires_at <= now()) OR v_license.ea_slug IS NULL THEN
    RETURN jsonb_build_object('success',false,'reason','License is inactive, expired, or has no product entitlement.');
  END IF;
  SELECT * INTO v_seat FROM public.ea_license_seats WHERE license_key=p_license_key AND ea_slug=v_license.ea_slug AND mt5_login=p_account_number FOR UPDATE;
  IF FOUND THEN
    IF v_seat.slot_type <> p_account_type THEN RETURN jsonb_build_object('success',false,'reason','This MT5 account is already bound under a different account type.'); END IF;
    RETURN jsonb_build_object('success',true,'already_bound',true,'account_number',p_account_number,'account_type',p_account_type,'rebind_available_at',v_seat.rebind_available_at);
  END IF;
  IF EXISTS (SELECT 1 FROM public.ea_license_seats WHERE mt5_login = p_account_number) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'This MT5 account is already assigned to another license or seat.');
  END IF;

  IF p_previous_account_number IS NOT NULL THEN
    SELECT * INTO v_seat FROM public.ea_license_seats WHERE license_key=p_license_key AND ea_slug=v_license.ea_slug
      AND slot_type=p_account_type AND mt5_login=p_previous_account_number FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','The account selected for replacement is not bound to this license.'); END IF;
    IF v_seat.rebind_available_at IS NOT NULL AND v_seat.rebind_available_at > now() THEN
      RETURN jsonb_build_object('success',false,'reason','The 72-hour re-binding cooldown has not elapsed.','rebind_available_at',v_seat.rebind_available_at);
    END IF;
    UPDATE public.ea_license_seats SET mt5_login=p_account_number,broker_server=nullif(trim(p_broker_server),''),bound_at=now(),
      rebind_available_at=now()+interval '72 hours',updated_at=now() WHERE id=v_seat.id;
    RETURN jsonb_build_object('success',true,'rebound',true,'account_number',p_account_number,'account_type',p_account_type,'rebind_available_at',now()+interval '72 hours');
  END IF;
  IF EXISTS(SELECT 1 FROM public.ea_license_seats WHERE slot_type=p_account_type AND mt5_login=p_account_number) THEN
    RETURN jsonb_build_object('success',false,'reason','This MT5 account is already assigned to another license.');
  END IF;
  v_slot_limit := CASE WHEN p_account_type='LIVE' THEN coalesce(v_license.included_live_seats,1)+coalesce(v_license.extra_live_seats,0) ELSE coalesce(v_license.included_demo_seats,2) END;
  SELECT count(*)::integer INTO v_seat_count FROM public.ea_license_seats WHERE license_key=p_license_key AND ea_slug=v_license.ea_slug AND slot_type=p_account_type AND mt5_login IS NOT NULL;
  IF v_seat_count >= v_slot_limit THEN
    RETURN jsonb_build_object('success',false,'reason',CASE WHEN p_account_type='LIVE' THEN 'All included LIVE seats are occupied.' ELSE 'All included DEMO seats are occupied.' END);
  END IF;
  SELECT * INTO v_seat FROM public.ea_license_seats WHERE license_key=p_license_key AND ea_slug=v_license.ea_slug AND slot_type=p_account_type AND mt5_login IS NULL ORDER BY slot_number LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.ea_license_seats SET mt5_login=p_account_number,broker_server=nullif(trim(p_broker_server),''),bound_at=now(),rebind_available_at=now()+interval '72 hours',updated_at=now() WHERE id=v_seat.id;
  ELSE
    INSERT INTO public.ea_license_seats(license_key,ea_slug,slot_type,slot_number,mt5_login,broker_server,bound_at,rebind_available_at)
    VALUES(p_license_key,v_license.ea_slug,p_account_type,v_seat_count+1,p_account_number,nullif(trim(p_broker_server),''),now(),now()+interval '72 hours');
  END IF;
  RETURN jsonb_build_object('success',true,'already_bound',false,'account_number',p_account_number,'account_type',p_account_type,'rebind_available_at',now()+interval '72 hours');
END;
$$;
REVOKE ALL ON FUNCTION public.bind_algolync_seat(text,bigint,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_algolync_seat(text,bigint,text,text,bigint) TO service_role;
