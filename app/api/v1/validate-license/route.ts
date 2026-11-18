import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead, supabaseInsert } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type LicenseRecord = {
  license_key: string;
  status: string;
  expires_at: string | null;
  max_live_slots: number | null;
  max_demo_slots: number | null;
  email?: string | null;
};

type BoundAccountRecord = {
  account_number: number | string;
  account_type: 'LIVE' | 'DEMO';
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 60)) {
    return NextResponse.json({ valid: false, message: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const licenseKey = String(body.license_key || '').trim().toUpperCase();
    const accountNumber = Number(body.account_number || body.account || 0);
    const accountType = (body.account_type === 'DEMO' ? 'DEMO' : 'LIVE') as 'LIVE' | 'DEMO';
    const brokerServer = body.broker_server ? String(body.broker_server).trim() : null;

    if (!licenseKey) {
      return NextResponse.json({ valid: false, message: 'license_key required' }, { status: 400 });
    }

    // 1. If key has ALGO-DEMO prefix and account is DEMO mode, permit forward-testing
    if (licenseKey.startsWith('ALGO-DEMO-')) {
      if (accountType !== 'DEMO') {
        return NextResponse.json({
          valid: false,
          message: 'This demo license key cannot be attached to a real/live trading account. Demo accounts only.',
        }, { status: 403 });
      }
      return NextResponse.json({
        valid: true,
        license_type: 'DEMO_TRIAL',
        account: accountNumber,
        message: 'Demo entitlement active. 1 Live + 2 Demo accounts included in full subscription.',
      });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        valid: true,
        license_type: 'LOCAL_DEV',
        account: accountNumber,
        message: 'License accepted (Development Mode).',
      });
    }

    // 2. Query license from Supabase
    const licenses = await supabaseRead<LicenseRecord[]>('licenses', `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,expires_at,max_live_slots,max_demo_slots,email`);
    if (!licenses || licenses.length === 0) {
      return NextResponse.json({ valid: false, message: 'Invalid license key' }, { status: 404 });
    }

    const license = licenses[0];

    // Status check
    if (license.status !== 'ACTIVE' && license.status !== 'active') {
      return NextResponse.json({ valid: false, message: `License is ${license.status}` }, { status: 403 });
    }

    // Expiry check
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ valid: false, message: 'License has expired' }, { status: 403 });
    }

    // 3. Check bound accounts in license_bound_accounts
    if (accountNumber > 0) {
      const bound = await supabaseRead<any[]>(
        'license_bound_accounts',
        `license_key=eq.${encodeURIComponent(licenseKey)}&select=account_number,account_type`
      );

      const accounts = bound || [];
      const match = accounts.find((a) => Number(a.account_number) === accountNumber);

      if (!match) {
        // Auto-bind on first attach if slots are available!
        const liveCount = accounts.filter((a) => a.account_type === 'LIVE').length;
        const demoCount = accounts.filter((a) => a.account_type === 'DEMO').length;
        const maxLive = license.max_live_slots ?? 1;
        const maxDemo = license.max_demo_slots ?? 2;

        const hasSlot = accountType === 'LIVE' ? liveCount < maxLive : demoCount < maxDemo;

        if (hasSlot) {
          const cooldownDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          await supabaseInsert('license_bound_accounts', {
            license_key: licenseKey,
            account_number: accountNumber,
            account_type: accountType,
            broker_server: brokerServer,
            rebind_cooldown_until: cooldownDate,
          });
        } else {
          return NextResponse.json({
            valid: false,
            message: `Account #${accountNumber} is not bound to this license and all ${accountType} slots are occupied (${accountType === 'LIVE' ? maxLive : maxDemo} max). Visit https://fidulync.vercel.app/store to manage your bound accounts.`,
          }, { status: 403 });
        }
      }
    }

    return NextResponse.json({
      valid: true,
      license_type: 'INSTITUTIONAL_PRO',
      account: accountNumber,
      message: 'License verified. Active cloud telemetry enabled.',
    });
  } catch (err: any) {
    return NextResponse.json({ valid: false, message: err.message || 'Validation error' }, { status: 500 });
  }
}
