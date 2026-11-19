import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { provisionLicenseForReference } from '@/lib/provisionLicense';
import { sendLicenseDeliveryEmail } from '@/lib/transactionalEmail';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { verifyPaystackWebhookSignature } from '@/lib/paystackWebhookSecurity';

export const dynamic = 'force-dynamic';
type PaystackData = Record<string, unknown>;
type WebhookEvent = { event?: unknown; data?: unknown };
type LedgerRow = { event_id: string; processed_at: string | null; processing_error: string | null };
type LicenseRow = { license_key: string; email: string; status: string | null; expires_at: string | null; created_at?: string | null };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}
function subscriptionCode(data: PaystackData): string {
  const nested = isRecord(data.subscription) ? data.subscription : {};
  return safeString(data.subscription_code || nested.subscription_code || nested.subscriptionCode);
}
function customerEmail(data: PaystackData): string {
  const customer = isRecord(data.customer) ? data.customer : {};
  return safeString(customer.email || data.email).toLowerCase();
}
async function patchSubscription(code: string, patch: Record<string, unknown>): Promise<boolean> {
  const rows = await supabaseQuery<Array<{ license_key: string }>>('licenses', {
    method: 'PATCH',
    query: `paystack_subscription_code=eq.${encodeURIComponent(code)}&select=license_key`,
    body: patch,
  });
  return Array.isArray(rows) && rows.length > 0;
}
async function processEvent(eventName: string, data: PaystackData, reference: string): Promise<void> {
  if (eventName === 'charge.success') {
    // Initial purchases are independently verified against Paystack before provisioning.
    // Recurring subscription charges are settled by invoice.update to avoid double extensions.
    const code = subscriptionCode(data);
    if (code) {
      const linked = await supabaseRead<Array<{ license_key: string }>>('licenses',
        `paystack_subscription_code=eq.${encodeURIComponent(code)}&select=license_key&limit=1`);
      if (!linked) throw new Error('Unable to check the subscription-to-licence association.');
      if (linked.length > 0) return; // Renewal is extended by the corresponding invoice.update event.
    }
    if (!reference) throw new Error('Successful charge is missing its transaction reference.');
    const result = await provisionLicenseForReference(reference);
    if (result.created) {
      const license = result.license;
      await sendLicenseDeliveryEmail({
        email: license.email,
        licenseKey: license.license_key,
        mt5Account: license.mt5_account,
        tier: license.tier,
        expiresAt: license.expires_at,
        reference,
      }).catch((error: unknown) => {
        console.error('AlgoLync webhook email delivery failed:', error instanceof Error ? error.message : String(error));
        return false;
      });
    }
    return;
  }

  if (eventName === 'subscription.create') {
    const code = subscriptionCode(data);
    const email = customerEmail(data);
    if (!code || !email) throw new Error('Subscription event is missing its subscription code or customer email.');
    const existingLink = await supabaseRead<Array<{ license_key: string; email: string }>>('licenses',
      `paystack_subscription_code=eq.${encodeURIComponent(code)}&select=license_key,email&limit=1`);
    if (!existingLink) throw new Error('Unable to check the existing subscription-to-licence association.');
    if (existingLink.length > 0) {
      if (existingLink[0].email.toLowerCase() !== email) throw new Error('Paystack subscription code is already associated with a different customer email.');
      return; // Idempotent retry after licence association but before event-ledger acknowledgement.
    }
    const recentSince = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const candidates = await supabaseRead<LicenseRow[]>('licenses',
      `email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(recentSince)}&paystack_subscription_code=is.null&status=in.(ACTIVE,active)&select=license_key,email,status,expires_at,created_at&order=created_at.desc&limit=3`);
    if (!candidates) throw new Error('Unable to query candidate AlgoLync subscription licences.');
    if (candidates.length !== 1) throw new Error('Subscription could not be matched unambiguously to exactly one active licence. Manual reconciliation is required.');
    const nextPayment = safeString(data.next_payment_date || (isRecord(data.subscription) ? data.subscription.next_payment_date : ''));
    const patch: Record<string, unknown> = { paystack_subscription_code: code };
    if (nextPayment && Number.isFinite(Date.parse(nextPayment))) patch.period_ends_at = new Date(nextPayment).toISOString();
    const updated = await supabaseQuery<Array<{ license_key: string }>>('licenses', {
      method: 'PATCH',
      query: `license_key=eq.${encodeURIComponent(candidates[0].license_key)}&paystack_subscription_code=is.null&select=license_key`,
      body: patch,
    });
    if (!Array.isArray(updated) || updated.length !== 1) throw new Error('Subscription licence association was not committed.');
    return;
  }

  if (eventName === 'invoice.payment_failed') {
    const code = subscriptionCode(data);
    if (!code) throw new Error('Failed invoice is missing its subscription code.');
    const updated = await patchSubscription(code, {
      status: 'past_due',
      grace_until: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      renewal_reminder_due: true,
    });
    if (!updated) throw new Error('No AlgoLync licence is associated with the failed subscription.');
    return;
  }

  if (eventName === 'invoice.update') {
    const code = subscriptionCode(data);
    if (!code) return;
    const status = safeString(data.status).toLowerCase();
    if (!['success', 'paid'].includes(status)) return;
    const nextPayment = safeString(data.next_payment_date || data.period_end);
    const periodEnd = nextPayment && Number.isFinite(Date.parse(nextPayment))
      ? new Date(nextPayment).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updated = await patchSubscription(code, {
      status: 'active',
      grace_until: null,
      expires_at: periodEnd,
      period_ends_at: periodEnd,
      renewal_reminder_due: false,
    });
    if (!updated) throw new Error('No AlgoLync licence is associated with the paid subscription invoice.');
    return;
  }

  if (eventName === 'subscription.not_renew') {
    const code = subscriptionCode(data);
    if (!code) throw new Error('Non-renewing subscription event is missing its subscription code.');
    const updated = await patchSubscription(code, { renewal_reminder_due: true });
    if (!updated) throw new Error('No AlgoLync licence is associated with the non-renewing subscription.');
    return;
  }

  if (eventName === 'subscription.disable') {
    const code = subscriptionCode(data);
    if (!code) throw new Error('Disabled subscription event is missing its subscription code.');
    const updated = await patchSubscription(code, { status: 'inactive', grace_until: null });
    if (!updated) throw new Error('No AlgoLync licence is associated with the disabled subscription.');
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return json({ error: 'Payment webhook database is not configured.' }, 503);
  const rawBody = await request.text();
  if (rawBody.length > 256_000) return json({ error: 'Webhook payload exceeds 256 KB.' }, 413);
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
    return json({ error: 'Payment webhook is not configured for this Paystack environment.' }, 503);
  }
  if (!verifyPaystackWebhookSignature(rawBody, request.headers, { legacySecret: secret, webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET })) return json({ error: 'Unauthorized webhook signature.' }, 401);

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON payload.' }, 400); }
  if (!isRecord(payload)) return json({ error: 'Invalid webhook payload.' }, 400);
  const event = payload as WebhookEvent;
  const eventName = safeString(event.event);
  if (!eventName || !isRecord(event.data)) return json({ error: 'Webhook event name and data are required.' }, 400);
  const data = event.data as PaystackData;
  const reference = safeString(data.reference);
  const resourceId = safeString(data.id || data.invoice_code || data.invoice_number || subscriptionCode(data) || reference);
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');
  const eventId = `paystack:${eventName}:${resourceId || payloadHash}`.slice(0, 240);

  try {
    const inserted = await supabaseQuery<Array<{ event_id: string }>>('paystack_webhook_events', {
      method: 'POST',
      query: 'on_conflict=event_id',
      prefer: 'resolution=ignore-duplicates,return=representation',
      body: { event_id: eventId, event_type: eventName, reference: reference || null, payload_hash: payloadHash },
    });
    if (!inserted) throw new Error('Webhook event ledger is unavailable.');
    const ledger = await supabaseRead<LedgerRow[]>('paystack_webhook_events',
      `event_id=eq.${encodeURIComponent(eventId)}&select=event_id,processed_at,processing_error&limit=1`);
    if (!ledger?.[0]) throw new Error('Webhook event could not be persisted to the event ledger.');
    if (ledger[0].processed_at) return json({ status: 'duplicate', event: eventName });

    await processEvent(eventName, data, reference);
    const completed = await supabaseQuery<Array<{ event_id: string }>>('paystack_webhook_events', {
      method: 'PATCH',
      query: `event_id=eq.${encodeURIComponent(eventId)}&select=event_id`,
      body: { processed_at: new Date().toISOString(), processing_error: null },
    });
    if (!Array.isArray(completed) || completed.length !== 1) throw new Error('Webhook event processing could not be acknowledged in the ledger.');
    return json({ status: 'processed', event: eventName });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Paystack webhook processing failed:', { event: eventName, reference: reference || null, event_id: eventId, error: message });
    await supabaseQuery('paystack_webhook_events', {
      method: 'PATCH',
      query: `event_id=eq.${encodeURIComponent(eventId)}`,
      body: { processing_error: message.slice(0, 1000) },
    }).catch((ledgerError: unknown) => {
      console.error('Paystack webhook ledger error update failed:', ledgerError instanceof Error ? ledgerError.message : String(ledgerError));
    });
    return json({ error: 'Webhook processing failed and is eligible for safe retry.' }, 503);
  }
}
