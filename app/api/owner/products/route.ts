import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic='force-dynamic';
const OWNER_EMAIL='ricorapier1@gmail.com';
const FIELDS='slug,name,tagline,version,category,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,demo_days,included_live_seats,included_demo_seats,metrics_json,ex5_artifact_url,is_active';

async function ownerAuthorized(request:Request) {
  const header=request.headers.get('authorization') || '';
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token) return false;
  const {data,error}=await getSupabaseAdmin().auth.getUser(token);
  return !error && data.user?.email?.toLowerCase()===OWNER_EMAIL;
}

export async function GET(request:Request) {
  if(!await ownerAuthorized(request)) return NextResponse.json({error:'Owner authorization required.'},{status:403});
  const {data,error}=await getSupabaseAdmin().from('ea_products').select(FIELDS).order('category').order('name');
  if(error) return NextResponse.json({error:'Catalog could not be loaded.'},{status:503});
  return NextResponse.json({products:data || []},{headers:{'Cache-Control':'no-store'}});
}

export async function PATCH(request:Request) {
  if(!await ownerAuthorized(request)) return NextResponse.json({error:'Owner authorization required.'},{status:403});
  try {
    const body=await request.json();
    const slug=String(body?.slug || '').trim().toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({error:'Valid product slug required.'},{status:400});
    const numeric=['monthly_price_ngn','monthly_price_usd','annual_price_ngn','annual_price_usd','extra_seat_price_ngn','extra_seat_price_usd','demo_days','included_live_seats','included_demo_seats'];
    const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
    for(const field of numeric) {
      if(body[field]===undefined) continue;
      const value=Number(body[field]);
      if(!Number.isFinite(value) || value<0 || (field==='demo_days' && (!Number.isInteger(value)||value<1||value>30)) || (field.includes('seats') && !Number.isInteger(value))) {
        return NextResponse.json({error:`Invalid value for ${field}.`},{status:400});
      }
      patch[field]=value;
    }
    if(body.tagline!==undefined) patch.tagline=String(body.tagline).slice(0,240);
    if(body.category!==undefined) patch.category=String(body.category).toUpperCase().slice(0,40);
    if(body.ex5_artifact_url!==undefined) {
      const url=String(body.ex5_artifact_url || '').trim();
      if(url && (!url.startsWith('https://') || !url.toLowerCase().includes('.ex5'))) return NextResponse.json({error:'Artifact URL must be HTTPS and point to an .ex5 file.'},{status:400});
      patch.ex5_artifact_url=url || null;
    }
    if(body.metrics_json!==undefined && body.metrics_json && typeof body.metrics_json==='object' && !Array.isArray(body.metrics_json)) patch.metrics_json=body.metrics_json;
    if(body.is_active!==undefined) {
      if(typeof body.is_active!=='boolean') return NextResponse.json({error:'is_active must be boolean.'},{status:400});
      if(body.is_active===true && !body.ex5_artifact_url) {
        const current=await getSupabaseAdmin().from('ea_products').select('ex5_artifact_url').eq('slug',slug).maybeSingle();
        if(!current.data?.ex5_artifact_url) return NextResponse.json({error:'Register a verified compiled .ex5 artifact before activating a commercial EA.'},{status:409});
      }
      patch.is_active=body.is_active;
    }
    const {data,error}=await getSupabaseAdmin().from('ea_products').update(patch).eq('slug',slug).select(FIELDS).maybeSingle();
    if(error || !data) return NextResponse.json({error:'Product update failed.'},{status:503});
    return NextResponse.json({success:true,product:data},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('Owner EA product update failed:',error);
    return NextResponse.json({error:'Invalid product update.'},{status:400});
  }
}
