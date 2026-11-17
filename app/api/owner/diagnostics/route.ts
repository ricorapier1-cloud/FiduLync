import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireOwner } from '@/lib/ownerAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Check = { status: 'ok' | 'error' | 'not_configured' | 'not_integrated' | 'unknown' | 'license_blocked'; detail: string };

async function probe(name: string, fn: () => Promise<void>): Promise<[string, Check]> {
  try {
    await fn();
    return [name, { status: 'ok', detail: 'Provider accepted the request.' }];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider request failed.';
    return [name, { status: 'error', detail: message.slice(0, 180) }];
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function requestOk(url: URL | string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}.`);
  return response;
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  const expectedKey = (process.env.ALGOLYNC_PRIVATE_KEY || process.env.ALGO_PRIVATE_API_KEY || '').trim();
  const providedKey = request.headers.get('x-algo-key')?.trim() ?? '';
  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  const serviceAuthorized = expected.length > 0
    && expected.length === provided.length
    && timingSafeEqual(expected, provided);
  if (!owner && !serviceAuthorized) {
    return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!checkRateLimit(owner?.id ?? getClientIp(request), 5, 60_000)) {
    return NextResponse.json({ error: 'Diagnostics rate limit exceeded.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const checks: Record<string, Check> = {};
  const tasks: Array<Promise<[string, Check]>> = [];

  if (process.env.FRED_API_KEY?.trim() && process.env.FRED_COMMERCIAL_USE_APPROVED === 'true') tasks.push(probe('fred', async () => {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', 'DFF');
    url.searchParams.set('api_key', required('FRED_API_KEY'));
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('limit', '1');
    const data = await (await requestOk(url)).json() as { observations?: unknown[]; error_code?: number };
    if (!Array.isArray(data.observations)) throw new Error('Invalid FRED response or rejected API key.');
  }));

  if (process.env.BEA_API_KEY?.trim()) tasks.push(probe('bea', async () => {
    const url = new URL('https://apps.bea.gov/api/data/');
    url.searchParams.set('UserID', required('BEA_API_KEY'));
    url.searchParams.set('method', 'GetData');
    url.searchParams.set('datasetname', 'NIPA');
    url.searchParams.set('TableName', 'T10101');
    url.searchParams.set('Frequency', 'Q');
    url.searchParams.set('Year', 'LAST5');
    url.searchParams.set('ResultFormat', 'JSON');
    const data = await (await requestOk(url)).json() as { BEAAPI?: { Results?: { Data?: unknown[]; Error?: { APIErrorCode?: string } } } };
    if (data.BEAAPI?.Results?.Error || !Array.isArray(data.BEAAPI?.Results?.Data)) {
      throw new Error('BEA rejected the request or returned no data.');
    }
  }));

  if (process.env.BLS_API_KEY?.trim()) tasks.push(probe('bls', async () => {
    const response = await requestOk('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: ['CUUR0000SA0'],
        startyear: String(new Date().getUTCFullYear() - 1),
        endyear: String(new Date().getUTCFullYear()),
        registrationkey: required('BLS_API_KEY'),
      }),
    });
    const data = await response.json() as { status?: string; Results?: { series?: unknown[] } };
    if (data.status !== 'REQUEST_SUCCEEDED' || !Array.isArray(data.Results?.series)) {
      throw new Error('BLS rejected the request or returned no series.');
    }
  }));

  if (process.env.TWELVE_DATA_API_KEY?.trim() && process.env.TWELVE_DATA_COMMERCIAL_USE_APPROVED === 'true') tasks.push(probe('twelve_data', async () => {
    const url = new URL('https://api.twelvedata.com/time_series');
    url.searchParams.set('symbol', 'EUR/USD');
    url.searchParams.set('interval', '1h');
    url.searchParams.set('outputsize', '2');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('apikey', required('TWELVE_DATA_API_KEY'));
    const response = await requestOk(url);
    const data = await response.json() as { status?: string; code?: number; message?: string; values?: Array<{ datetime?: string; open?: string; high?: string; low?: string; close?: string }> };
    if (data.status === 'error' || !Array.isArray(data.values) || data.values.length < 1) {
      // Do not return provider error text: some gateways echo request metadata.
      throw new Error(data.code ? `Twelve Data rejected the request (provider code ${data.code}).` : 'Twelve Data returned no valid candles.');
    }
    const candle = data.values[0];
    const prices = [candle.open, candle.high, candle.low, candle.close].map(Number);
    if (!candle.datetime || !prices.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error('Twelve Data response did not contain a valid OHLC candle.');
    }
  }));

  if (process.env.FINNHUB_API_KEY?.trim() && process.env.FINNHUB_COMMERCIAL_USE_APPROVED === 'true') tasks.push(probe('finnhub', async () => {
    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', 'OANDA:EUR_USD');
    url.searchParams.set('token', required('FINNHUB_API_KEY'));
    const data = await (await requestOk(url)).json() as { c?: number; t?: number };
    if (typeof data.c !== 'number' || !Number.isFinite(data.c) || data.c <= 0 || typeof data.t !== 'number') {
      throw new Error('Finnhub returned no valid live quote.');
    }
  }));

  if (process.env.GEMINI_API_KEY?.trim()) tasks.push(probe('gemini', async () => {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('key', required('GEMINI_API_KEY'));
    await requestOk(url);
  }));

  if (process.env.PAYSTACK_SECRET_KEY?.trim()) tasks.push(probe('paystack', async () => {
    const response = await requestOk('https://api.paystack.co/transaction?perPage=1', {
      headers: { Authorization: `Bearer ${required('PAYSTACK_SECRET_KEY')}`, Accept: 'application/json' },
    });
    const data = await response.json() as { status?: boolean };
    if (data.status !== true) throw new Error('Paystack did not confirm API access.');
  }));

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    || process.env.SUPABASE_ANON_KEY?.trim();
  if (supabaseUrl && supabaseKey) tasks.push(probe('supabase', async () => {
    const url = new URL('/auth/v1/health', supabaseUrl);
    await requestOk(url, { headers: { apikey: supabaseKey } });
  }));

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (redisUrl && redisToken) tasks.push(probe('upstash', async () => {
    const response = await requestOk(new URL('/ping', redisUrl), {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    const data = await response.json() as { result?: string };
    if (data.result !== 'PONG') throw new Error('Redis did not return PONG.');
  }));

  const results = await Promise.all(tasks);
  for (const [name, check] of results) checks[name] = check;

  if (process.env.FRED_API_KEY?.trim() && process.env.FRED_COMMERCIAL_USE_APPROVED !== 'true') checks.fred = { status: 'license_blocked', detail: 'FRED is disabled until commercial use, storage/caching and display rights are reviewed and expressly approved.' };
  if (process.env.TWELVE_DATA_API_KEY?.trim() && process.env.TWELVE_DATA_COMMERCIAL_USE_APPROVED !== 'true') checks.twelve_data = { status: 'license_blocked', detail: 'Twelve Data is disabled until the correct business tier, FX exchange rights and external display/derived-data terms are approved.' };

  for (const [name, variable, approval] of [
    ['finnhub', 'FINNHUB_API_KEY', 'FINNHUB_COMMERCIAL_USE_APPROVED'],
    ['alpha_vantage', 'ALPHA_VANTAGE_API_KEY', 'ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED'],
    ['fmp', 'FMP_API_KEY', 'FMP_COMMERCIAL_USE_APPROVED'],
  ] as const) {
    if (process.env[variable]?.trim() && process.env[approval] !== 'true') checks[name] = { status: 'license_blocked', detail: `${variable} is disabled until the applicable commercial, display, storage and redistribution terms are reviewed and approved.` };
    else if (!process.env[variable]?.trim()) checks[name] = { status: 'not_configured', detail: `${variable} is not configured.` };
  }

  for (const [name, variable] of [
    ['fred', 'FRED_API_KEY'], ['bea', 'BEA_API_KEY'], ['bls', 'BLS_API_KEY'], ['twelve_data', 'TWELVE_DATA_API_KEY'],
    ['finnhub', 'FINNHUB_API_KEY'], ['gemini', 'GEMINI_API_KEY'],
    ['paystack', 'PAYSTACK_SECRET_KEY'],
  ] as const) {
    if (!process.env[variable]?.trim()) checks[name] = { status: 'not_configured', detail: `${variable} is not configured.` };
  }

  checks.fx_provider = process.env.FX_API_KEY?.trim()
    ? { status: 'unknown', detail: 'Key is present, but no provider-specific FX_API_KEY adapter is wired into the current application.' }
    : { status: 'not_configured', detail: 'FX_API_KEY is not configured.' };

  checks.macro_provider = process.env.MACRO_DATA_PROVIDER_URL?.trim() && process.env.MACRO_DATA_PROVIDER_LICENSE_APPROVED !== 'true'
    ? { status: 'license_blocked', detail: 'Custom macro provider is disabled until commercial display, storage and derived-data rights are documented.' }
    : process.env.MACRO_DATA_PROVIDER_URL?.trim()
      ? { status: 'unknown', detail: 'Custom macro endpoint is configured; live schema, timestamps, completeness and licence scope must be validated.' }
      : { status: 'not_configured', detail: 'No custom macro provider endpoint is configured.' };

  checks.market_candles = process.env.MARKET_DATA_PROVIDER_URL?.trim() && process.env.MARKET_DATA_PROVIDER_LICENSE_APPROVED !== 'true'
    ? { status: 'license_blocked', detail: 'Custom market candles are disabled until commercial display and exchange/derived-data rights are documented.' }
    : process.env.MARKET_DATA_PROVIDER_URL?.trim()
    ? { status: 'unknown', detail: 'Market candle endpoint is configured; full symbol/timeframe validation is performed by the signal engine.' }
    : { status: 'not_configured', detail: 'MARKET_DATA_PROVIDER_URL is missing. Technical signals remain unavailable and trading must stay disabled.' };

  checks.bea_bls_application = { status: 'not_integrated', detail: 'BEA/BLS credentials are checked independently above; their full macro-data adapters are not merged into the current main-branch macro snapshot pipeline.' };
  checks.transactional_email = process.env.RESEND_API_KEY?.trim() && process.env.LICENSE_FROM_EMAIL?.trim()
    ? { status: 'unknown', detail: 'Email credentials are present; no test email was sent.' }
    : { status: 'not_configured', detail: 'RESEND_API_KEY and LICENSE_FROM_EMAIL are required for automatic licence email delivery.' };
  checks.cron = process.env.CRON_SECRET?.trim()
    ? { status: 'ok', detail: 'Cron authorization secret is configured.' }
    : { status: 'not_configured', detail: 'CRON_SECRET is missing.' };
  checks.algo_api = (process.env.ALGOLYNC_PRIVATE_KEY || process.env.ALGO_PRIVATE_API_KEY)?.trim()
    ? { status: 'ok', detail: 'Private MT5 API authentication key is configured.' }
    : { status: 'not_configured', detail: 'ALGOLYNC_PRIVATE_KEY (legacy alias ALGO_PRIVATE_API_KEY) is missing.' };

  const values = Object.values(checks);
  const errors = values.filter((item) => item.status === 'error').length;
  const blockers = values.filter((item) => ['not_configured', 'not_integrated', 'license_blocked'].includes(item.status)).length;
  return NextResponse.json({
    checked_at: new Date().toISOString(),
    overall: errors > 0 ? 'degraded' : blockers > 0 ? 'incomplete' : 'operational',
    summary: { checks: values.length, errors, blockers },
    checks,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
