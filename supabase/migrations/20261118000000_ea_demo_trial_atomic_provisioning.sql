-- Atomic, anti-abuse demo trial provisioning. The unique constraints on ea_demo_trials
-- enforce one trial per normalized email/EA and one trial per MT5 login globally.
create or replace function public.provision_ea_demo_trial(
  p_email text,
  p_ea_slug text,
  p_mt5_login bigint,
  p_license_key text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.ea_products%rowtype;
begin
  if p_email is null or length(trim(p_email)) < 5
     or p_ea_slug is null or p_mt5_login is null or p_mt5_login <= 0
     or p_license_key is null or p_expires_at <= now() then
    raise exception 'Invalid demo trial input';
  end if;

  select * into v_product
  from public.ea_products
  where slug = p_ea_slug and is_active = true
  for share;

  if not found then raise exception 'EA product is unavailable'; end if;
  if v_product.ex5_artifact_url is null or trim(v_product.ex5_artifact_url) = '' then
    raise exception 'A release-approved EX5 artifact is not available for this EA';
  end if;

  insert into public.licenses (
    license_key, mt5_account, email, tier, status, expires_at,
    ea_slug, account_mode, included_live_seats, included_demo_seats, extra_live_seats
  ) values (
    upper(trim(p_license_key)), p_mt5_login, lower(trim(p_email)),
    'DEMO_TRIAL', 'ACTIVE', p_expires_at,
    p_ea_slug, 'DEMO', 0, 1, 0
  );

  insert into public.ea_demo_trials(email, ea_slug, mt5_login, license_key, expires_at)
  values (lower(trim(p_email)), p_ea_slug, p_mt5_login, upper(trim(p_license_key)), p_expires_at);

  return jsonb_build_object(
    'success', true,
    'license_key', upper(trim(p_license_key)),
    'ea_slug', p_ea_slug,
    'mt5_login', p_mt5_login,
    'expires_at', p_expires_at,
    'artifact_url', v_product.ex5_artifact_url
  );
end;
$$;

-- SECURITY DEFINER functions in public must never inherit PUBLIC execute.
revoke all on function public.provision_ea_demo_trial(text,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function public.provision_ea_demo_trial(text,text,bigint,text,timestamptz) to service_role;
