import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseInsert, supabaseRead } from '@/lib/supabaseAdmin';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';
type Currency = 'NGN' | 'USD';
type Cycle = 'MONTHLY' | 'ANNUAL';

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 12, 60_000)) return NextResponse.json({ success:false,error:'Too many checkout attempts.' },{status:429});
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
    return NextResponse.json({ success:false,error:'Paystack subscriptions are not enabled for this environment.' },{status:503});
  }
  if (!isSupabaseConfigured()) return NextResponse.json({success:false,error:'Subscription catalog unavailable.'},{status:503});
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const eaSlug = String(body?.ea_slug ?? '').trim().toLowerCase();
    const cycle: Cycle = body?.billing_cycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    const currency: Currency = body?.currency === 'USD' ? 'USD' : 'NGN';
    const extraSeats = Number(body?.extra_live_seats ?? 0);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug) || ![0,1,3,5].includes(extraSeats)) {
      return NextResponse.json({success:false,error:'Valid email, EA slug and supported extra-seat quantity are required.'},{status:400});
    }
    const products = await supabaseRead<Array<Record<string, unknown>>>('ea_products',
      `slug=eq.${encodeURIComponent(eaSlug)}&select=slug,name,is_active,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,included_live_seats,included_demo_seats&limit=1`);
    const product = products?.[0];
    const artifact = product ? await getSupabaseAdmin().from('ea_product_artifacts').select('release_approved,storage_path,sha256,size_bytes').eq('ea_slug',eaSlug).maybeSingle() : null;
    if (!product || product.is_active !== true || eaSlug === 'macro-atr-breakout' || !artifact?.data?.release_approved || !artifact.data.storage_path || !artifact.data.sha256 || !artifact.data.size_bytes) {
      return NextResponse.json({success:false,error:'This commercial EA is not approved for sale yet or its compiled .ex5 release artifact is missing or unapproved.'},{status:409});
    }
    const monthlyBase = currency === 'NGN' ? Number(product.monthly_price_ngn) : Number(product.monthly_price_usd);
    const annualBase = currency === 'NGN' ? Number(product.annual_price_ngn) : Number(product.annual_price_usd);
    if (cycle === 'ANNUAL' && (annualBase <= 0 || annualBase > monthlyBase * 10)) {
      return NextResponse.json({success:false,error:'Annual pricing must be positive and cannot exceed ten monthly payments (two months free). Update the owner catalog first.'},{status:409});
    }
    const base = cycle === 'MONTHLY' ? monthlyBase : annualBase;
    const seatMonthly = currency === 'NGN' ? Number(product.extra_seat_price_ngn) : Number(product.extra_seat_price_usd);
    const seatPrice = cycle === 'ANNUAL' ? seatMonthly * 10 : seatMonthly;
    const amountMinor = Math.round((base + seatPrice * extraSeats) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return NextResponse.json({success:false,error:'Invalid subscription amount.'},{status:400});

    const planQuery = `ea_slug=eq.${encodeURIComponent(eaSlug)}&billing_cycle=eq.${cycle}&currency=eq.${currency}&extra_live_seats=eq.${extraSeats}&amount_minor=eq.${amountMinor}&select=paystack_plan_code,amount_minor&limit=1`;
    let plans = await supabaseRead<Array<{paystack_plan_code:string;amount_minor:number}>>('paystack_subscription_plans',planQuery);
    let plan = plans?.[0];
    if (!plan) {
      const planResponse = await fetch('https://api.paystack.co/plan',{
        method:'POST',
        headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
        body:JSON.stringify({name:`AlgoLync ${String(product.name)} ${cycle} ${currency} +${extraSeats} seats`,interval:cycle==='MONTHLY'?'monthly':'annually',amount:amountMinor,currency}),
        cache:'no-store',signal:AbortSignal.timeout(12000),
      });
      const planEnvelope = await planResponse.json() as {status?:boolean;message?:string;data?:{plan_code?:string}};
      if(!planResponse.ok || !planEnvelope.status || !planEnvelope.data?.plan_code) {
        return NextResponse.json({success:false,error:planEnvelope.message || 'Paystack could not create a recurring plan.'},{status:502});
      }
      try {
        const saved = await supabaseInsert<{paystack_plan_code:string}>('paystack_subscription_plans',{
          ea_slug:eaSlug,billing_cycle:cycle,currency,extra_live_seats:extraSeats,amount_minor:amountMinor,paystack_plan_code:planEnvelope.data.plan_code,
        });
        plan = saved?.[0] ?? {paystack_plan_code:planEnvelope.data.plan_code,amount_minor:amountMinor};
      } catch {
        plans = await supabaseRead<Array<{paystack_plan_code:string;amount_minor:number}>>('paystack_subscription_plans',planQuery);
        plan = plans?.[0];
        if (!plan) throw new Error('Paystack plan could not be registered.');
      }
    }
    const reference = `ALY_SUB_${randomBytes(12).toString('hex').toUpperCase()}`;
    await supabaseInsert('ea_subscription_intents', {
      reference,email,ea_slug:eaSlug,billing_cycle:cycle,currency,extra_live_seats:extraSeats,
      amount_minor:amountMinor,paystack_plan_code:plan.paystack_plan_code,status:'PENDING',
    });
    const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://fidulync.vercel.app').replace(/\/+$/,'');
    const initialized = await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',
      headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        email,amount:amountMinor,currency,reference,plan:plan.paystack_plan_code,
        callback_url:`${origin}/portal?subscription_ref=${encodeURIComponent(reference)}`,
        metadata:{product:'ALGOLYNC_SUBSCRIPTION',ea_slug:eaSlug,billing_cycle:cycle,currency,extra_live_seats:extraSeats,included_live_seats:Number(product.included_live_seats ?? 1),included_demo_seats:Number(product.included_demo_seats ?? 2),email},
      }),
      cache:'no-store',signal:AbortSignal.timeout(12000),
    });
    const envelope = await initialized.json() as {status?:boolean;message?:string;data?:{authorization_url?:string}};
    if(!initialized.ok || !envelope.status || !envelope.data?.authorization_url) return NextResponse.json({success:false,error:envelope.message || 'Paystack checkout initialization failed.'},{status:502});
    return NextResponse.json({success:true,authorization_url:envelope.data.authorization_url,reference,currency,amount_minor:amountMinor,billing_cycle:cycle,extra_live_seats:extraSeats,plan_code:plan.paystack_plan_code});
  } catch(error) {
    console.error('AlgoLync recurring checkout failed:',error);
    return NextResponse.json({success:false,error:'Subscription checkout is temporarily unavailable.'},{status:503});
  }
}
