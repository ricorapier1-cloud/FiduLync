import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot } from '@/lib/macroData';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

const instruments = new Map<string, { base: string; quote: string }>([
  ['EURUSD', { base: 'EUR', quote: 'USD' }],
  ['USDJPY', { base: 'USD', quote: 'JPY' }],
  ['GBPUSD', { base: 'GBP', quote: 'USD' }],
  ['AUDUSD', { base: 'AUD', quote: 'USD' }],
  ['USDCHF', { base: 'USD', quote: 'CHF' }],
  ['EURGBP', { base: 'EUR', quote: 'GBP' }],
  ['EURJPY', { base: 'EUR', quote: 'JPY' }],
  ['GBPJPY', { base: 'GBP', quote: 'JPY' }],
  ['AUDJPY', { base: 'AUD', quote: 'JPY' }],
  ['XAUUSD', { base: 'XAU', quote: 'USD' }],
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pair = (url.searchParams.get('pair') ?? 'EURUSD').toUpperCase();
  const apiKey = url.searchParams.get('api_key') ?? '';
  if (!/^ml_[a-f0-9]{64}$/.test(apiKey)) {
    return NextResponse.json({ error: 'A valid API key is required.' }, { status: 401 });
  }
  const instrument = instruments.get(pair);
  if (!instrument) {
    return NextResponse.json({ error: 'Unsupported instrument.' }, { status: 400 });
  }

  try {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const { data: keyRecord, error: keyError } = await getSupabaseAdmin().from('macro_api_keys')
      .select('id')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .maybeSingle();
    if (keyError) throw keyError;
    if (!keyRecord) return NextResponse.json({ error: 'A valid API key is required.' }, { status: 401 });

    const snapshot = await getMacroSnapshot();
    const quote = snapshot.currencies.find((currency) => currency.code === instrument.quote);
    const base = instrument.base === 'XAU'
      ? null
      : snapshot.currencies.find((currency) => currency.code === instrument.base);
    const cotBase = snapshot.cot.find((position) => position.market === (instrument.base === 'XAU' ? 'GOLD' : instrument.base));
    const cotQuote = snapshot.cot.find((position) => position.market === instrument.quote);
    if (!quote || (instrument.base !== 'XAU' && !base)) {
      return NextResponse.json({ error: 'Macro inputs are unavailable for this instrument.' }, { status: 503 });
    }

    const policyDiffBps = base
      ? Math.round((base.policyRate - quote.policyRate) * 100)
      : Math.round(-quote.policyRate * 100);
    const realYieldDiffBps = base
      ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
      : Math.round(-(quote.policyRate - quote.inflation) * 100);
    const rawScore = base
      ? (base.policyRate - quote.policyRate) * 12
        + ((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 9
        + ((cotBase?.percentile ?? 50) - (cotQuote?.percentile ?? 50)) * 0.18
      : (quote.policyRate - quote.inflation) * -18
        + ((cotBase?.percentile ?? 50) - 50) * 0.18;
    const score = Math.max(-100, Math.min(100, Math.round(rawScore)));
    const bias = score > 0 ? 'BULLISH' : score < 0 ? 'BEARISH' : 'NEUTRAL';

    return NextResponse.json({
      status: 'success',
      pair,
      bias,
      score,
      policy_diff_bps: policyDiffBps,
      real_yield_diff_bps: realYieldDiffBps,
      cot_position_diff: Math.round((cotBase?.percentile ?? 50) - (cotQuote?.percentile ?? 50)),
      execution_filter: { allow_buys: score > 0, allow_sells: score < 0 },
      timestamp: new Date().toISOString(),
      data_as_of: snapshot.asOf,
      source: snapshot.source,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('MT5 macro signal request failed:', error);
    return NextResponse.json({ error: 'Macro signal is temporarily unavailable.' }, { status: 503 });
  }
}