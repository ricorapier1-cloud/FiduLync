import 'server-only';

import { getCachedData } from '@/lib/redisCache';
import { getCboeVixHistory } from '@/lib/cboeVix';

type Observation = {
  date: string;
  value: number;
};

type FeedState = 'HEALTHY' | 'STALE' | 'UNAVAILABLE' | 'UNCONFIGURED';

export type GoldQuote = {
  source: 'SWISSQUOTE' | 'XAUS' | 'UNAVAILABLE';
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spreadUsd: number | null;
  quoteTimestampUtc: string | null;
  retrievedAtUtc: string;
  latencyMs: number | null;
  isStale: boolean;
  state: FeedState;
};

export type DriverObservation = {
  seriesId: string;
  value: number | null;
  observationDate: string | null;
  retrievedAtUtc: string | null;
  latencyMs: number | null;
  state: FeedState;
  observationsUsed: number;
  zScore65: number | null;
};

export type GoldMacroContext = {
  generatedAtUtc: string;
  quoteTimestampUtc: string | null;
  cftcReportDate: string | null;
  overallState: 'AVAILABLE' | 'INSUFFICIENT_EVIDENCE' | 'UNAVAILABLE';
  liquidityRegime:
    | 'RISK_ON_CARRY'
    | 'NEUTRAL_BALANCED'
    | 'RISK_OFF_DELEVERAGING'
    | 'INSUFFICIENT_EVIDENCE';
  goldBiasScore: number | null;
  directionalVerdict:
    | 'BULLISH'
    | 'BEARISH'
    | 'NEUTRAL'
    | 'INSUFFICIENT_EVIDENCE';
  supportingEvidence: string[];
  contradictingEvidence: string[];
  invalidationTriggers: string[];
  quote: GoldQuote;
  drivers: {
    DFII10: DriverObservation;
    T10YIE: DriverObservation;
    DGS2: DriverObservation;
    DTB3: DriverObservation;
    BAMLH0A0HYM2: DriverObservation;
    VIXCLS: DriverObservation;
    twoYearMinusThreeMonthPct: number | null;
  };
  cot: {
    market: string;
    nonCommercialLong: number | null;
    nonCommercialShort: number | null;
    nonCommercialNet: number | null;
    reportDate: string | null;
    retrievedAtUtc: string | null;
    latencyMs: number | null;
    state: FeedState;
  };
  telemetry: {
    totalLatencyMs: number;
    fredLatencyMs: number | null;
    cftcLatencyMs: number | null;
    quoteLatencyMs: number | null;
  };
  methodology: {
    rollingWindowObservations: 65;
    rollingZScoreFormula: string;
    quoteStaleAfterMinutes: 60;
    fredSeriesCadence: 'PUBLISHED_DAILY';
    cftcCadence: 'WEEKLY';
    interpretation: string;
    scoreWeights: {
      DFII10RealYieldZ: 35;
      HighYieldOasZ: 20;
      T10YIE20ObservationChange: 15;
      DGS2MinusDTB3: 10;
      VIXCLS: 10;
      CFTCNetPosition: 10;
    };
  };
};

type TimedResult<T> = {
  value: T;
  latencyMs: number;
  retrievedAtUtc: string;
};

type QuoteCandidate = {
  bid: number | null;
  ask: number | null;
  mid: number;
  timestampUtc: string;
};

type CftcPosition = {
  market: string;
  long: number;
  short: number;
  net: number;
  reportDate: string;
};

const FRED_SERIES = [
  'DFII10',
  'T10YIE',
  'DGS2',
  'DTB3',
  'BAMLH0A0HYM2',
  'VIXCLS',
] as const;

const QUOTE_MAX_AGE_MS = 60 * 60 * 1000;
const FRED_MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000;
const CFTC_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const FRED_WINDOW = 65;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value))) {
    const numeric = Number(value);
    const milliseconds = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function ageMs(timestampUtc: string | null): number | null {
  if (!timestampUtc) return null;
  const timestamp = Date.parse(timestampUtc);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Date.now() - timestamp);
}

function stateForObservation(date: string | null, maxAgeMs: number): FeedState {
  if (!date) return 'UNAVAILABLE';
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return 'UNAVAILABLE';
  const age = Date.now() - timestamp;
  if (age < -5 * 60_000) return 'UNAVAILABLE';
  return age <= maxAgeMs ? 'HEALTHY' : 'STALE';
}

function parseObservationRows(payload: unknown): Observation[] {
  if (!isRecord(payload) || !Array.isArray(payload.observations)) return [];
  return payload.observations.flatMap((raw): Observation[] => {
    if (!isRecord(raw) || typeof raw.date !== 'string') return [];
    const value = finiteNumber(raw.value);
    if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return [];
    return [{ date: raw.date, value }];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

type TimedFetchError = Error & { latencyMs: number };

function failedLatency(error: unknown): number | null {
  return isRecord(error) ? finiteNumber(error.latencyMs) : null;
}

async function timedFetch<T>(operation: () => Promise<T>): Promise<TimedResult<T>> {
  const started = performance.now();
  try {
    const value = await operation();
    return {
      value,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      retrievedAtUtc: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream request failed.';
    const failure = new Error(message) as TimedFetchError;
    failure.latencyMs = Math.max(0, Math.round(performance.now() - started));
    throw failure;
  }
}

async function fetchFredSeries(seriesId: typeof FRED_SERIES[number], apiKey: string): Promise<TimedResult<Observation[]>> {
  return timedFetch(async () => {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', seriesId);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('limit', '100');
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 365);
    url.searchParams.set('observation_start', start.toISOString().slice(0, 10));

    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('FRED ' + seriesId + ' returned HTTP ' + response.status + '.');
    const observations = parseObservationRows(await response.json() as unknown)
      .sort((left, right) => right.date.localeCompare(left.date));
    if (observations.length === 0) throw new Error('FRED ' + seriesId + ' returned no usable observations.');
    return observations;
  });
}

function rollingZScore(observations: Observation[]): number | null {
  if (observations.length < FRED_WINDOW) return null;
  const window = observations.slice(0, FRED_WINDOW).map((item) => item.value);
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / window.length;
  const standardDeviation = Math.sqrt(variance);
  if (!Number.isFinite(standardDeviation) || standardDeviation === 0) return null;
  return (window[0] - mean) / standardDeviation;
}

function makeUnavailableDriver(seriesId: string): DriverObservation {
  return {
    seriesId,
    value: null,
    observationDate: null,
    retrievedAtUtc: null,
    latencyMs: null,
    state: 'UNAVAILABLE',
    observationsUsed: 0,
    zScore65: null,
  };
}

function makeDriver(
  seriesId: typeof FRED_SERIES[number],
  result: TimedResult<Observation[]> | null,
): DriverObservation {
  if (!result) return makeUnavailableDriver(seriesId);
  const latest = result.value[0];
  if (!latest) return makeUnavailableDriver(seriesId);
  const state = stateForObservation(latest.date, FRED_MAX_AGE_MS);
  return {
    seriesId,
    value: latest.value,
    observationDate: latest.date,
    retrievedAtUtc: result.retrievedAtUtc,
    latencyMs: result.latencyMs,
    state,
    observationsUsed: result.value.length,
    zScore65: seriesId === 'DFII10' || seriesId === 'BAMLH0A0HYM2'
      ? rollingZScore(result.value)
      : null,
  };
}

function extractSwissquoteQuote(payload: unknown): QuoteCandidate | null {
  if (!Array.isArray(payload)) return null;
  for (const item of payload) {
    if (!isRecord(item) || !Array.isArray(item.spreadProfilePrices)) continue;
    for (const raw of item.spreadProfilePrices) {
      if (!isRecord(raw)) continue;
      const bid = finiteNumber(raw.bid);
      const ask = finiteNumber(raw.ask);
      const timestampUtc = parseTimestamp(raw.ts);
      if (bid === null || ask === null || bid <= 0 || ask <= 0 || ask < bid || !timestampUtc) continue;
      return {
        bid,
        ask,
        mid: (bid + ask) / 2,
        timestampUtc,
      };
    }
  }
  return null;
}

async function fetchSwissquoteQuote(): Promise<TimedResult<QuoteCandidate>> {
  return timedFetch(async () => {
    const response = await fetch(
      'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD',
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new Error('Swissquote returned HTTP ' + response.status + '.');
    const quote = extractSwissquoteQuote(await response.json() as unknown);
    if (!quote) throw new Error('Swissquote returned no valid XAU/USD bid/ask quote.');
    return quote;
  });
}

async function fetchXausQuote(): Promise<TimedResult<QuoteCandidate>> {
  return timedFetch(async () => {
    const response = await fetch('https://xaus.com/api/v1/spot?compact=1', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('XAUS returned HTTP ' + response.status + '.');
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error('XAUS returned an invalid spot payload.');
    const mid = finiteNumber(payload.spot_usd_oz);
    const timestampUtc = parseTimestamp(payload.price_as_of) ?? parseTimestamp(payload.updated_at);
    if (mid === null || mid <= 0 || !timestampUtc) throw new Error('XAUS returned no valid USD gold spot observation.');
    return { bid: null, ask: null, mid, timestampUtc };
  });
}

async function fetchGoldQuote(): Promise<GoldQuote> {
  let primary: TimedResult<QuoteCandidate> | null = null;
  let primaryFailureLatencyMs = 0;
  try {
    primary = await getCachedData('xau:spot:swissquote:v1', fetchSwissquoteQuote, 10);
    const stale = (ageMs(primary.value.timestampUtc) ?? Number.POSITIVE_INFINITY) > QUOTE_MAX_AGE_MS;
    if (!stale) {
      return {
        source: 'SWISSQUOTE',
        bid: primary.value.bid,
        ask: primary.value.ask,
        mid: primary.value.mid,
        spreadUsd: primary.value.ask !== null && primary.value.bid !== null
          ? primary.value.ask - primary.value.bid
          : null,
        quoteTimestampUtc: primary.value.timestampUtc,
        retrievedAtUtc: primary.retrievedAtUtc,
        latencyMs: primary.latencyMs,
        isStale: false,
        state: 'HEALTHY',
      };
    }
  } catch (error) {
    primaryFailureLatencyMs = failedLatency(error) ?? 0;
    primary = null;
  }

  try {
    const fallback = await getCachedData('xau:spot:xaus:v1', fetchXausQuote, 30);
    const stale = (ageMs(fallback.value.timestampUtc) ?? Number.POSITIVE_INFINITY) > QUOTE_MAX_AGE_MS;
    return {
      source: 'XAUS',
      bid: fallback.value.bid,
      ask: fallback.value.ask,
      mid: fallback.value.mid,
      spreadUsd: null,
      quoteTimestampUtc: fallback.value.timestampUtc,
      retrievedAtUtc: fallback.retrievedAtUtc,
      latencyMs: fallback.latencyMs + (primary?.latencyMs ?? primaryFailureLatencyMs),
      isStale: stale,
      state: stale ? 'STALE' : 'HEALTHY',
    };
  } catch (error) {
    const fallbackFailureLatencyMs = failedLatency(error) ?? 0;
    return {
      source: 'UNAVAILABLE',
      bid: null,
      ask: null,
      mid: null,
      spreadUsd: null,
      quoteTimestampUtc: null,
      retrievedAtUtc: new Date().toISOString(),
      latencyMs: (primary?.latencyMs ?? primaryFailureLatencyMs) + fallbackFailureLatencyMs,
      isStale: true,
      state: 'UNAVAILABLE',
    };
  }
}

async function fetchCftcGoldPosition(): Promise<TimedResult<CftcPosition>> {
  return timedFetch(async () => {
    const url = new URL('https://publicreporting.cftc.gov/resource/6dca-aqww.json');
    url.searchParams.set('$select', 'report_date_as_yyyy_mm_dd,cftc_contract_market_code,noncomm_positions_long_all,noncomm_positions_short_all');
    url.searchParams.set('$where', "cftc_contract_market_code='088691'");
    url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
    url.searchParams.set('$limit', '1');

    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('CFTC returned HTTP ' + response.status + '.');
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('CFTC returned an invalid positioning payload.');
    const raw = payload.find((item): item is Record<string, unknown> => isRecord(item));
    if (!raw) throw new Error('CFTC returned no COMEX Gold row.');
    const reportDate = parseTimestamp(raw.report_date_as_yyyy_mm_dd);
    const long = finiteNumber(raw.noncomm_positions_long_all);
    const short = finiteNumber(raw.noncomm_positions_short_all);
    if (!reportDate || long === null || short === null || long < 0 || short < 0) {
      throw new Error('CFTC COMEX Gold row failed validation.');
    }
    return {
      market: 'COMEX GOLD (088691)',
      long,
      short,
      net: long - short,
      reportDate: reportDate.slice(0, 10),
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function latestChange(observations: Observation[], lookback: number): number | null {
  if (observations.length <= lookback) return null;
  return observations[0].value - observations[lookback].value;
}

function unavailableCot(): GoldMacroContext['cot'] {
  return {
    market: 'COMEX GOLD (088691)',
    nonCommercialLong: null,
    nonCommercialShort: null,
    nonCommercialNet: null,
    reportDate: null,
    retrievedAtUtc: null,
    latencyMs: null,
    state: 'UNAVAILABLE',
  };
}

function unavailableQuote(): GoldQuote {
  return {
    source: 'UNAVAILABLE',
    bid: null,
    ask: null,
    mid: null,
    spreadUsd: null,
    quoteTimestampUtc: null,
    retrievedAtUtc: new Date().toISOString(),
    latencyMs: null,
    isStale: true,
    state: 'UNAVAILABLE',
  };
}

function classifyRegime(
  realYieldZ: number | null,
  creditOasZ: number | null,
  vix: number | null,
  twoYearThreeMonthSpread: number | null,
): GoldMacroContext['liquidityRegime'] {
  if (realYieldZ === null || creditOasZ === null || vix === null || twoYearThreeMonthSpread === null) {
    return 'INSUFFICIENT_EVIDENCE';
  }
  if ((creditOasZ >= 1.0 && vix >= 22) || creditOasZ >= 2.0) {
    return 'RISK_OFF_DELEVERAGING';
  }
  if (creditOasZ <= 0.5 && vix < 20 && twoYearThreeMonthSpread >= -0.5) {
    return 'RISK_ON_CARRY';
  }
  return 'NEUTRAL_BALANCED';
}

export async function buildGoldMacroContext(): Promise<GoldMacroContext> {
  const totalStarted = performance.now();
  const fredApiKey = process.env.FRED_DATA_STORAGE_PERMISSION_APPROVED === 'true' ? process.env.FRED_API_KEY?.trim() ?? '' : '';

  const quotePromise = fetchGoldQuote();
  const cboeVixStarted = performance.now();
  const cboeVixPromise = getCachedData('macro:cboe-vix-history-v1', getCboeVixHistory, 60 * 60).catch(() => null);
  let cftcFailureLatencyMs = 0;
  const cotPromise = getCachedData('xau:cot:cftc-088691:v1', fetchCftcGoldPosition, 6 * 60 * 60).catch((error: unknown) => {
    cftcFailureLatencyMs = failedLatency(error) ?? 0;
    return null;
  });
  const fredPromises = fredApiKey
    ? FRED_SERIES.map(async (seriesId) => {
      try {
        return [seriesId, await getCachedData('xau:fred:' + seriesId + ':v1', () => fetchFredSeries(seriesId, fredApiKey), 15 * 60), null] as const;
      } catch (error) {
        return [seriesId, null, failedLatency(error)] as const;
      }
    })
    : FRED_SERIES.map(async (seriesId) => [seriesId, null, null] as const);

  const [quoteResult, cotResult, fredResults, cboeVixResult] = await Promise.all([
    quotePromise.catch(() => unavailableQuote()),
    cotPromise,
    Promise.all(fredPromises),
    cboeVixPromise,
  ]);

  const fredBySeries = new Map<string, TimedResult<Observation[]> | null>();
  for (const [seriesId, result] of fredResults) fredBySeries.set(seriesId, result);
  if (cboeVixResult && !fredBySeries.get('VIXCLS')) {
    fredBySeries.set('VIXCLS', {
      value: cboeVixResult.history.map((item) => ({ date: item.date, value: item.value })),
      latencyMs: Math.max(0, Math.round(performance.now() - cboeVixStarted)),
      retrievedAtUtc: cboeVixResult.retrievedAtUtc,
    });
  }
  const drivers = {
    DFII10: makeDriver('DFII10', fredBySeries.get('DFII10') ?? null),
    T10YIE: makeDriver('T10YIE', fredBySeries.get('T10YIE') ?? null),
    DGS2: makeDriver('DGS2', fredBySeries.get('DGS2') ?? null),
    DTB3: makeDriver('DTB3', fredBySeries.get('DTB3') ?? null),
    BAMLH0A0HYM2: makeDriver('BAMLH0A0HYM2', fredBySeries.get('BAMLH0A0HYM2') ?? null),
    VIXCLS: makeDriver('VIXCLS', fredBySeries.get('VIXCLS') ?? null),
    twoYearMinusThreeMonthPct: null as number | null,
  };

  const dgs2 = fredBySeries.get('DGS2')?.value[0];
  const dtb3 = fredBySeries.get('DTB3')?.value[0];
  if (dgs2 && dtb3 && drivers.DGS2.state === 'HEALTHY' && drivers.DTB3.state === 'HEALTHY') {
    drivers.twoYearMinusThreeMonthPct = Number((dgs2.value - dtb3.value).toFixed(4));
  }

  const cot = cotResult
    ? {
      market: cotResult.value.market,
      nonCommercialLong: cotResult.value.long,
      nonCommercialShort: cotResult.value.short,
      nonCommercialNet: cotResult.value.net,
      reportDate: cotResult.value.reportDate,
      retrievedAtUtc: cotResult.retrievedAtUtc,
      latencyMs: cotResult.latencyMs,
      state: stateForObservation(cotResult.value.reportDate, CFTC_MAX_AGE_MS),
    } satisfies GoldMacroContext['cot']
    : unavailableCot();

  const cotReportDate = cot.reportDate;
  const quoteTimestampUtc = quoteResult.quoteTimestampUtc;
  const fredLatencyValues = fredResults.flatMap(([, result, failureLatency]) => result ? [result.latencyMs] : failureLatency === null ? [] : [failureLatency]);
  const fredLatencyMs = fredLatencyValues.length
    ? Math.max(...fredLatencyValues)
    : null;
  const cftcLatencyMs = cotResult?.latencyMs ?? (cftcFailureLatencyMs > 0 ? cftcFailureLatencyMs : null);
  const quoteLatencyMs = quoteResult.latencyMs;
  const totalLatencyMs = Math.max(0, Math.round(performance.now() - totalStarted));

  const requiredFeedsHealthy = Boolean(
    quoteResult.mid !== null
    && quoteResult.state === 'HEALTHY'
    && cot.state === 'HEALTHY'
    && FRED_SERIES.every((seriesId) => {
      const driver = drivers[seriesId];
      return driver.state === 'HEALTHY' && driver.value !== null;
    })
    && drivers.DFII10.zScore65 !== null
    && drivers.BAMLH0A0HYM2.zScore65 !== null
    && drivers.twoYearMinusThreeMonthPct !== null
  );

  const realYieldZ = drivers.DFII10.zScore65;
  const creditOasZ = drivers.BAMLH0A0HYM2.zScore65;
  const vix = drivers.VIXCLS.value;
  const breakevenChange = latestChange(fredBySeries.get('T10YIE')?.value ?? [], 20);
  const forwardSpread = drivers.twoYearMinusThreeMonthPct;
  const cotNet = cot.nonCommercialNet;

  let goldBiasScore: number | null = null;
  let directionalVerdict: GoldMacroContext['directionalVerdict'] = 'INSUFFICIENT_EVIDENCE';
  let liquidityRegime: GoldMacroContext['liquidityRegime'] = 'INSUFFICIENT_EVIDENCE';
  const supportingEvidence: string[] = [];
  const contradictingEvidence: string[] = [];
  const invalidationTriggers: string[] = [];

  if (requiredFeedsHealthy
    && realYieldZ !== null
    && creditOasZ !== null
    && vix !== null
    && breakevenChange !== null
    && forwardSpread !== null
    && cotNet !== null) {
    const cotDirection = clamp(cotNet / Math.max(Math.abs(cot.nonCommercialLong ?? 0) + Math.abs(cot.nonCommercialShort ?? 0), 1), -1, 1);
    const components = [
      { name: '10Y real-yield pressure', score: -35 * clamp(realYieldZ / 3, -1, 1), evidence: 'DFII10 65-observation z-score ' + realYieldZ.toFixed(2) },
      { name: 'high-yield credit stress', score: 20 * clamp(creditOasZ / 3, -1, 1), evidence: 'ICE BofA US HY OAS 65-observation z-score ' + creditOasZ.toFixed(2) },
      { name: 'breakeven inflation momentum', score: 15 * clamp(breakevenChange / 0.5, -1, 1), evidence: 'T10YIE 20-observation change ' + breakevenChange.toFixed(3) + ' percentage points' },
      { name: '2Y minus 3M curve', score: 10 * clamp(forwardSpread / 1.5, -1, 1), evidence: 'DGS2 minus DTB3 ' + forwardSpread.toFixed(3) + ' percentage points' },
      { name: 'volatility stress', score: 10 * clamp((vix - 20) / 20, -1, 1), evidence: 'VIXCLS latest published value ' + vix.toFixed(2) },
      { name: 'CFTC non-commercial positioning', score: 10 * cotDirection, evidence: 'CFTC COMEX Gold non-commercial net ' + cotNet.toLocaleString('en-US') + ' contracts' },
    ];
    goldBiasScore = Math.round(clamp(components.reduce((sum, item) => sum + item.score, 0), -100, 100));
    directionalVerdict = goldBiasScore >= 20
      ? 'BULLISH'
      : goldBiasScore <= -20
        ? 'BEARISH'
        : 'NEUTRAL';
    liquidityRegime = classifyRegime(realYieldZ, creditOasZ, vix, forwardSpread);

    for (const component of components) {
      if (component.score >= 3) supportingEvidence.push(component.evidence);
      else if (component.score <= -3) contradictingEvidence.push(component.evidence);
    }
    if (realYieldZ > 1) invalidationTriggers.push('Reassess bullish gold exposure if DFII10 real-yield z-score remains above +1.0.');
    if (realYieldZ < -1) invalidationTriggers.push('Reassess bearish gold exposure if DFII10 real-yield z-score remains below -1.0.');
    if (creditOasZ > 1.5) invalidationTriggers.push('Reassess the risk-off interpretation if high-yield OAS normalizes below its rolling mean.');
    if (cotNet !== 0) invalidationTriggers.push('Reassess positioning confirmation after the next published CFTC COMEX Gold report.');
    if (invalidationTriggers.length === 0) invalidationTriggers.push('Reassess the score when any required official observation is revised or a new release is published.');
  }

  const anyEvidence = quoteResult.mid !== null
    || FRED_SERIES.some((seriesId) => drivers[seriesId].value !== null)
    || cot.reportDate !== null;
  const overallState = requiredFeedsHealthy && goldBiasScore !== null
    ? 'AVAILABLE'
    : anyEvidence ? 'INSUFFICIENT_EVIDENCE' : 'UNAVAILABLE';

  const fredKeyMissing = !fredApiKey;
  if (fredKeyMissing) {
    for (const seriesId of FRED_SERIES) {
      drivers[seriesId] = makeUnavailableDriver(seriesId);
    }
    drivers.twoYearMinusThreeMonthPct = null;
  }

  return {
    generatedAtUtc: new Date().toISOString(),
    quoteTimestampUtc,
    cftcReportDate: cotReportDate,
    overallState,
    liquidityRegime,
    goldBiasScore,
    directionalVerdict,
    supportingEvidence,
    contradictingEvidence,
    invalidationTriggers,
    quote: quoteResult,
    drivers,
    cot,
    telemetry: {
      totalLatencyMs,
      fredLatencyMs,
      cftcLatencyMs,
      quoteLatencyMs,
    },
    methodology: {
      rollingWindowObservations: FRED_WINDOW,
      rollingZScoreFormula: 'Z = (latest observation - arithmetic mean of latest 65 valid observations) / population standard deviation of those 65 observations.',
      quoteStaleAfterMinutes: 60,
      fredSeriesCadence: 'PUBLISHED_DAILY',
      cftcCadence: 'WEEKLY',
      interpretation: 'Deterministic research heuristic, not a calibrated probability or trading instruction. Score is withheld unless the spot quote, all six FRED series, both 65-observation z-scores, and the current CFTC report pass freshness validation. DGS2 minus DTB3 is a 2-year versus 3-month yield-curve spread, not a directly observed forward rate.',
      scoreWeights: {
        DFII10RealYieldZ: 35,
        HighYieldOasZ: 20,
        T10YIE20ObservationChange: 15,
        DGS2MinusDTB3: 10,
        VIXCLS: 10,
        CFTCNetPosition: 10,
      },
    },
  };
}
