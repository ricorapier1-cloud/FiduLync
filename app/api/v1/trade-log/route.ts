import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized } from '@/lib/algoAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getCustomerTrades, saveCustomerTrade, validateCustomerLicense, type CustomerTrade } from '@/lib/customerTelemetry';

export const dynamic = 'force-dynamic';

function readCredentials(request: Request) {
  const params = new URL(request.url).searchParams;
  return { mt5Account: Number(params.get('mt5_account')), licenseKey: (params.get('license_key') || '').trim() };
}

export async function GET(request: Request) {
  if (!checkRateLimit(getClientIp(request), 30, 60_000)) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  const { mt5Account, licenseKey } = readCredentials(request);
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0 || !licenseKey) return NextResponse.json({ error: 'A valid MT5 account and license key are required.' }, { status: 400 });
  try {
    if (!await validateCustomerLicense(mt5Account, licenseKey)) return NextResponse.json({ error: 'License does not authorize this MT5 account.' }, { status: 401 });
    const trades = await getCustomerTrades(mt5Account, licenseKey);
    return NextResponse.json({ ok: true, trades }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Customer trade-log read failed:', error);
    return NextResponse.json({ error: 'Account trade history is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAlgoApiConfigured()) return NextResponse.json({ error: 'The private algorithm API is not configured.' }, { status: 503 });
  if (!isAlgoAuthorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!checkRateLimit(getClientIp(request), 120, 60_000)) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) return NextResponse.json({ error: 'Trade payload is too large.' }, { status: 413 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON closed-trade payload is required.' }, { status: 400 }); }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return NextResponse.json({ error: 'Invalid trade payload.' }, { status: 400 });
  const p = payload as Record<string, unknown>;
  const mt5Account = Number(p.mt5_account);
  const licenseKey = typeof p.license_key === 'string' ? p.license_key.trim() : '';
  const ticket = typeof p.ticket === 'string' ? p.ticket.trim() : typeof p.ticket === 'number' && Number.isSafeInteger(p.ticket) ? String(p.ticket) : '';
  const symbol = typeof p.symbol === 'string' ? p.symbol.trim().toUpperCase() : '';
  const direction = typeof p.direction === 'string' ? p.direction.trim().toUpperCase() : '';
  const regime = p.regime;
  const closedAt = typeof p.closed_at_utc === 'string' ? p.closed_at_utc : '';
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0 || !licenseKey
    || !/^[0-9]{1,40}$/.test(ticket) || !/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(symbol)
    || (direction !== 'LONG' && direction !== 'SHORT')
    || typeof p.entry_price !== 'number' || !Number.isFinite(p.entry_price) || p.entry_price <= 0
    || typeof p.exit_price !== 'number' || !Number.isFinite(p.exit_price) || p.exit_price <= 0
    || typeof p.profit_usd !== 'number' || !Number.isFinite(p.profit_usd)
    || typeof p.r_multiple !== 'number' || !Number.isFinite(p.r_multiple) || Math.abs(p.r_multiple) > 1000
    || typeof p.confluence_score !== 'number' || !Number.isInteger(p.confluence_score) || p.confluence_score < -100 || p.confluence_score > 100
    || !['TRENDING_EXPANSION','MEAN_REVERTING','HIGH_VOL_CHOP','UNAVAILABLE'].includes(String(regime))
    || !closedAt.endsWith('Z') || !Number.isFinite(Date.parse(closedAt))) {
    return NextResponse.json({ error: 'Closed-trade payload fields are invalid.' }, { status: 400 });
  }
  try {
    if (!await validateCustomerLicense(mt5Account, licenseKey)) return NextResponse.json({ error: 'License does not authorize this MT5 account.' }, { status: 401 });
    const trade: CustomerTrade = {
      mt5_account: mt5Account, license_key: licenseKey, ticket, symbol,
      direction: direction as 'LONG' | 'SHORT',
      entry_price: p.entry_price, exit_price: p.exit_price, profit_usd: p.profit_usd,
      r_multiple: p.r_multiple, confluence_score: p.confluence_score,
      regime: String(regime), closed_at_utc: new Date(closedAt).toISOString(),
    };
    await saveCustomerTrade(trade);
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  } catch (error) {
    console.error('Closed trade could not be stored:', error);
    return NextResponse.json({ error: 'Closed-trade storage is temporarily unavailable.' }, { status: 503 });
  }
}
