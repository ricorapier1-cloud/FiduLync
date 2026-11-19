import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';
import { hasApprovedProductArtifact } from '@/lib/productRelease';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  email?: unknown;
  currency?: unknown;
  plan?: unknown;
  ea_slug?: unknown;
  mt5_account?: unknown;
};
type ProductRecord = {
  slug: string;
  name: string;
  category: string;
  is_active: boolean;
  monthly_price_ngn: number | string;
  monthly_price_usd: number | string;
  one_time_price_ngn: number | string;
  one_time_price_usd: number | string;
  included_live_seats: number;
  included_demo_seats: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(req: Request) {
  if (process.env.PERSONAL_QUANT_EDITION !== 'false') return json({ success: false, error: 'Checkout is not part of Personal Quant Edition.' }, 410);

  const rate = await enforceDistributedRateLimit(req, 'create-checkout', 12, 60_000);
  if (rate.unavailable) return json({ success: false, error: 'Checkout security service is unavailable.' }, 503);
  if (!rate.allowed) return json({ success: false, error: 'Too many checkout requests. Please wait.' }, 429);
  if (!isSupabaseConfigured()) return json({ success: false, error: 'License database is not configured. Checkout is temporarily disabled.' }, 503);
  if (Number(req.headers.get('content-length') ?? 0) > 8192) return json({ success: false, error: 'Request body exceeds 8 KB.' }, 413);

  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) return json({ success: false, error: 'A valid checkout request is required.' }, 400);
    const body = raw as CheckoutBody;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const currency = body.currency === 'USD' ? 'USD' : body.currency === 'NGN' || body.currency === undefined ? 'NGN' : null;
    const plan = body.plan === 'LIFETIME' ? 'LIFETIME' : body.plan === 'MONTHLY' || body.plan === undefined ? 'MONTHLY' : null;
    const eaSlug = typeof body.ea_slug === 'string' ? body.ea_slug.trim().toLowerCase() : 'eridam-nexus-pro';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ success: false, error: 'Enter a valid subscriber email address.' }, 400);
    if (!currency || !plan) return json({ success: false, error: 'Choose a supported plan and billing currency.' }, 400);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)) return json({ success: false, error: 'Invalid EA product selection.' }, 400);

    const rawAccount = body.mt5_account;
    const mt5Account = rawAccount === undefined || rawAccount === null || rawAccount === ''
      ? null : typeof rawAccount === 'number' ? rawAccount
      : typeof rawAccount === 'string' && /^\d{1,20}$/.test(rawAccount) ? Number(rawAccount) : NaN;
    if (mt5Account !== null && (!Number.isSafeInteger(mt5Account) || mt5Account <= 0)) {
      return json({ success: false, error: 'If supplied, the MT5 account number must be a valid positive integer.' }, 400);
    }

    const products = await supabaseRead<ProductRecord[]>('ea_products',
      `slug=eq.${encodeURIComponent(eaSlug)}&is_active=eq.true&select=slug,name,category,is_active,monthly_price_ngn,monthly_price_usd,one_time_price_ngn,one_time_price_usd,included_live_seats,included_demo_seats`);
    if (!products) throw new Error('Product catalogue database unavailable.');
    const product = products[0];
    if (!product || !product.is_active || product.category === 'SANDBOX') return json({ success: false, error: 'This EA is not currently available for paid licensing.' }, 404);
    if (!(await hasApprovedProductArtifact(eaSlug))) return json({ success: false, error: 'Paid checkout is disabled until an approved compiled .ex5 release artifact is uploaded and verified.' }, 409);

    const price = currency === 'NGN'
      ? Number(plan === 'MONTHLY' ? product.monthly_price_ngn : product.one_time_price_ngn)
      : Number(plan === 'MONTHLY' ? product.monthly_price_usd : product.one_time_price_usd);
    const amountInMinorUnits = Math.round(price * 100);
    if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits <= 0) {
      return json({ success: false, error: 'The selected EA plan is not configured for checkout.' }, 503);
    }

    const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!paystackSecret.startsWith('sk_')) return json({ success: false, error: 'Online payment is not configured yet. Please try again later.' }, 503);
    if (paystackSecret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true') {
      return json({ success: false, error: 'Live payments are disabled while merchant compliance approval is pending.' }, 503);
    }

    const reference = `ALGO_${eaSlug}_${plan}_${currency}_${randomBytes(12).toString('hex').toUpperCase()}`;
    const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://fidulync.vercel.app').trim();
    const parsedOrigin = new URL(configuredOrigin);
    if (parsedOrigin.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('Checkout origin must use HTTPS.');
    const origin = parsedOrigin.origin;

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, amount: amountInMinorUnits, currency, reference,
        callback_url: `${origin}/store?ref=${encodeURIComponent(reference)}&ea=${encodeURIComponent(eaSlug)}`,
        metadata: {
          product: 'ALGOLYNX_VAULT',
          ea_slug: eaSlug,
          ea_name: product.name,
          mt5_account: mt5Account,
          currency,
          tier: plan,
          included_live_seats: product.included_live_seats,
          included_demo_seats: product.included_demo_seats,
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    const psData: unknown = await psRes.json();
    if (!psRes.ok || !isRecord(psData) || psData.status !== true || !isRecord(psData.data)
      || typeof psData.data.authorization_url !== 'string' || typeof psData.data.reference !== 'string'
      || psData.data.reference !== reference) {
      const message = isRecord(psData) && typeof psData.message === 'string' ? psData.message : 'Paystack checkout initialization failed.';
      return json({ success: false, error: message }, 502);
    }

    return json({
      success: true,
      mode: 'paystack_redirect',
      authorization_url: psData.data.authorization_url,
      reference,
      ea_name: product.name,
      amount_minor: amountInMinorUnits,
      currency,
      included_live_seats: product.included_live_seats,
      included_demo_seats: product.included_demo_seats,
      message: 'Complete payment using Paystack. Your included MT5 seats are checked and enforced server-side.',
    });
  } catch (error) {
    console.error('Paystack checkout initialization failed:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Checkout initialization failed. Please retry.' }, 503);
  }
}
