import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
type LicenseRow = { license_key:string; status:string; expires_at:string|null; max_live_slots:number|null; max_demo_slots:number|null; ea_slug?:string|null };
type BoundAccountRow = { id?:string; account_number:number|string; account_type:string; broker_server?:string|null; rebind_cooldown_until?:string|null; created_at?:string };

export async function GET(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const licenseKey = searchParams.get('license_key')?.trim().toUpperCase();

  if (!licenseKey) {
    return NextResponse.json({ error: 'license_key is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    // Development fallback
    return NextResponse.json({
      success: true,
      license_key: licenseKey,
      available_live_slots: 1,
      available_demo_slots: 2,
      bound_accounts: [],
    });
  }

  try {
    // 1. Fetch license
    const licenses = await supabaseRead<LicenseRow[]>('licenses', `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,expires_at,max_live_slots,max_demo_slots,ea_slug`);
    if (!licenses || licenses.length === 0) {
      return NextResponse.json({ error: 'License key not found' }, { status: 404 });
    }

    const license = licenses[0];
    const maxLive = license.max_live_slots ?? 1;
    const maxDemo = license.max_demo_slots ?? 2;

    // 2. Fetch bound accounts
    const bound = await supabaseRead<BoundAccountRow[]>(
      'license_bound_accounts',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=account_number,account_type,broker_server,rebind_cooldown_until,created_at`
    );

    const accounts = bound || [];
    const liveCount = accounts.filter((a) => a.account_type === 'LIVE').length;
    const demoCount = accounts.filter((a) => a.account_type === 'DEMO').length;

    return NextResponse.json({
      success: true,
      license_key: licenseKey,
      status: license.status,
      available_live_slots: Math.max(0, maxLive - liveCount),
      available_demo_slots: Math.max(0, maxDemo - demoCount),
      bound_accounts: accounts,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error fetching account bindings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 15)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const licenseKey = String(body.license_key || '').trim().toUpperCase();
    const accountNumber = Number(body.account_number);
    const accountType = (body.account_type === 'DEMO' ? 'DEMO' : 'LIVE') as 'LIVE' | 'DEMO';
    const brokerServer = body.broker_server ? String(body.broker_server).trim() : null;

    if (!licenseKey || !accountNumber || isNaN(accountNumber)) {
      return NextResponse.json({ error: 'license_key and valid account_number are required' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        message: `Account #${accountNumber} (${accountType}) successfully bound to ${licenseKey} (Local Development Mode).`,
        account_number: accountNumber,
        account_type: accountType,
      });
    }

    // 1. Check license validity
    const licenses = await supabaseRead<any[]>('licenses', `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,status,expires_at,max_live_slots,max_demo_slots`);
    if (!licenses || licenses.length === 0) {
      return NextResponse.json({ error: 'License key not found' }, { status: 404 });
    }

    const license = licenses[0];
    if (license.ea_slug) {
      return NextResponse.json({error:'Subscription licenses must use the MT5 Account Slots API; legacy binding is disabled.'},{status:409});
    }
    if (license.status !== 'ACTIVE' && license.status !== 'active') {
      return NextResponse.json({ error: `License is ${license.status}` }, { status: 403 });
    }

    const maxLive = license.max_live_slots ?? 1;
    const maxDemo = license.max_demo_slots ?? 2;

    // 2. Fetch current bound accounts
    const bound = await supabaseRead<any[]>(
      'license_bound_accounts',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=id,account_number,account_type,rebind_cooldown_until`
    );

    const currentAccounts = bound || [];
    const alreadyBound = currentAccounts.find((a) => Number(a.account_number) === accountNumber);

    if (alreadyBound) {
      return NextResponse.json({
        success: true,
        message: `Account #${accountNumber} is already bound to this license.`,
        bound: true,
      });
    }

    // 3. Check capacity limits
    const liveBoundCount = currentAccounts.filter((a) => a.account_type === 'LIVE').length;
    const demoBoundCount = currentAccounts.filter((a) => a.account_type === 'DEMO').length;

    if (accountType === 'LIVE' && liveBoundCount >= maxLive) {
      return NextResponse.json({
        error: `Live account limit reached (${maxLive}/${maxLive}). Contact support or upgrade seats to bind additional live accounts.`,
      }, { status: 400 });
    }

    if (accountType === 'DEMO' && demoBoundCount >= maxDemo) {
      return NextResponse.json({
        error: `Demo account limit reached (${maxDemo}/${maxDemo}).`,
      }, { status: 400 });
    }

    // 4. Insert new binding with 72-hour re-binding cooldown timestamp
    const cooldownDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await supabaseQuery('license_bound_accounts', {
      method: 'POST',
      body: {
        license_key: licenseKey,
        account_number: accountNumber,
        account_type: accountType,
        broker_server: brokerServer,
        rebind_cooldown_until: cooldownDate,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully bound ${accountType} account #${accountNumber} to license ${licenseKey}.`,
      account_number: accountNumber,
      account_type: accountType,
      rebind_cooldown_until: cooldownDate,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Binding operation failed' }, { status: 500 });
  }
}
