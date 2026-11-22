import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMacroSnapshot, getFundamentalSignal } from '@/lib/macroEngine';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Installation = { id: string; status: string };
const CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
const REGION_ALIASES: Record<string, string[]> = {
  USD: ['USD', 'US', 'USA', 'UNITED STATES', 'FEDERAL RESERVE'],
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
  if (!value || !hasTimezone(value)) return false;
  const time = Date.parse(value);
  const age = Date.now() - time;
  return Number.isFinite(time) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
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
  if (!/^[A-Z]{6}$/.test(symbol) || !CURRENCIES.has(symbol.slice(0, 3)) || !CURRENCIES.has(symbol.slice(3))) {
    return response({ error: 'A supported G8 currency pair is required.' }, 400);
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
      && base.inflationSource === 'provider' && isFresh(base.policyRateAsOf, 10)
      && isFresh(base.inflationAsOf, 60));
    const quoteVerified = Boolean(quote && quote.policyRateSource === 'provider'
      && quote.inflationSource === 'provider' && isFresh(quote.policyRateAsOf, 10)
      && isFresh(quote.inflationAsOf, 60));
    const evidenceVerified = snapshot.source !== 'fallback' && baseVerified && quoteVerified;
    const assessment = evidenceVerified ? getFundamentalSignal(snapshot, symbol) : null;

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
      data_status: evidenceVerified ? snapshot.source.toUpperCase() : 'INSUFFICIENT_EVIDENCE',
      fundamental_bias: bias,
      fundamental_score: score,
      score_method: 'Uncalibrated policy, inflation, positioning and cross-asset heuristic; not a probability or execution signal.',
      macro_regime: evidenceVerified && policyDiffBps !== null && Math.abs(policyDiffBps) >= 50
        ? 'POLICY_DIVERGENCE' : evidenceVerified ? 'MIXED_OR_UNCONFIRMED' : 'INSUFFICIENT_EVIDENCE',
      policy_rate_differential_bps: evidenceVerified ? policyDiffBps : null,
      policy_real_rate_proxy_differential_bps: evidenceVerified ? realRateDiffBps : null,
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
      ],
    });
  } catch (error) {
    console.error('Read-only macro context request failed:', error instanceof Error ? error.message : 'unknown error');
    return response({ error: 'Macro context is temporarily unavailable.' }, 503);
  }
}
