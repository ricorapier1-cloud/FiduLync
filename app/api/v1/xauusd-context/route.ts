import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { evaluateSovereignShield } from '@/lib/quant/sovereignShield';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safeEqual(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return candidateBuffer.length > 0
    && candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

function isAuthorized(request: Request): boolean {
  const configuredTokens = [
    process.env.MACRO_API_TOKEN?.trim() ?? '',
    process.env.CRON_SECRET?.trim() ?? '',
  ].filter((token) => token.length > 0);

  if (configuredTokens.length === 0) return false;

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  const queryToken = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  const candidate = bearerToken || queryToken;
  if (!candidate) return false;

  return configuredTokens.some((expected) => safeEqual(candidate, expected));
}

const responseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Authorization',
};

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { status: 'UNAUTHORIZED', error: 'A valid bearer token or query token is required.' },
      { status: 401, headers: responseHeaders },
    );
  }

  try {
    const snapshot = await getMacroSnapshot();
    const context = await buildGoldMacroContext(snapshot);
    const now = Date.now();
    const nearestMinutes = (predicate: (event: typeof snapshot.catalysts[number]) => boolean) => {
      const events = snapshot.catalysts.filter(predicate);
      return events.length ? Math.round(Math.min(...events.map((event) => Math.abs(Date.parse(event.scheduledAt) - now))) / 60_000) : null;
    };
    const sovereignShield = evaluateSovereignShield({
      vix: snapshot.vix?.freshness === 'LATEST PUBLISHED' ? snapshot.vix.value : null,
      intradayRange: null,
      atr20: null,
      spreadRatio: null,
      minutesToHighImpactEvent: nearestMinutes((event) => event.impact === 'High'),
      minutesToRateDecision: nearestMinutes((event) => /rate decision|interest rate|monetary policy|policy rate|fomc|ecb meeting|boe rate|boj rate/i.test(event.title)),
      cotPercentiles: Object.fromEntries(snapshot.cot.map((position) => [position.market, Number.isFinite(position.percentile) ? position.percentile : null])),
      rollingSevenDayDrawdownPct: null,
      tradesToday: null,
      lossesToday: null,
    });
    const status = context.overallState === 'AVAILABLE' ? 200 : 503;
    return NextResponse.json({ ...context, sovereignShield }, { status, headers: responseHeaders });
  } catch (error) {
    console.error('XAU/USD macro context engine failed:', error);
    const generatedAtUtc = new Date().toISOString();
    return NextResponse.json({
      generatedAtUtc,
      quoteTimestampUtc: null,
      cftcReportDate: null,
      overallState: 'UNAVAILABLE',
      liquidityRegime: 'INSUFFICIENT_EVIDENCE',
      goldBiasScore: null,
      directionalVerdict: 'INSUFFICIENT_EVIDENCE',
      supportingEvidence: [],
      contradictingEvidence: [],
      invalidationTriggers: [],
      error: 'Required upstream evidence could not be assembled.',
    }, { status: 503, headers: responseHeaders });
  }
}
