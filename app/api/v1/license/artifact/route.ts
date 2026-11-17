import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic='force-dynamic';

export async function POST(request:Request) {
  const headers={'Cache-Control':'no-store, max-age=0'};
  if(!checkRateLimit(getClientIp(request),20,60_000)) return NextResponse.json({error:'Download rate limit exceeded.'},{status:429,headers});
  if(!isSupabaseConfigured()) return NextResponse.json({error:'License authority unavailable.'},{status:503,headers});
  try {
    const body=await request.json();
    const key=String(body?.license_key??'').trim().toUpperCase();
    const login=Number(body?.mt5_login??0);
    const mode=String(body?.account_mode??'').toUpperCase();
    const slug=String(body?.ea_slug??'').trim().toLowerCase();
    if(!key||!Number.isSafeInteger(login)||login<=0||!['DEMO','REAL'].includes(mode)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({error:'License, MT5 login, account mode and EA slug are required.'},{status:400,headers});
    }
    if(key.startsWith('ALGOLYNX-DEMO-')) {
      if(mode!=='DEMO') return NextResponse.json({error:'Demo keys cannot download commercial artifacts for real accounts.'},{status:403,headers});
      const trials=await supabaseRead<Array<{expires_at:string}>>('ea_demo_trials',`license_key=eq.${encodeURIComponent(key)}&mt5_login=eq.${login}&ea_slug=eq.${encodeURIComponent(slug)}&select=expires_at&limit=1`);
      if(!trials?.[0]||Date.parse(trials[0].expires_at)<=Date.now()) return NextResponse.json({error:'Demo license is invalid or expired.'},{status:403,headers});
    } else {
      const licenses=await supabaseRead<Array<{status:string;ea_slug:string;expires_at:string|null;grace_until:string|null}>>('licenses',`license_key=eq.${encodeURIComponent(key)}&select=status,ea_slug,expires_at,grace_until&limit=1`);
      const license=licenses?.[0];
      if(!license||license.ea_slug!==slug) return NextResponse.json({error:'License does not authorize this EA.'},{status:403,headers});
      const status=String(license.status).toUpperCase();
      const grace=license.grace_until?Date.parse(license.grace_until):0;
      if(!['ACTIVE','PAST_DUE','CANCEL_AT_PERIOD_END'].includes(status)||(license.expires_at&&Date.parse(license.expires_at)<=Date.now()&&!(status==='PAST_DUE'&&grace>Date.now()))) {
        return NextResponse.json({error:'Subscription is not entitled to download this artifact.'},{status:403,headers});
      }
      const slotType=mode==='REAL'?'LIVE':'DEMO';
      const seats=await supabaseRead<Array<{mt5_login:number}>>('ea_license_seats',`license_key=eq.${encodeURIComponent(key)}&mt5_login=eq.${login}&slot_type=eq.${slotType}&select=mt5_login&limit=1`);
      const legacy=seats?.length?[]:await supabaseRead<Array<{account_number:number;account_type:string}>>('license_bound_accounts',`license_key=eq.${encodeURIComponent(key)}&account_number=eq.${login}&select=account_number,account_type&limit=1`);
      if(!seats?.length&&!legacy?.some(row=>row.account_type===slotType)) return NextResponse.json({error:'MT5 account is not bound to this license.'},{status:403,headers});
    }
    const artifact=await getSupabaseAdmin().from('ea_product_artifacts').select('storage_path,release_approved').eq('ea_slug',slug).maybeSingle();
    if(!artifact.data?.release_approved||!artifact.data.storage_path) return NextResponse.json({error:'Approved compiled artifact is not available.'},{status:404,headers});
    const signed=await getSupabaseAdmin().storage.from('algolync-artifacts').createSignedUrl(artifact.data.storage_path,600);
    if(signed.error||!signed.data?.signedUrl) return NextResponse.json({error:'Artifact download could not be authorized.'},{status:503,headers});
    return NextResponse.json({success:true,download_url:signed.data.signedUrl,expires_in_seconds:600},{headers});
  } catch(error) {
    console.error('Private EA artifact download failed:',error);
    return NextResponse.json({error:'Artifact download is temporarily unavailable.'},{status:503,headers});
  }
}
