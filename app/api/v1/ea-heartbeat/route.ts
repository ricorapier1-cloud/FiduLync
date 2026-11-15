import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized } from '@/lib/algoAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getCustomerHeartbeat, saveCustomerHeartbeat, validateCustomerLicense } from '@/lib/customerTelemetry';

export const dynamic = 'force-dynamic';

function credentials(request: Request) {
  const url = new URL(request.url);
  const mt5Account = Number(url.searchParams.get('mt5_account'));
  const licenseKey = (url.searchParams.get('license_key') || '').trim();
  return { mt5Account, licenseKey };
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 30, 60_000)) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  const { mt5Account, licenseKey } = credentials(request);
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0 || !licenseKey) {
    return NextResponse.json({ error: 'A valid MT5 account and license key are required.' }, { status: 400 });
  }
  try {
    if (!await validateCustomerLicense(mt5Account, licenseKey)) {
      return NextResponse.json({ error: 'License does not authorize this MT5 account.' }, { status: 401 },);
    }
    const heartbeat = await getCustomerHeartbeat(mt5Account, licenseKey);
    return NextResponse.json({ ok: true, heartbeat }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Customer heartbeat read failed:', error);
    return NextResponse.json({ error: 'Account telemetry is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAlgoApiConfigured()) return NextResponse.json({ ok: false, error: 'EA telemetry authentication is not configured.' }, { status: 503 });
  if (!isAlgoAuthorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized EA telemetry.' }, { status: 401 });
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 60, 60_000)) return NextResponse.json({ ok: false, error: 'Rate limit exceeded.' }, { status: 429 });
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) return NextResponse.json({ ok: false, error: 'Telemetry payload is too large.' }, { status: 413 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'A valid JSON heartbeat is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return NextResponse.json({ error: 'Invalid heartbeat payload.' }, { status: 400 });
  const p = body as Record<string, unknown>;
  const account = Number(p.mt5_account ?? p.account_number);
  const licenseKey = typeof p.license_key === 'string' ? p.license_key.trim() : '';
  const balance = p.balance, equity = p.equity, floating = p.floating_pnl, drawdown = p.drawdown_pct, positions = p.open_positions;
  const eaName = typeof p.ea_name === 'string' ? p.ea_name.trim() : '';
  const status = typeof p.status === 'string' ? p.status.trim().toUpperCase() : 'RUNNING';
  if (!Number.isSafeInteger(account) || account <= 0 || !licenseKey || eaName.length < 1 || eaName.length > 80
    || typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0
    || typeof equity !== 'number' || !Number.isFinite(equity) || equity < 0
    || typeof floating !== 'number' || !Number.isFinite(floating)
    || typeof drawdown !== 'number' || !Number.isFinite(drawdown) || drawdown < 0 || drawdown > 100
    || typeof positions !== 'number' || !Number.isSafeInteger(positions) || positions < 0
    || status.length > 40) {
    return NextResponse.json({ error: 'Heartbeat payload fields are invalid.' }, { status: 400 });
  }
  try {
    if (!await validateCustomerLicense(account, licenseKey)) return NextResponse.json({ error: 'License does not authorize this MT5 account.' }, { status: 401 });
    await saveCustomerHeartbeat({
      mt5_account: account, license_key: licenseKey, ea_name: eaName,
      balance, equity, floating_pnl: floating, drawdown_pct: drawdown,
      open_positions: positions, status,
    });
    return NextResponse.json({ ok: true, server_utc: new Date().toISOString(), ttl_seconds: 900 }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Customer heartbeat could not be stored:', error);
    return NextResponse.json({ ok: false, error: 'Heartbeat storage is temporarily unavailable.' }, { status: 503 });
  }
}
