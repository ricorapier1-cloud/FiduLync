CREATE OR REPLACE FUNCTION public.revoke_algolync_license(p_license_id uuid,p_owner_email text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_license public.licenses%ROWTYPE;
BEGIN
  IF p_license_id IS NULL OR p_owner_email IS NULL OR lower(p_owner_email)<>'ricorapier1@gmail.com'
     OR p_reason IS NULL OR length(trim(p_reason))<5 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Invalid licence revocation request'; END IF;
  SELECT * INTO v_license FROM public.licenses WHERE id=p_license_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','License was not found.'); END IF;
  IF lower(coalesce(v_license.status,''))='revoked' THEN RETURN jsonb_build_object('success',true,'already_revoked',true,'license_id',v_license.id); END IF;
  UPDATE public.licenses SET status='revoked' WHERE id=p_license_id;
  INSERT INTO public.fidulync_owner_audit(owner_email,action,subject_id,mt5_account,metadata)
  VALUES(lower(p_owner_email),'ALGOLYNC_LICENSE_REVOKED',p_license_id,v_license.mt5_account,
    jsonb_build_object('license_key_fingerprint',encode(digest(convert_to(v_license.license_key,'UTF8'),'sha256'),'hex'),
      'customer_email',v_license.email,'ea_slug',v_license.ea_slug,'previous_status',v_license.status,
      'reason',trim(p_reason),'revoked_at',now()));
  RETURN jsonb_build_object('success',true,'already_revoked',false,'license_id',p_license_id,'status','revoked');
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_algolync_license(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_algolync_license(uuid,text,text) TO service_role;
