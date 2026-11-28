import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot, getFundamentalSignal } from '@/lib/macroEngine';
import { isObservationFresh } from '@/lib/dataFreshness';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
const CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);
const SUPPORTED_NON_FX_SYMBOLS = new Set(['XAUUSD']);
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
const REGION_ALIASES: Record<string, string[]> = {
  USD: ['USD', 'US', 'USA', 'UNITED STATES', 'FEDERAL RESERVE'],
  XAU: ['XAU', 'GOLD'],
  EUR: ['EUR', 'EU', 'EURO AREA', 'EUROZONE', 'EUROPEAN CENTRAL BANK'],
  GBP: ['GBP', 'UK', 'UNITED KINGDOM', 'BRITAIN', 'BANK OF ENGLAND'],
  JPY: ['JPY', 'JP', 'JAPAN', 'BANK OF JAPAN'],
  CHF: ['CHF', 'CH', 'SWITZERLAND', 'SWISS NATIONAL BANK'],
  CAD: ['CAD', 'CA', 'CANADA', 'BANK OF CANADA'],
  AUD: ['AUD', 'AU', 'AUSTRALIA', 'RESERVE BANK OF AUSTRALIA'],
  NZD: ['NZD', 'NZ', 'NEW ZEALAND', 'RESERVE BANK OF NEW ZEALAND'],
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function hasTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function validTimestamp(value: string | null): boolean {
  if (!value || !hasTimezone(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && Math.abs(Date.now() - time) <= 60_000;
}

function isFresh(value: string | undefined, maxAgeDays: number): boolean {
  return isObservationFresh(value, maxAgeDays * 86_400_000);
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return response({ error: 'Macro context authentication is unavailable.' }, 503);

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const sentAt = request.headers.get('x-mt5-timestamp');
  if (!token.startsWith('flmt5_') || token.length < 40 || !validTimestamp(sentAt)) {
    return response({ error: 'Valid installation authentication and timestamp are required.' }, 401);
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') ?? '').trim().toUpperCase();
  const isG8Pair = /^[A-Z]{6}$/.test(symbol)
    && symbol.slice(0, 3) !== symbol.slice(3)
    && CURRENCIES.has(symbol.slice(0, 3)) && CURRENCIES.has(symbol.slice(3));
  if (!isG8Pair && !SUPPORTED_NON_FX_SYMBOLS.has(symbol)) {
    return response({ error: 'A supported G8 currency pair or XAUUSD is required.' }, 400);
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const installations = await supabaseRead<Installation[]>(
      'mt5_installations',
      'select=id,status&token_hash=eq.' + tokenHash + '&status=eq.active&limit=1',
    );
    const installation = installations?.[0];
    if (!installation) return response({ error: 'Installation token is invalid or revoked.' }, 401);

    const limit = await enforceDistributedRateLimit(request, 'macro-context:' + installation.id, 60, 60_000);
    if (limit.unavailable) return response({ error: 'Rate-limit service is unavailable.' }, 503);
    if (!limit.allowed) return response({ error: 'Installation rate limit exceeded.' }, 429);

    const snapshot = await getMacroSnapshot();
    const now = Date.now();
    const baseCode = symbol.slice(0, 3);
    const quoteCode = symbol.slice(3);
    const base = snapshot.currencies.find((item) => item.code === baseCode);
    const quote = snapshot.currencies.find((item) => item.code === quoteCode);
    const baseVerified = Boolean(base && base.policyRateSource === 'provider'
      && base.inflationSource === 'provider' && isFresh(base.policyRateAsOf, 180)
      && isFresh(base.inflationAsOf, 75));
    const quoteVerified = Boolean(quote && quote.policyRateSource === 'provider'
      && quote.inflationSource === 'provider' && isFresh(quote.policyRateAsOf, 180)
      && isFresh(quote.inflationAsOf, 75));
    const pairRatesVerified = snapshot.source !== 'fallback' && baseVerified && quoteVerified;
    const requiredRiskCurrencies = ['AUD', 'NZD', 'CAD', 'JPY', 'CHF'];
    const riskCurrencyCoverage = requiredRiskCurrencies.every((code) => {
      const item = snapshot.currencies.find((currency) => currency.code === code);
      return Boolean(item && item.policyRateSource === 'provider' && item.inflationSource === 'provider'
        && isFresh(item.policyRateAsOf, 180) && isFresh(item.inflationAsOf, 75));
    });
    const twoYearYieldCoverage = Boolean(base && quote
      && base.twoYearYieldSource === 'provider' && quote.twoYearYieldSource === 'provider'
      && isFresh(base.twoYearYieldAsOf, 10) && isFresh(quote.twoYearYieldAsOf, 10));
    const hasReleasedCot = (market: string) => snapshot.cot.some((item) =>
      item.market === market
      && typeof item.sampleSize === 'number'
      && Number.isSafeInteger(item.sampleSize) && item.sampleSize >= 52
      && typeof item.publishedAt === 'string'
      && hasTimezone(item.publishedAt)
      && isFresh(item.publishedAt, 14));
    const baseCotReleaseVerified = hasReleasedCot(baseCode === 'XAU' ? 'GOLD' : baseCode);
    const quoteCotReleaseVerified = hasReleasedCot(quoteCode);
    const cotCoverage = snapshot.cotSource === 'provider'
      && baseCotReleaseVerified && quoteCotReleaseVerified;
    const compositeEvidenceVerified = pairRatesVerified && riskCurrencyCoverage
      && twoYearYieldCoverage && cotCoverage;
    const assessment = compositeEvidenceVerified ? getFundamentalSignal(snapshot, symbol) : null;
    const evidenceVerified = compositeEvidenceVerified && assessment !== null;

    const highImpactEvents = snapshot.catalysts
      .filter((event) => {
        if (event.impact !== 'High' || !hasTimezone(event.scheduledAt)) return false;
        const eventTime = Date.parse(event.scheduledAt);
        if (!Number.isFinite(eventTime)) return false;
        const region = event.region.toUpperCase();
        const baseAliases = REGION_ALIASES[baseCode] ?? [baseCode];
        const quoteAliases = REGION_ALIASES[quoteCode] ?? [quoteCode];
        const relevantRegion = region === 'GLOBAL'
          || [...baseAliases, ...quoteAliases].some((alias) => region.includes(alias));
        return relevantRegion && eventTime >= now - 15 * 60_000 && eventTime <= now + 24 * 60 * 60_000;
      })
      .map((event) => {
        const eventTime = Date.parse(event.scheduledAt);
        return {
          id: event.id,
          currency_or_region: event.region,
          title: event.title,
          scheduled_at_utc: new Date(eventTime).toISOString(),
          minutes_until: Math.round((eventTime - now) / 60_000),
          impact: event.impact,
          actual: event.actual,
          consensus: event.consensus,
        };
      });

    const activeLockout = highImpactEvents.find((event) =>
      event.minutes_until >= -15 && event.minutes_until <= 30);
    const calendarVerified = snapshot.calendarSource === 'provider';
    const policyDiffBps = base && quote
      ? Math.round((base.policyRate - quote.policyRate) * 100)
      : null;
    const realRateDiffBps = base && quote
      ? Math.round(((base.policyRate - base.inflation) - (quote.policyRate - quote.inflation)) * 100)
      : null;
    const score = evidenceVerified && assessment ? assessment.score : null;
    const bias = score === null ? 'INSUFFICIENT_EVIDENCE'
      : score >= 10 ? 'BULLISH_BASE' : score <= -10 ? 'BEARISH_BASE' : 'NEUTRAL';

    return response({
      schema_version: '1.0',
      product: 'FiduLync MacroLync',
      symbol,
      generated_at_utc: new Date(now).toISOString(),
      data_status: pairRatesVerified ? snapshot.source.toUpperCase() : 'INSUFFICIENT_EVIDENCE',
      fundamental_bias: bias,
      bias_status: evidenceVerified ? 'FULL_FACTOR_COVERAGE_UNCALIBRATED' : 'INSUFFICIENT_EVIDENCE',
      fundamental_score: score,
      score_method: 'Uncalibrated multi-factor heuristic; emitted only with full pair, two-year yield, release-timestamped COT with at least 52 observations, and risk-currency coverage. Not a probability or execution signal.',
      evidence_coverage: {
        pair_policy_and_inflation: pairRatesVerified,
        matched_currency_two_year_yields: twoYearYieldCoverage,
        base_and_quote_cot: cotCoverage,
        base_cot_release_verified: baseCotReleaseVerified,
        quote_cot_release_verified: quoteCotReleaseVerified,
        risk_on_and_risk_off_currency_profiles: riskCurrencyCoverage,
        composite_bias_available: evidenceVerified,
      },
      macro_regime: pairRatesVerified && policyDiffBps !== null && Math.abs(policyDiffBps) >= 50
        ? 'POLICY_DIVERGENCE' : pairRatesVerified ? 'MIXED_OR_UNCONFIRMED' : 'INSUFFICIENT_EVIDENCE',
      policy_rate_differential_bps: pairRatesVerified ? policyDiffBps : null,
      policy_real_rate_proxy_differential_bps: pairRatesVerified ? realRateDiffBps : null,
      event_risk: {
        high_impact_lockout: !calendarVerified || Boolean(activeLockout),
        lockout_rule: '30 minutes before through 15 minutes after scheduled high-impact events',
        active_event: activeLockout ?? null,
        upcoming_high_impact_events: highImpactEvents,
        calendar_status: calendarVerified ? 'PROVIDER' : 'REFERENCE_OR_UNAVAILABLE',
      },
      provenance: {
        snapshot_as_of: snapshot.asOf || null,
        snapshot_source: snapshot.source,
        base_currency: base ? {
          code: base.code, policy_rate_source: base.policyRateProvider ?? base.policyRateSource ?? null,
          policy_rate_as_of: base.policyRateAsOf ?? null,
          inflation_source: base.inflationProvider ?? base.inflationSource ?? null,
          inflation_as_of: base.inflationAsOf ?? null,
          policy_rate_source_url: base.policyRateSourceUrl ?? null,
          inflation_source_url: base.inflationSourceUrl ?? null,
        } : null,
        quote_currency: quote ? {
          code: quote.code, policy_rate_source: quote.policyRateProvider ?? quote.policyRateSource ?? null,
          policy_rate_as_of: quote.policyRateAsOf ?? null,
          inflation_source: quote.inflationProvider ?? quote.inflationSource ?? null,
          inflation_as_of: quote.inflationAsOf ?? null,
          policy_rate_source_url: quote.policyRateSourceUrl ?? null,
          inflation_source_url: quote.inflationSourceUrl ?? null,
        } : null,
      },
      limitations: [
        'Research context only; this endpoint never authorizes or executes a broker order.',
        'An absent, stale, partial or unverified input produces INSUFFICIENT_EVIDENCE.',
        'Event lockout is contextual information; each EA must enforce its own local trading and position-protection rules.',
        'This feed does not contain technical entries, stop-losses, take-profits, lot sizes or order instructions.',
        ...(symbol === 'XAUUSD' ? ['Gold-specific real-yield, official-sector demand and positioning model is not validated; no XAUUSD fundamental bias is emitted.'] : []),
      ],
    });
  } catch (error) {
    console.error('Read-only macro context request failed:', error instanceof Error ? error.message : 'unknown error');
    return response({ error: 'Macro context is temporarily unavailable.' }, 503);
  }
}
