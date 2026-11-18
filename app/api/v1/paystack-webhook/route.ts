import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { provisionOrExtendLicense } from '@/lib/provisionOrExtendLicense';
import { sendLicenseDeliveryEmail } from '@/lib/transactionalEmail';
import { supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }

async function attachSubscriptionCode(data: Record<string, unknown>) {
  const subscriptionCode = text(data.subscription_code);
  const customer = data.customer && typeof data.customer === 'object' ? data.customer as Record<string, unknown> : {};
  const email = text(customer.email).toLowerCase();
  const plan = data.plan && typeof data.plan === 'object' ? data.plan as Record<string, unknown> : {};
  const planCode = text(plan.plan_code) || text(data.plan_code);
  if (!subscriptionCode || !email || !planCode) return;

  const intents = await supabaseRead<Array<{ reference: string }>>(
    'ea_subscription_intents',
    `email=eq.${encodeURIComponent(email)}&paystack_plan_code=eq.${encodeURIComponent(planCode)}&select=reference&order=created_at.desc&limit=1`
  );
  const intent = intents?.[0];
  if (!intent) return;
  await supabaseQuery('ea_subscription_intents', {
    method: 'PATCH', query: `reference=eq.${encodeURIComponent(intent.reference)}`,
    body: { subscription_code: subscriptionCode, status: 'SUBSCRIPTION_CREATED', updated_at: new Date().toISOString() },
  });
  await supabaseQuery('ea_subscriptions', {
    method: 'PATCH', query: `initial_reference=eq.${encodeURIComponent(intent.reference)}`,
    body: { subscription_code: subscriptionCode, updated_at: new Date().toISOString() },
  });
}

async function applyPaymentFailed(data: Record<string, unknown>, paystackSecret: string) {
  const subscription = data.subscription && typeof data.subscription === 'object'
    ? data.subscription as Record<string, unknown> : {};
  const code = text(subscription.subscription_code) || text(data.subscription_code);
  if (!code) return;
  const rows = await supabaseRead<Array<{ license_key: string; grace_until: string | null }>>(
    'ea_subscriptions',
    `subscription_code=eq.${encodeURIComponent(code)}&select=license_key,grace_until&limit=1`
  );
  const row = rows?.[0];
  if (!row) return;
  const graceUntil = row.grace_until || new Date(Date.now() + 48 * 60 * 60_000).toISOString();
  await supabaseQuery('ea_subscriptions', {
    method: 'PATCH', query: `subscription_code=eq.${encodeURIComponent(code)}`,
    body: { status: 'PAST_DUE', grace_until: graceUntil, renewal_reminder_due: true, updated_at: new Date().toISOString() },
  });
  await supabaseQuery('licenses', {
    method: 'PATCH', query: `license_key=eq.${encodeURIComponent(row.license_key)}`,
    body: { status: 'PAST_DUE', grace_until: graceUntil, renewal_reminder_due: true, updated_at: new Date().toISOString() },
  });
  try {
    const reminder = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(code)}/manage/email`, {
      method: 'POST', headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}), cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    const reminderBody = await reminder.json() as { status?: boolean; message?: string };
    if (!reminder.ok || reminderBody.status !== true) {
      console.warn('Paystack subscription management reminder was not sent:', reminderBody.message || reminder.status);
    }
  } catch (error) {
    console.warn('Paystack subscription reminder request failed; renewal_reminder_due remains set:', error);
  }
}

async function applySubscriptionDisable(data: Record<string, unknown>) {
  const code = text(data.subscription_code);
  if (!code) return;
  const rows = await supabaseRead<Array<{ license_key: string; period_ends_at: string }>>(
    'ea_subscriptions',
    `subscription_code=eq.${encodeURIComponent(code)}&select=license_key,period_ends_at&limit=1`
  );
  const row = rows?.[0];
  if (!row) return;
  const ended = Date.parse(row.period_ends_at) <= Date.now();
  await supabaseQuery('ea_subscriptions', {
    method: 'PATCH', query: `subscription_code=eq.${encodeURIComponent(code)}`,
    body: { cancel_at_period_end: true, ...(ended ? { status: 'REVOKED' } : {}), updated_at: new Date().toISOString() },
  });
  if (ended) {
    await supabaseQuery('licenses', {
      method: 'PATCH', query: `license_key=eq.${encodeURIComponent(row.license_key)}`,
      body: { status: 'REVOKED', updated_at: new Date().toISOString() },
    });
  }
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
    return NextResponse.json({ error: 'Payment webhook is not configured.' }, { status: 503 });
  }
  const rawBody = await request.text();
  const suppliedHex = request.headers.get('x-paystack-signature') ?? '';
  if (!/^[a-f0-9]{128}$/i.test(suppliedHex)) return NextResponse.json({ error: 'Unauthorized webhook signature.' }, { status: 401 });
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: 'Unauthorized webhook signature.' }, { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 }); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  const event = payload as Record<string, unknown>;
  const data = event.data && typeof event.data === 'object' && !Array.isArray(event.data)
    ? event.data as Record<string, unknown> : null;
  if (!data) return NextResponse.json({ error: 'Invalid webhook event data.' }, { status: 400 });

  try {
    switch (event.event) {
      case 'charge.success': {
        const reference = text(data.reference);
        if (!reference) return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 });
        const result = await provisionOrExtendLicense(reference, text(data.subscription_code) || null);
        const license = result.license;
        let emailSent = false;
        if (result.created) {
          emailSent = await sendLicenseDeliveryEmail({
            email: license.email, licenseKey: license.license_key, mt5Account: license.mt5_account,
            tier: license.tier, expiresAt: license.expires_at, reference,
          }).catch((error: unknown) => { console.error('AlgoLync subscription email failed:', error); return false; });
        }
        return NextResponse.json({ status: 'success', provisioned: true, created: result.created, idempotent_replay: result.idempotentReplay, email_sent: emailSent });
      }
      case 'subscription.create':
        await attachSubscriptionCode(data);
        return NextResponse.json({ status: 'subscription_code_recorded' });
      case 'invoice.payment_failed':
        await applyPaymentFailed(data, secret);
        return NextResponse.json({ status: 'grace_period_applied' });
      case 'subscription.not_renew':
        await applySubscriptionDisable(data);
        return NextResponse.json({ status: 'cancellation_scheduled' });
      case 'subscription.disable':
        await applySubscriptionDisable(data);
        return NextResponse.json({ status: 'cancellation_processed' });
      default:
        return NextResponse.json({ status: 'ignored' });
    }
  } catch (error) {
    console.error('AlgoLync Paystack webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed. Paystack may safely retry this event.' }, { status: 503 });
  }
}
