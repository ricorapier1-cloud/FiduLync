create or replace function public.bind_ea_license_seat(
 p_license_key text,p_slot_type text,p_slot_number integer,p_current_mt5_login bigint,p_new_mt5_login bigint,p_broker_server text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_license public.licenses%rowtype; v_seat public.ea_license_seats%rowtype;
begin
 if p_slot_type not in ('LIVE','DEMO') or p_slot_number<1 or p_new_mt5_login<=0 then raise exception 'Invalid seat request'; end if;
 select * into v_license from public.licenses where license_key=upper(trim(p_license_key)) for update;
 if not found then raise exception 'License not found'; end if;
 if upper(coalesce(v_license.status,''))<>'ACTIVE' and not (upper(coalesce(v_license.status,''))='PAST_DUE' and v_license.grace_until>now()) then raise exception 'License is not active'; end if;
 if v_license.expires_at is not null and v_license.expires_at<=now() and not (upper(coalesce(v_license.status,''))='PAST_DUE' and v_license.grace_until>now()) then raise exception 'License has expired'; end if;
 if v_license.ea_slug is null then raise exception 'Legacy license requires EA mapping'; end if;
 insert into public.ea_license_seats(license_key,ea_slug,slot_type,slot_number)
 select v_license.license_key,v_license.ea_slug,'LIVE',n from generate_series(1,coalesce(v_license.included_live_seats,1)+coalesce(v_license.extra_live_seats,0)) n on conflict(license_key,slot_type,slot_number) do nothing;
 insert into public.ea_license_seats(license_key,ea_slug,slot_type,slot_number)
 select v_license.license_key,v_license.ea_slug,'DEMO',n from generate_series(1,coalesce(v_license.included_demo_seats,2)) n on conflict(license_key,slot_type,slot_number) do nothing;
 select * into v_seat from public.ea_license_seats where license_key=v_license.license_key and slot_type=p_slot_type and slot_number=p_slot_number for update;
 if not found then raise exception 'Seat slot does not exist'; end if;
 if v_seat.mt5_login is null and p_current_mt5_login is not null then raise exception 'This seat is not currently bound'; end if;
 if v_seat.mt5_login is not null and (p_current_mt5_login is null or v_seat.mt5_login<>p_current_mt5_login) then raise exception 'Current MT5 login does not match this slot'; end if;
 if v_seat.mt5_login is not null and v_seat.rebind_available_at is not null and v_seat.rebind_available_at>now() then raise exception 'Seat rebind cooldown is active until %',v_seat.rebind_available_at; end if;
 if v_seat.mt5_login=p_new_mt5_login then return jsonb_build_object('success',true,'unchanged',true,'slot_type',p_slot_type,'slot_number',p_slot_number,'mt5_login',p_new_mt5_login,'rebind_available_at',v_seat.rebind_available_at); end if;
 update public.ea_license_seats set mt5_login=p_new_mt5_login,broker_server=nullif(trim(coalesce(p_broker_server,'')),''),bound_at=now(),rebind_available_at=now()+interval '72 hours',updated_at=now() where id=v_seat.id;
 return jsonb_build_object('success',true,'slot_type',p_slot_type,'slot_number',p_slot_number,'mt5_login',p_new_mt5_login,'rebind_available_at',now()+interval '72 hours');
end; $$;
revoke all on function public.bind_ea_license_seat(text,text,integer,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.bind_ea_license_seat(text,text,integer,bigint,bigint,text) to service_role;
