import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { supabaseRead } from '@/lib/supabaseAdmin';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LicenseRow = {
  id: string; license_key: string; email: string; mt5_account: number | null;
  tier: string; status: string; expires_at: string | null; created_at: string;
  payment_reference: string | null;
};

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rate = await enforceDistributedRateLimit(request, 'owner-control-plane', 30, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Owner control plane is temporarily unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Owner control-plane rate limit exceeded.' }, { status: 429 });

  try {
    const licenses = await supabaseRead<LicenseRow[]>(
      'licenses',
      'select=id,license_key,email,mt5_account,tier,status,expires_at,created_at,payment_reference&order=created_at.desc&limit=100'
    );
    if (!licenses) throw new Error('License ledger unavailable.');

    const active = licenses.filter((row) => row.status === 'active' && (!row.expires_at || Date.parse(row.expires_at) > Date.now()));
    const uniqueCustomers = new Set(licenses.map((row) => row.email.toLowerCase()).filter(Boolean));
    const paid = licenses.filter((row) => Boolean(row.payment_reference));
    const providers = [
      { id: 'fred', configured: Boolean(process.env.FRED_API_KEY), approved: process.env.FRED_COMMERCIAL_USE_APPROVED === 'true' },
      { id: 'bea', configured: Boolean(process.env.BEA_API_KEY), approved: true },
      { id: 'bls', configured: Boolean(process.env.BLS_API_KEY), approved: true },
      { id: 'finnhub', configured: Boolean(process.env.FINNHUB_API_KEY), approved: process.env.FINNHUB_COMMERCIAL_USE_APPROVED === 'true' },
      { id: 'twelve_data', configured: Boolean(process.env.TWELVE_DATA_API_KEY), approved: process.env.TWELVE_DATA_COMMERCIAL_USE_APPROVED === 'true' },
      { id: 'market_candles', configured: Boolean(process.env.MARKET_DATA_PROVIDER_URL && process.env.MARKET_DATA_PROVIDER_TOKEN), approved: process.env.MARKET_DATA_PROVIDER_LICENSE_APPROVED === 'true' },
      { id: 'custom_macro', configured: Boolean(process.env.MACRO_DATA_PROVIDER_URL && process.env.MACRO_DATA_PROVIDER_TOKEN), approved: process.env.MACRO_DATA_PROVIDER_LICENSE_APPROVED === 'true' },
    ].map((provider) => ({ ...provider, state: !provider.configured ? 'not_configured' : !provider.approved ? 'license_blocked' : 'configured_unverified' }));

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      owner: owner.email,
      metrics: {
        customers: uniqueCustomers.size,
        licenses: licenses.length,
        active_licenses: active.length,
        paid_entitlements: paid.length,
        unbound_licenses: active.filter((row) => row.mt5_account === null).length,
        expired_or_inactive: licenses.length - active.length,
      },
      licenses: licenses.map((row) => ({ ...row, license_key: row.license_key })),
      providers,
      capabilities: {
        customer_admin_actions: 'read_only_until_audited_mutation_workflow_is_enabled',
        payment_ledger: 'paystack_verified_references_on_license_records',
        release_registry: 'not_integrated',
        immutable_audit: 'not_configured',
        emergency_kill_switch: 'not_configured',
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Owner control plane read failed:', error);
    return NextResponse.json({ error: 'Owner control-plane data is unavailable. No data was changed.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
