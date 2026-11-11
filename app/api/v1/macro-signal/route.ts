import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot, getFundamentalSignal } from '@/lib/macroEngine';
import { getTechnicalSignal } from '@/lib/technicalEngine';
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

    const [snapshot, technical] = await Promise.all([
      getMacroSnapshot(),
      getTechnicalSignal(pair),
    ]);
    const fundamental = getFundamentalSignal(snapshot, pair);
    if (!fundamental) {
      return NextResponse.json({ error: 'Macro inputs are unavailable for this instrument.' }, { status: 503 });
    }

    const confluenceScore = Math.max(-100, Math.min(100, Math.round(
      fundamental.score * 0.6 + technical.score * 0.4,
    )));
    const bias = confluenceScore > 0 ? 'BULLISH' : confluenceScore < 0 ? 'BEARISH' : 'NEUTRAL';
    const conviction = Math.abs(confluenceScore);
    const grade = conviction >= 80 ? 'A' : conviction >= 60 ? 'B' : conviction >= 40 ? 'C' : conviction >= 20 ? 'D' : 'E';
    const executionFilter = {
      allow_buys: technical.execution_filter.allow_buys && confluenceScore > 0,
      allow_sells: technical.execution_filter.allow_sells && confluenceScore < 0,
      recommended_lot_multiplier: technical.execution_filter.allow_buys && confluenceScore > 0
        || technical.execution_filter.allow_sells && confluenceScore < 0
        ? technical.execution_filter.recommended_lot_multiplier
        : 0,
    };

    return NextResponse.json({
      status: 'success',
      pair,
      confluence_score: confluenceScore,
      grade,
      bias,
      fundamental_score: fundamental.score,
      technical_score: technical.score,
      score: confluenceScore,
      policy_diff_bps: fundamental.policyDiffBps,
      real_yield_diff_bps: fundamental.realYieldDiffBps,
      cot_position_diff: fundamental.cotPositionDiff,
      execution_filter: executionFilter,
      technical_available: technical.available,
      gaussian_z_score: technical.gaussian_z_score,
      kaufman_efficiency_ratio: technical.kaufman_efficiency_ratio,
      market_regime: technical.regime,
      atr_stop_pips: technical.atr_stop_pips,
      atr_take_profit_pips: technical.atr_take_profit_pips,
      timestamp: new Date().toISOString(),
      data_as_of: snapshot.asOf,
      source: snapshot.source,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('MT5 macro signal request failed:', error);
    return NextResponse.json({ error: 'Macro signal is temporarily unavailable.' }, { status: 503 });
  }
}