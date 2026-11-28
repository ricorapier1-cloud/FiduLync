import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { evaluateSovereignShield } from '@/lib/quant/sovereignShield';
import { getStrategyValidationGate } from '@/lib/quant/strategyValidationGate';

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

function isFreshCotReport(date: string | undefined, maxAgeDays = 14): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const ageMs = Date.now() - timestamp;
  return Number.isFinite(timestamp) && ageMs >= -5 * 60_000 && ageMs <= maxAgeDays * 86_400_000;
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.MACRO_API_TOKEN?.trim()
    || process.env.MACROLYNC_API_SECRET?.trim()
    || process.env.ALGO_PRIVATE_API_KEY?.trim();
  if (!expected || expected.length < 32) return false;

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  const candidate = bearerToken;
  if (!candidate) return false;

  return safeEqual(candidate, expected);
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
      { status: 'UNAUTHORIZED', error: 'A valid private bearer token is required.' },
      { status: 401, headers: responseHeaders },
    );
  }

  try {
    const [snapshot, validationGate] = await Promise.all([getMacroSnapshot(), getStrategyValidationGate()]);
    const context = await buildGoldMacroContext(snapshot);
    const calendarRetrievedAtMs = snapshot.calendarRetrievedAtUtc ? Date.parse(snapshot.calendarRetrievedAtUtc) : NaN;
    const calendarCoverageEndMs = snapshot.calendarCoverageEndUtc ? Date.parse(snapshot.calendarCoverageEndUtc) : NaN;
    const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider)
      && Number.isFinite(calendarRetrievedAtMs) && Date.now() - calendarRetrievedAtMs <= 60 * 60_000
      && Date.now() - calendarRetrievedAtMs >= -30_000
      && Number.isFinite(calendarCoverageEndMs) && calendarCoverageEndMs >= Date.now() + 24 * 60 * 60_000;
    const highImpactEvents = (calendarVerified ? snapshot.catalysts : []).filter((event) => event.impact === 'High')
      .map((event) => ({ event, minutes: (Date.parse(event.scheduledAt) - Date.now()) / 60_000 }))
      .filter((item) => Number.isFinite(item.minutes));
    const nearestEvent = [...highImpactEvents].sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const nearestRateDecision = highImpactEvents
      .filter((item) => /rate decision|interest rate|monetary policy decision|policy rate/i.test(item.event.title))
      .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];
    const rateDecision = Boolean(nearestRateDecision && Math.abs(nearestRateDecision.minutes) <= 60);
    const eventMinutesAway = rateDecision ? nearestRateDecision!.minutes : nearestEvent?.minutes ?? null;
    const shield = evaluateSovereignShield({
      vix: context.drivers.VIXCLS.state === 'HEALTHY' ? context.drivers.VIXCLS.value : null,
      eventMinutesAway,
      isCentralBankRateDecision: rateDecision,
      cotPercentiles: snapshot.cot
        .filter((position) => position.sampleSize !== undefined && position.sampleSize >= 52
          && position.percentile !== null && isFreshCotReport(position.reportDate))
        .map((position) => ({ symbol: position.market, percentile: position.percentile as number })),
      governance: { tradesToday: null, lossesToday: null, rollingSevenDayDrawdownPct: null, ledgerVerified: false },
    });
    const newsLockoutActive = !calendarVerified || Boolean(eventMinutesAway !== null && Math.abs(eventMinutesAway) <= 30);
    const status = context.overallState === 'AVAILABLE' ? 200 : 503;
    return NextResponse.json({
      ...context,
      calendarVerified,
      calendarRetrievedAtUtc: calendarVerified ? snapshot.calendarRetrievedAtUtc : null,
      calendarCoverageEndUtc: calendarVerified ? snapshot.calendarCoverageEndUtc : null,
      newsLockoutActive,
      strategyValidationStatus: validationGate.status,
      strategyValidationBlockers: validationGate.blockers,
      allowedToTrade: false,
      sovereignShield: shield,
    }, { status, headers: responseHeaders });
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
