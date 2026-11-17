import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = {'Cache-Control':'no-store, max-age=0'};
  if (!checkRateLimit(getClientIp(request),12,60_000)) return NextResponse.json({success:false,error:'Too many seat changes. Try later.'},{status:429,headers});
  if (!isSupabaseConfigured()) return NextResponse.json({success:false,error:'Seat authority unavailable.'},{status:503,headers});
  try {
    const body = await request.json();
    const licenseKey = String(body?.license_key ?? '').trim().toUpperCase();
    const slotType = String(body?.slot_type ?? '').toUpperCase();
    const slotNumber = Number(body?.slot_number ?? 0);
    const currentRaw = body?.current_mt5_login;
    const currentLogin = currentRaw === null || currentRaw === undefined || currentRaw === '' ? null : Number(currentRaw);
    const newLogin = Number(body?.new_mt5_login ?? 0);
    const broker = String(body?.broker_server ?? '').trim().slice(0,120);
    if (!licenseKey || !['LIVE','DEMO'].includes(slotType) || !Number.isSafeInteger(slotNumber) || slotNumber < 1
      || !Number.isSafeInteger(newLogin) || newLogin <= 0
      || (currentLogin !== null && (!Number.isSafeInteger(currentLogin) || currentLogin <= 0))) {
      return NextResponse.json({success:false,error:'Invalid license seat details.'},{status:400,headers});
    }
    const result = await supabaseQuery<Record<string,unknown>>('rpc/bind_ea_license_seat',{
      method:'POST',
      body:{
        p_license_key:licenseKey,p_slot_type:slotType,p_slot_number:slotNumber,
        p_current_mt5_login:currentLogin,p_new_mt5_login:newLogin,p_broker_server:broker || null,
      },
    });
    return NextResponse.json(result ?? {success:true},{status:200,headers});
  } catch(error) {
    const message = error instanceof Error ? error.message : 'Seat binding failed.';
    const status = /cooldown|current mt5|seat slot|already exists|duplicate/i.test(message) ? 409 : 403;
    return NextResponse.json({success:false,error:message.replace(/^Supabase .* error \(\d+\): /,'' )},{status,headers});
  }
}
