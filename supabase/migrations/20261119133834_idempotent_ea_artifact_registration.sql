CREATE OR REPLACE FUNCTION public.record_ea_product_artifact_upload(
  p_ea_slug text,
  p_storage_path text,
  p_sha256 text,
  p_size_bytes bigint,
  p_artifact_version text,
  p_owner_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.ea_products%ROWTYPE;
  v_artifact public.ea_product_artifacts%ROWTYPE;
BEGIN
  IF p_ea_slug IS NULL OR p_ea_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     OR p_storage_path IS NULL OR p_sha256 IS NULL OR p_sha256 !~ '^[A-Fa-f0-9]{64}$'
     OR p_size_bytes IS NULL OR p_size_bytes <= 0 OR p_size_bytes > 26214400
     OR p_artifact_version IS NULL OR p_artifact_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$'
     OR p_owner_email IS NULL OR position('@' in p_owner_email) < 2
     OR p_storage_path <> p_ea_slug || '/' || p_artifact_version || '/' || lower(p_sha256) || '.ex5'
  THEN RAISE EXCEPTION 'Invalid EA artifact upload metadata'; END IF;

  SELECT * INTO v_product FROM public.ea_products
  WHERE slug = p_ea_slug AND is_active = true FOR SHARE;
  IF NOT FOUND OR v_product.category = 'SANDBOX' THEN
    RAISE EXCEPTION 'EA product is not eligible for commercial release';
  END IF;

  INSERT INTO public.ea_product_artifacts (
    ea_slug, storage_path, sha256, size_bytes, artifact_version,
    release_approved, approved_at, updated_at
  )
  VALUES (p_ea_slug, p_storage_path, lower(p_sha256), p_size_bytes, p_artifact_version, false, NULL, now())
  ON CONFLICT (ea_slug) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    sha256 = EXCLUDED.sha256,
    size_bytes = EXCLUDED.size_bytes,
    artifact_version = EXCLUDED.artifact_version,
    release_approved = CASE
      WHEN public.ea_product_artifacts.storage_path = EXCLUDED.storage_path
       AND public.ea_product_artifacts.sha256 = EXCLUDED.sha256
       AND public.ea_product_artifacts.size_bytes = EXCLUDED.size_bytes
       AND public.ea_product_artifacts.artifact_version = EXCLUDED.artifact_version
      THEN public.ea_product_artifacts.release_approved
      ELSE false
    END,
    approved_at = CASE
      WHEN public.ea_product_artifacts.storage_path = EXCLUDED.storage_path
       AND public.ea_product_artifacts.sha256 = EXCLUDED.sha256
       AND public.ea_product_artifacts.size_bytes = EXCLUDED.size_bytes
       AND public.ea_product_artifacts.artifact_version = EXCLUDED.artifact_version
      THEN public.ea_product_artifacts.approved_at
      ELSE NULL
    END,
    updated_at = now()
  RETURNING * INTO v_artifact;

  INSERT INTO public.fidulync_owner_audit (
    owner_email, action, subject_id, mt5_account, metadata, created_at
  )
  VALUES (
    lower(p_owner_email), 'EA_ARTIFACT_UPLOADED', NULL, NULL,
    jsonb_build_object(
      'ea_slug', p_ea_slug, 'storage_path', p_storage_path,
      'sha256', lower(p_sha256), 'size_bytes', p_size_bytes,
      'artifact_version', p_artifact_version,
      'release_approved', v_artifact.release_approved
    ), now()
  );

  RETURN jsonb_build_object(
    'ea_slug', v_artifact.ea_slug, 'artifact_version', v_artifact.artifact_version,
    'sha256', v_artifact.sha256, 'size_bytes', v_artifact.size_bytes,
    'release_approved', v_artifact.release_approved,
    'approved_at', v_artifact.approved_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ea_product_artifact_upload(text,text,text,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ea_product_artifact_upload(text,text,text,bigint,text,text) TO service_role;
