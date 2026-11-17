import 'server-only';
import { randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

type Intent = {
  reference:string; email:string; ea_slug:string; billing_cycle:'MONTHLY'|'ANNUAL';
  currency:'NGN'|'USD'; extra_live_seats:number; amount_minor:number;
  paystack_plan_code:string; subscription_code:string|null; status:string;
};
type Subscription = {
  id:string; initial_reference:string; license_key:string; subscription_code:string|null;
  email:string; ea_slug:string; billing_cycle:'MONTHLY'|'ANNUAL'; currency:'NGN'|'USD';
  extra_live_seats:number; status:string; period_ends_at:string;
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
  let subscription:Subscription|null=null;
  if(subscriptionCode) {
    const rows=await supabaseRead<Subscription[]>('ea_subscriptions',
      `subscription_code=eq.${encodeURIComponent(subscriptionCode)}&select=id,initial_reference,license_key,subscription_code,email,ea_slug,billing_cycle,currency,extra_live_seats,status,period_ends_at&limit=1`);
    subscription=rows?.[0] ?? null;
  }
  if(!subscription && intent) {
    const rows=await supabaseRead<Subscription[]>('ea_subscriptions',
      `initial_reference=eq.${encodeURIComponent(intent.reference)}&select=id,initial_reference,license_key,subscription_code,email,ea_slug,billing_cycle,currency,extra_live_seats,status,period_ends_at&limit=1`);
    subscription=rows?.[0] ?? null;
  }
  const prior=await supabaseRead<Array<{reference:string;subscription_id:string}>>('ea_subscription_payments',
    `reference=eq.${encodeURIComponent(reference)}&select=reference,subscription_id&limit=1`);
  if(prior?.[0]) return {license_key:subscription?.license_key ?? null,created:false,idempotent_replay:true,period_ends_at:subscription?.period_ends_at ?? null};

  let email:string, eaSlug:string, cycle:'MONTHLY'|'ANNUAL', currency:'NGN'|'USD', extraSeats:number, expectedAmount:number;
  if(subscription) {
    email=subscription.email; eaSlug=subscription.ea_slug; cycle=subscription.billing_cycle; currency=subscription.currency; extraSeats=subscription.extra_live_seats;
    const plans=await supabaseRead<Array<{amount_minor:number}>>('paystack_subscription_plans',
      `ea_slug=eq.${encodeURIComponent(eaSlug)}&billing_cycle=eq.${cycle}&currency=eq.${currency}&extra_live_seats=eq.${extraSeats}&select=amount_minor&limit=1`);
    expectedAmount=Number(plans?.[0]?.amount_minor ?? 0);
  } else if(intent) {
    email=intent.email; eaSlug=intent.ea_slug; cycle=intent.billing_cycle; currency=intent.currency; extraSeats=intent.extra_live_seats; expectedAmount=Number(intent.amount_minor);
  } else {
    throw new Error('No matching AlgoLync subscription intent or subscription record exists for this payment.');
  }
  if(payment.currency !== currency || Number(payment.amount) !== expectedAmount || expectedAmount <= 0) {
    throw new Error('Verified payment amount or currency does not match the stored subscription price.');
  }

  const now=new Date();
  const periodStart=subscription && new Date(subscription.period_ends_at).getTime()>now.getTime() ? new Date(subscription.period_ends_at) : now;
  const days=cycle==='ANNUAL'?365:30;
  const periodEnd=new Date(periodStart.getTime()+days*86400000);
  let licenseKey:string;
  let subscriptionId:string;
  if(subscription) {
    licenseKey=subscription.license_key;
    subscriptionId=subscription.id;
    await supabaseQuery('ea_subscriptions',{
      method:'PATCH',query:`id=eq.${encodeURIComponent(subscription.id)}`,
      body:{period_ends_at:periodEnd.toISOString(),status:'ACTIVE',grace_until:null,renewal_reminder_due:false,cancel_at_period_end:false,subscription_code:subscriptionCode || subscription.subscription_code,updated_at:now.toISOString()},
    });
    await supabaseQuery('licenses',{
      method:'PATCH',query:`license_key=eq.${encodeURIComponent(licenseKey)}`,
      body:{status:'ACTIVE',expires_at:periodEnd.toISOString(),period_ends_at:periodEnd.toISOString(),grace_until:null,renewal_reminder_due:false,paystack_subscription_code:subscriptionCode || subscription.subscription_code,updated_at:now.toISOString()},
    });
  } else {
    const licenseCandidate=`ALGOLYNX-SUB-${randomBytes(8).toString('hex').toUpperCase()}`;
    const provisioned=await supabaseQuery<Record<string,unknown>|Array<Record<string,unknown>>>('rpc/provision_algolync_license',{
      method:'POST',body:{
        p_payment_reference:reference,p_license_key:licenseCandidate,p_mt5_account:null,p_email:email,
        p_tier:'INSTITUTIONAL_SUBSCRIPTION',p_expires_at:periodEnd.toISOString(),
      },
    });
    const record=Array.isArray(provisioned)?provisioned[0]:provisioned;
    licenseKey=String(record?.license_key || licenseCandidate);
    await supabaseQuery('licenses',{
      method:'PATCH',query:`license_key=eq.${encodeURIComponent(licenseKey)}`,
      body:{
        ea_slug:eaSlug,billing_cycle:cycle,currency,included_live_seats:1,included_demo_seats:2,
        extra_live_seats:extraSeats,status:'ACTIVE',expires_at:periodEnd.toISOString(),period_ends_at:periodEnd.toISOString(),
        paystack_subscription_code:subscriptionCode,renewal_reminder_due:false,grace_until:null,account_mode:null,
      },
    });
    const created=await supabaseInsert<Record<string,unknown>>('ea_subscriptions',{
      initial_reference:reference,license_key:licenseKey,subscription_code:subscriptionCode,email,ea_slug:eaSlug,
      billing_cycle:cycle,currency,extra_live_seats:extraSeats,status:'ACTIVE',period_ends_at:periodEnd.toISOString(),
    });
    const row=Array.isArray(created)?created[0]:created;
    subscriptionId=String(row?.id || '');
    if(!subscriptionId) {
      const rows=await supabaseRead<Array<{id:string}>>('ea_subscriptions',`initial_reference=eq.${encodeURIComponent(reference)}&select=id&limit=1`);
      subscriptionId=rows?.[0]?.id || '';
    }
    if(!subscriptionId) throw new Error('Subscription record could not be confirmed after license provisioning.');
  }
  await supabaseInsert('ea_subscription_payments',{
    reference,subscription_id:subscriptionId,amount_minor:expectedAmount,currency,paid_at:now.toISOString(),
    period_start:periodStart.toISOString(),period_end:periodEnd.toISOString(),
  });
  if(intent) await supabaseQuery('ea_subscription_intents',{
    method:'PATCH',query:`reference=eq.${encodeURIComponent(intent.reference)}`,
    body:{subscription_code:subscriptionCode || intent.subscription_code,status:'ACTIVE',updated_at:now.toISOString()},
  });
  return {license_key:licenseKey,created:!subscription,idempotent_replay:false,period_ends_at:periodEnd.toISOString(),email,ea_slug:eaSlug};
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
