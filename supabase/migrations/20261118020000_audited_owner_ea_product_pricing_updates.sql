create or replace function public.owner_update_ea_product_pricing(
  p_slug text,p_owner_email text,p_monthly_price_ngn bigint,p_monthly_price_usd numeric,
  p_annual_price_ngn bigint,p_annual_price_usd numeric,p_extra_seat_price_ngn bigint,
  p_extra_seat_price_usd numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_product public.ea_products%rowtype;
begin
  if lower(trim(coalesce(p_owner_email,''))) <> 'ricorapier1@gmail.com' then raise exception 'Owner authorization required'; end if;
  if p_monthly_price_ngn < 0 or p_monthly_price_usd < 0 or p_annual_price_ngn < 0
     or p_annual_price_usd < 0 or p_extra_seat_price_ngn < 0 or p_extra_seat_price_usd < 0 then
    raise exception 'Pricing values cannot be negative';
  end if;
  if p_annual_price_ngn <> p_monthly_price_ngn * 10 or abs(p_annual_price_usd-p_monthly_price_usd*10)>0.01 then
    raise exception 'Annual pricing must equal ten monthly payments';
  end if;
  select * into v_product from public.ea_products where slug=p_slug for update;
  if not found then raise exception 'EA product not found'; end if;
  update public.ea_products set monthly_price_ngn=p_monthly_price_ngn,
    monthly_price_usd=round(p_monthly_price_usd,2),annual_price_ngn=p_annual_price_ngn,
    annual_price_usd=round(p_annual_price_usd,2),extra_seat_price_ngn=p_extra_seat_price_ngn,
    extra_seat_price_usd=round(p_extra_seat_price_usd,2),updated_at=now() where slug=p_slug;
  insert into public.fidulync_owner_audit(owner_email,action,metadata)
  values(lower(trim(p_owner_email)),'EA_PRODUCT_PRICING_UPDATED',jsonb_build_object(
    'slug',p_slug,
    'previous',jsonb_build_object('monthly_price_ngn',v_product.monthly_price_ngn,'monthly_price_usd',v_product.monthly_price_usd,'annual_price_ngn',v_product.annual_price_ngn,'annual_price_usd',v_product.annual_price_usd,'extra_seat_price_ngn',v_product.extra_seat_price_ngn,'extra_seat_price_usd',v_product.extra_seat_price_usd),
    'updated',jsonb_build_object('monthly_price_ngn',p_monthly_price_ngn,'monthly_price_usd',round(p_monthly_price_usd,2),'annual_price_ngn',p_annual_price_ngn,'annual_price_usd',round(p_annual_price_usd,2),'extra_seat_price_ngn',p_extra_seat_price_ngn,'extra_seat_price_usd',round(p_extra_seat_price_usd,2))
  ));
  return jsonb_build_object('success',true,'slug',p_slug);
end;
$$;
revoke all on function public.owner_update_ea_product_pricing(text,text,bigint,numeric,bigint,numeric,bigint,numeric) from public,anon,authenticated;
grant execute on function public.owner_update_ea_product_pricing(text,text,bigint,numeric,bigint,numeric,bigint,numeric) to service_role;
