import 'server-only';

import { randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { provisionLicenseForReference } from '@/lib/provisionLicense';

type Intent = {
  reference: string; email: string; ea_slug: string; billing_cycle: 'MONTHLY' | 'ANNUAL';
  currency: 'NGN' | 'USD'; extra_live_seats: number; amount_minor: number;
  paystack_plan_code: string; subscription_code: string | null;
};
type License = {
  license_key: string; email: string; mt5_account: number | null; tier: string;
  status: string; expires_at: string | null;
};

export async function provisionOrExtendLicense(referenceInput: string, subscriptionCode?: string | null) {
  const reference = referenceInput.trim();
  if (!reference || !isSupabaseConfigured()) throw new Error('Subscription provisioning is unavailable.');

  const intents = await supabaseRead<Intent[]>(
    'ea_subscription_intents',
    `reference=eq.${encodeURIComponent(reference)}&select=reference,email,ea_slug,billing_cycle,currency,extra_live_seats,amount_minor,paystack_plan_code,subscription_code&limit=1`
  );
  const intent = intents?.[0];
  if (!intent) return provisionLicenseForReference(reference);

  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!secret.startsWith('sk_') || (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true')) {
    throw new Error('Paystack server verification is not enabled.');
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Paystack verification returned HTTP ${response.status}.`);
  const envelope = await response.json() as { status?: boolean; data?: Record<string, unknown> };
  const payment = envelope.data;
  const customer = payment?.customer && typeof payment.customer === 'object'
    ? payment.customer as Record<string, unknown> : {};
  const email = typeof customer.email === 'string' ? customer.email.trim().toLowerCase() : '';

  if (envelope.status !== true || !payment || payment.status !== 'success'
    || payment.reference !== reference || payment.currency !== intent.currency
    || Number(payment.amount) !== Number(intent.amount_minor) || email !== intent.email) {
    throw new Error('Verified Paystack payment does not match the stored subscription checkout intent.');
  }

  const code = subscriptionCode || intent.subscription_code
    || (typeof payment.subscription_code === 'string' ? payment.subscription_code : null);
  const candidate = `ALGOLYNX-SUB-${randomBytes(12).toString('hex').toUpperCase()}`;
  const rpc = await supabaseQuery<Record<string, unknown>>('rpc/provision_or_extend_ea_subscription', {
    method: 'POST',
    body: {
      p_reference: reference,
      p_subscription_code: code,
      p_email: intent.email,
      p_ea_slug: intent.ea_slug,
      p_billing_cycle: intent.billing_cycle,
      p_currency: intent.currency,
      p_extra_live_seats: intent.extra_live_seats,
      p_amount_minor: Number(intent.amount_minor),
      p_license_key_candidate: candidate,
    },
  });
  const result = Array.isArray(rpc) ? rpc[0] : rpc;
  const licenseKey = result && typeof result.license_key === 'string' ? result.license_key : '';
  if (!licenseKey) throw new Error('Atomic subscription provisioning did not return a license key.');

  const licenses = await supabaseRead<License[]>(
    'licenses',
    `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,email,mt5_account,tier,status,expires_at&limit=1`
  );
  if (!licenses?.[0]) throw new Error('Subscription was recorded but its license could not be read back.');
  return {
    license: licenses[0],
    created: result.created === true,
    idempotentReplay: result.idempotent_replay === true,
    amount: Number(payment.amount),
    currency: intent.currency,
    billingCycle: intent.billing_cycle,
  };
}
