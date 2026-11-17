import 'server-only';
import { randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

type Intent = {
  reference:string; email:string; ea_slug:string; billing_cycle:'MONTHLY'|'ANNUAL';
  currency:'NGN'|'USD'; extra_live_seats:number; amount_minor:number;
  paystack_plan_code:string; subscription_code:string|null; status:string;
};
type Subscription = {
  id:string; initial_reference:string; license_key:string; subscription_code:string|null;
  email:string; ea_slug:string; billing_cycle:'MONTHLY'|'ANNUAL'; currency:'NGN'|'USD';
  extra_live_seats:number; status:string; period_ends_at:string; amount_minor:number; paystack_plan_code:string|null;
};

function objectRecord(value: unknown): Record<string,unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
}

async function verifyPaystack(reference:string) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
    throw new Error('Paystack server processing is not enabled.');
  }
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{
    headers:{Authorization:`Bearer ${secret}`,Accept:'application/json'},
    cache:'no-store',signal:AbortSignal.timeout(12000),
  });
  const envelope = await response.json() as {status?:boolean;data?:Record<string,unknown>;message?:string};
  if(!response.ok || envelope.status !== true || !envelope.data || envelope.data.status !== 'success' || envelope.data.reference !== reference) {
    throw new Error(envelope.message || 'Paystack payment verification failed.');
  }
  return envelope.data;
}

function subscriptionCodeFrom(payment:Record<string,unknown>, explicit?:string|null) {
  if(explicit) return explicit;
  const subscription=objectRecord(payment.subscription);
  return String(subscription.subscription_code || payment.subscription_code || '') || null;
}

export async function provisionOrExtendLicense(referenceInput:string, explicitSubscriptionCode?:string|null) {
  if(!isSupabaseConfigured()) throw new Error('Supabase license authority is unavailable.');
  const reference=referenceInput.trim();
  if(!reference) throw new Error('Payment reference is required.');
  const payment=await verifyPaystack(reference);
  const intentRows=await supabaseRead<Intent[]>('ea_subscription_intents',
    `reference=eq.${encodeURIComponent(reference)}&select=reference,email,ea_slug,billing_cycle,currency,extra_live_seats,amount_minor,paystack_plan_code,subscription_code,status&limit=1`);
  const intent=intentRows?.[0] ?? null;
  const subscriptionCode=subscriptionCodeFrom(payment,explicitSubscriptionCode || intent?.subscription_code || null);
  let email:string,eaSlug:string,cycle:'MONTHLY'|'ANNUAL',currency:'NGN'|'USD',extraSeats:number,expectedAmount:number;
  if(intent) {
    email=intent.email;eaSlug=intent.ea_slug;cycle=intent.billing_cycle;currency=intent.currency;
    extraSeats=Number(intent.extra_live_seats);expectedAmount=Number(intent.amount_minor);
  } else if(subscriptionCode) {
    const rows=await supabaseRead<Subscription[]>('ea_subscriptions',
      `subscription_code=eq.${encodeURIComponent(subscriptionCode)}&select=id,initial_reference,license_key,subscription_code,email,ea_slug,billing_cycle,currency,extra_live_seats,status,period_ends_at,amount_minor,paystack_plan_code&limit=1`);
    const subscription=rows?.[0];
    if(!subscription) throw new Error('No matching AlgoLync subscription record exists for this payment.');
    email=subscription.email;eaSlug=subscription.ea_slug;cycle=subscription.billing_cycle;currency=subscription.currency;extraSeats=Number(subscription.extra_live_seats);
    expectedAmount=Number(subscription.amount_minor ?? 0);
  } else {
    throw new Error('No matching AlgoLync subscription intent or subscription code exists for this payment.');
  }
  const customer=objectRecord(payment.customer);
  const paidEmail=String(customer.email || '').trim().toLowerCase();
  if(!paidEmail || paidEmail!==email.toLowerCase()) throw new Error('Paystack payer email does not match the subscription intent.');
  if(payment.currency!==currency || Number(payment.amount)!==expectedAmount || expectedAmount<=0) {
    throw new Error('Verified payment amount or currency does not match the stored subscription price.');
  }
  const candidate=`ALGOLYNX-SUB-${randomBytes(8).toString('hex').toUpperCase()}`;
  const result=await supabaseQuery<Record<string,unknown>>('rpc/provision_or_extend_ea_subscription',{
    method:'POST',
    body:{
      p_reference:reference,p_subscription_code:subscriptionCode,p_email:email,p_ea_slug:eaSlug,
      p_billing_cycle:cycle,p_currency:currency,p_extra_live_seats:extraSeats,
      p_amount_minor:expectedAmount,p_license_key_candidate:candidate,
    },
  });
  if(!result || !result.license_key) throw new Error('Atomic subscription provisioning did not return a license.');
  return {...result,email,ea_slug:eaSlug};
}

export async function attachPaystackSubscription(subscriptionCode:string, customerEmail:string, planCode:string) {
  if(!isSupabaseConfigured() || !subscriptionCode) return false;
  const intents=await supabaseRead<Intent[]>('ea_subscription_intents',
    `email=eq.${encodeURIComponent(customerEmail.toLowerCase())}&paystack_plan_code=eq.${encodeURIComponent(planCode)}&status=in.(PENDING,ACTIVE)&select=reference,email,ea_slug,billing_cycle,currency,extra_live_seats,amount_minor,paystack_plan_code,subscription_code,status&order=created_at.desc&limit=5`);
  const intent=intents?.[0];
  if(!intent) return false;
  await supabaseQuery('ea_subscription_intents',{method:'PATCH',query:`reference=eq.${encodeURIComponent(intent.reference)}`,body:{subscription_code:subscriptionCode,updated_at:new Date().toISOString()}});
  const subs=await supabaseRead<Array<{id:string}>>('ea_subscriptions',`initial_reference=eq.${encodeURIComponent(intent.reference)}&select=id&limit=1`);
  if(subs?.[0]) await supabaseQuery('ea_subscriptions',{method:'PATCH',query:`id=eq.${encodeURIComponent(subs[0].id)}`,body:{subscription_code:subscriptionCode,updated_at:new Date().toISOString()}});
  return true;
}

export async function markSubscriptionPastDue(subscriptionCode:string) {
  const rows=await supabaseRead<Array<{id:string;license_key:string}>>('ea_subscriptions',`subscription_code=eq.${encodeURIComponent(subscriptionCode)}&select=id,license_key&limit=1`);
  const sub=rows?.[0]; if(!sub) return false;
  const grace=new Date(Date.now()+48*60*60*1000).toISOString();
  await supabaseQuery('ea_subscriptions',{method:'PATCH',query:`id=eq.${encodeURIComponent(sub.id)}`,body:{status:'PAST_DUE',grace_until:grace,renewal_reminder_due:true,updated_at:new Date().toISOString()}});
  await supabaseQuery('licenses',{method:'PATCH',query:`license_key=eq.${encodeURIComponent(sub.license_key)}`,body:{status:'PAST_DUE',grace_until:grace,renewal_reminder_due:true,updated_at:new Date().toISOString()}});
  return true;
}

export async function scheduleSubscriptionCancellation(subscriptionCode:string) {
  const rows=await supabaseRead<Array<{id:string;license_key:string;period_ends_at:string}>>('ea_subscriptions',`subscription_code=eq.${encodeURIComponent(subscriptionCode)}&select=id,license_key,period_ends_at&limit=1`);
  const sub=rows?.[0]; if(!sub) return false;
  await supabaseQuery('ea_subscriptions',{method:'PATCH',query:`id=eq.${encodeURIComponent(sub.id)}`,body:{status:'CANCEL_AT_PERIOD_END',cancel_at_period_end:true,updated_at:new Date().toISOString()}});
  await supabaseQuery('licenses',{method:'PATCH',query:`license_key=eq.${encodeURIComponent(sub.license_key)}`,body:{status:'CANCEL_AT_PERIOD_END',expires_at:sub.period_ends_at,period_ends_at:sub.period_ends_at,updated_at:new Date().toISOString()}});
  return true;
}
