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
    const nearestEvent = snapshot.catalysts.filter((event) => event.impact === 'High')
      .map((event) => ({ event, minutes: (Date.parse(event.scheduledAt) - Date.now()) / 60_000 }))
      .filter((item) => Number.isFinite(item.minutes))
      .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const rateDecision = Boolean(nearestEvent && /rate decision|interest rate|monetary policy decision|policy rate/i.test(nearestEvent.event.title));
    const shield = evaluateSovereignShield({
      vix: context.drivers.VIXCLS.value,
      eventMinutesAway: nearestEvent?.minutes ?? null,
      isCentralBankRateDecision: rateDecision,
      cotPercentiles: snapshot.cot.map((position) => ({ symbol: position.market, percentile: position.percentile })),
      governance: { tradesToday: null, lossesToday: null, rollingSevenDayDrawdownPct: null, ledgerVerified: false },
    });
    const status = context.overallState === 'AVAILABLE' ? 200 : 503;
    return NextResponse.json({ ...context, sovereignShield: shield }, { status, headers: responseHeaders });
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
