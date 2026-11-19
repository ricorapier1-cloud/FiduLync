import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { hasApprovedProductArtifact } from '@/lib/productRelease';

type Plan = 'MONTHLY' | 'LIFETIME';
type Currency = 'NGN' | 'USD';
type ProductPricing = { slug: string; name: string; category: string; is_active: boolean; monthly_price_ngn: number | string; monthly_price_usd: number | string; one_time_price_ngn: number | string; one_time_price_usd: number | string };

export type ProvisionedLicense = {
  license_key: string;
  payment_reference: string;
  mt5_account: number | null;
  email: string;
  tier: string;
  status: string;
  expires_at: string | null;
  created?: boolean;
  ea_slug?: string;
};

export type ProvisionResult = {
  license: ProvisionedLicense;
  created: boolean;
  amount: number;
  currency: Currency;
  plan: Plan;
};

function safeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Paystack transaction did not contain a valid customer email.');
  }
  return email;
}

function parseReference(reference: string): { plan: Plan; currency: Currency; slug?: string } {
  // Support both:
  // 1) ALGO_[SLUG]_[PLAN]_[CURRENCY]_[HEX]
  // 2) ALGO_[PLAN]_[CURRENCY]_[HEX]
  const parts = reference.split('_');
  if (parts.length >= 4 && parts[0] === 'ALGO') {
    if (parts[1] === 'MONTHLY' || parts[1] === 'LIFETIME') {
      if (parts[2] !== 'NGN' && parts[2] !== 'USD') throw new Error('Unsupported payment currency.');
      return { plan: parts[1] as Plan, currency: parts[2] as Currency };
    }
    // Pattern: ALGO_[SLUG]_[PLAN]_[CURRENCY]_[HEX]
    if (parts[2] === 'MONTHLY' || parts[2] === 'LIFETIME') {
      if (parts[3] !== 'NGN' && parts[3] !== 'USD') throw new Error('Unsupported payment currency.');
      return { slug: parts[1].toLowerCase(), plan: parts[2] as Plan, currency: parts[3] as Currency };
    }
  }
  throw new Error('Unrecognized AlgoLync payment reference format.');
}

function paymentAccount(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).mt5_account;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(String(raw));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Paystack transaction contains an invalid optional MT5 account.');
  }
  return value;
}

/**
 * The only license-minting entry point. Both the browser callback and webhook
 * call this function; payment is independently verified with Paystack first.
 */
export async function provisionLicenseForReference(referenceInput: string): Promise<ProvisionResult> {
  const reference = referenceInput.trim();
  const { plan, currency, slug } = parseReference(reference);
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_')) throw new Error('Paystack server secret is not configured.');
  if (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true') {
    throw new Error('Live Paystack processing is disabled pending merchant approval.');
  }
  if (!isSupabaseConfigured()) throw new Error('Supabase server credentials are not configured.');

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Paystack verification returned HTTP ${response.status}.`);

  const envelope: unknown = await response.json();
  if (!envelope || typeof envelope !== 'object' || !('status' in envelope) || !('data' in envelope)) {
    throw new Error('Paystack returned an invalid verification envelope.');
  }
  const result = envelope as { status?: unknown; data?: Record<string, unknown> };
  const payment = result.data;

  if (result.status !== true || !payment || payment.status !== 'success'
    || payment.reference !== reference || payment.currency !== currency) {
    throw new Error('Paystack transaction is not successful or does not match currency/reference.');
  }

  // Product identity and price are re-read from the authoritative database at payment verification.
  const meta = (payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata))
    ? payment.metadata as Record<string, unknown> : {};
  const eaSlug = typeof meta.ea_slug === 'string' ? meta.ea_slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)) throw new Error('Payment metadata has no valid EA product slug.');
  if (meta.product !== 'ALGOLYNX_VAULT') throw new Error('Payment metadata does not identify an AlgoLync storefront purchase.');
  if (slug && eaSlug !== slug) throw new Error('Payment product metadata does not match its payment reference.');
  if (meta.currency !== currency || meta.tier !== plan) throw new Error('Payment plan or currency metadata does not match the reference.');

  const products = await supabaseRead<ProductPricing[]>('ea_products',
    `slug=eq.${encodeURIComponent(eaSlug)}&is_active=eq.true&select=slug,name,category,is_active,monthly_price_ngn,monthly_price_usd,one_time_price_ngn,one_time_price_usd`);
  if (!products) throw new Error('Authoritative product catalogue is unavailable.');
  const product = products[0];
  if (!product || !product.is_active || product.category === 'SANDBOX') throw new Error('Payment references a product that is not active for paid licensing.');
  if (!(await hasApprovedProductArtifact(eaSlug))) throw new Error('Paid license provisioning is blocked until an approved compiled .ex5 artifact is available.');

  const productPrice = currency === 'NGN'
    ? Number(plan === 'MONTHLY' ? product.monthly_price_ngn : product.one_time_price_ngn)
    : Number(plan === 'MONTHLY' ? product.monthly_price_usd : product.one_time_price_usd);
  const expectedAmount = Math.round(productPrice * 100);
  const paidAmount = typeof payment.amount === 'number' ? payment.amount : Number(payment.amount);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0
    || !Number.isSafeInteger(paidAmount) || paidAmount !== expectedAmount) {
    throw new Error('Verified Paystack amount does not exactly match the current server-side product price.');
  }

  const email = safeEmail(
    payment.customer && typeof payment.customer === 'object' && 'email' in payment.customer
      ? (payment.customer as Record<string, unknown>).email : undefined
  );
  const mt5Account = paymentAccount(payment.metadata);
  const digest = createHash('sha256').update(reference).digest('hex').slice(0, 8).toUpperCase();
  const tier = plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY';
  const expiresAt = plan === 'LIFETIME' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString();

  const candidate: ProvisionedLicense = {
    license_key: `ALGOLYNX-${plan === 'LIFETIME' ? 'LT' : 'MO'}-${digest}-${randomBytes(16).toString('hex').toUpperCase()}`,
    payment_reference: reference,
    mt5_account: mt5Account,
    email,
    tier,
    status: 'ACTIVE',
    expires_at: expiresAt,
    ea_slug: eaSlug,
  };

  try {
    const persisted = await supabaseQuery<ProvisionedLicense>('rpc/provision_algolync_license_v2', {
      method: 'POST',
      body: {
        p_payment_reference: reference,
        p_license_key: candidate.license_key,
        p_mt5_account: candidate.mt5_account,
        p_email: candidate.email,
        p_tier: candidate.tier,
        p_expires_at: candidate.expires_at,
        p_ea_slug: eaSlug,
        p_currency: currency,
      },
    });

    if (!persisted || !persisted.license_key || persisted.payment_reference !== reference) {
      throw new Error('License provisioning RPC did not confirm a durable license record.');
    }
    const activeRecord = persisted;

    return {
      license: activeRecord,
      created: activeRecord.created === true,
      amount: paidAmount,
      currency,
      plan,
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'algolync_license_provisioning_write_failed',
      table: 'licenses',
      payment_reference: reference,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}
