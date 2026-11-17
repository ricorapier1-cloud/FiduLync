import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { provisionOrExtendLicense, attachPaystackSubscription, markSubscriptionPastDue, scheduleSubscriptionCancellation } from '@/lib/provisionOrExtendLicense';
import { provisionLicenseForReference } from '@/lib/provisionLicense';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret=process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if(!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED!=='true') || !isSupabaseConfigured()) {
    return NextResponse.json({error:'Payment webhook is not configured.'},{status:503});
  }
  const raw=await request.text();
  const signature=request.headers.get('x-paystack-signature') ?? '';
  if(!/^[a-f0-9]{128}$/i.test(signature)) return NextResponse.json({error:'Invalid webhook signature.'},{status:401});
  const expected=createHmac('sha512',secret).update(raw).digest();
  const supplied=Buffer.from(signature,'hex');
  if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return NextResponse.json({error:'Invalid webhook signature.'},{status:401});
  let payload:unknown;
  try { payload=JSON.parse(raw); } catch { return NextResponse.json({error:'Invalid JSON payload.'},{status:400}); }
  if(!payload || typeof payload!=='object' || Array.isArray(payload)) return NextResponse.json({error:'Invalid webhook payload.'},{status:400});
  const event=payload as Record<string,unknown>;
  const type=String(event.event ?? '');
  const data=event.data && typeof event.data==='object' ? event.data as Record<string,unknown> : {};
  const reference=typeof data.reference==='string'?data.reference:'';
  const subscription= data.subscription && typeof data.subscription==='object' ? data.subscription as Record<string,unknown> : {};
  const subscriptionCode=String(data.subscription_code || subscription.subscription_code || '') || null;
  const customer=data.customer && typeof data.customer==='object' ? data.customer as Record<string,unknown> : {};
  const email=String(customer.email || '');
  const plan=data.plan && typeof data.plan==='object' ? data.plan as Record<string,unknown> : {};
  const planCode=String(plan.plan_code || data.plan_code || '');
  const eventId=createHash('sha256').update(raw).digest('hex');

  try {
    const prior=await supabaseRead<Array<{processed_at:string|null}>>('paystack_webhook_events',`event_id=eq.${eventId}&select=processed_at&limit=1`);
    if(prior?.[0]?.processed_at) return NextResponse.json({status:'duplicate_ignored'},{status:200});
    if(!prior?.length) {
      try { await supabaseInsert('paystack_webhook_events',{event_id:eventId,event_type:type,reference:reference||null,payload_hash:eventId}); }
      catch {
        const retry=await supabaseRead<Array<{processed_at:string|null}>>('paystack_webhook_events',`event_id=eq.${eventId}&select=processed_at&limit=1`);
        if(retry?.[0]?.processed_at) return NextResponse.json({status:'duplicate_ignored'},{status:200});
      }
    }

    let result:unknown={status:'ignored'};
    if(type==='charge.success' && reference.startsWith('ALY_SUB_')) {
      result=await provisionOrExtendLicense(reference,subscriptionCode);
    } else if(type==='charge.success' && reference) {
      result=await provisionLicenseForReference(reference);
    } else if(type==='subscription.create' && subscriptionCode && email && planCode) {
      result={subscription_attached:await attachPaystackSubscription(subscriptionCode,email,planCode)};
    } else if(type==='invoice.payment_failed' && subscriptionCode) {
      result={past_due:await markSubscriptionPastDue(subscriptionCode)};
    } else if(type==='subscription.disable' && subscriptionCode) {
      result={cancellation_scheduled:await scheduleSubscriptionCancellation(subscriptionCode)};
    } else if(type==='invoice.payment_success' && reference && subscriptionCode) {
      result=await provisionOrExtendLicense(reference,subscriptionCode);
    }
    await supabaseQuery('paystack_webhook_events',{method:'PATCH',query:`event_id=eq.${eventId}`,body:{processed_at:new Date().toISOString(),processing_error:null}});
    return NextResponse.json({status:'processed',event:type,result},{status:200});
  } catch(error) {
    const message=error instanceof Error?error.message:'Webhook processing failed.';
    await supabaseQuery('paystack_webhook_events',{method:'PATCH',query:`event_id=eq.${eventId}`,body:{processing_error:message}});
    console.error('Paystack subscription webhook processing failed:',{event:type,reference,error:message});
    return NextResponse.json({error:'Webhook processing failed; Paystack may retry this event.'},{status:503});
  }
}
