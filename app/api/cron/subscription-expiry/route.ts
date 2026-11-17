import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic='force-dynamic';

export async function GET(request:Request) {
  const secret=process.env.CRON_SECRET?.trim() ?? '';
  const auth=request.headers.get('authorization') ?? '';
  if(!secret || auth!==`Bearer ${secret}`) return NextResponse.json({error:'Unauthorized.'},{status:401});
  if(!isSupabaseConfigured()) return NextResponse.json({error:'Subscription authority unavailable.'},{status:503});
  const now=new Date().toISOString();
  try {
    const due=await supabaseRead<Array<{id:string;license_key:string}>>('ea_subscriptions',
      `cancel_at_period_end=eq.true&period_ends_at=lte.${encodeURIComponent(now)}&status=eq.CANCEL_AT_PERIOD_END&select=id,license_key&limit=500`);
    for(const item of due || []) {
      await supabaseQuery('ea_subscriptions',{method:'PATCH',query:`id=eq.${encodeURIComponent(item.id)}`,body:{status:'REVOKED',updated_at:now}});
      await supabaseQuery('licenses',{method:'PATCH',query:`license_key=eq.${encodeURIComponent(item.license_key)}`,body:{status:'REVOKED',updated_at:now}});
    }
    return NextResponse.json({success:true,revoked:(due||[]).length,checked_at:now});
  } catch(error) {
    console.error('Subscription expiry cron failed:',error);
    return NextResponse.json({error:'Subscription expiry job failed.'},{status:503});
  }
}
