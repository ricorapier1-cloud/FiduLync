import type { MacroSnapshot, ProviderStatus } from '@/types/macro';

function isFresh(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function feedStatus(available: boolean, fresh: boolean, configured: boolean) {
  if (available && fresh) return { status: 'HEALTHY' as const, freshness: 'LATEST PUBLISHED' as const };
  if (available) return { status: 'DEGRADED' as const, freshness: 'STALE' as const };
  return { status: configured ? 'DEGRADED' as const : 'UNCONFIGURED' as const, freshness: 'UNAVAILABLE' as const };
}

/**
 * Health is derived from actual observations in the snapshot, never from the
 * mere presence of a key. Request latency is left null until measured by the
 * ingestion adapter itself.
 */
export function getProviderTelemetry(snapshot: MacroSnapshot): ProviderStatus[] {
  const usd = snapshot.currencies.find((item) => item.code === 'USD');
  const eur = snapshot.currencies.find((item) => item.code === 'EUR');
  const gbp = snapshot.currencies.find((item) => item.code === 'GBP');
  const cad = snapshot.currencies.find((item) => item.code === 'CAD');
  const worldBankCurrencies = snapshot.currencies.filter((item) => item.inflationSource === 'provider' && item.inflationObservationDate);
  const fredConfigured = Boolean(process.env.FRED_API_KEY?.trim()) && process.env.FRED_COMMERCIAL_USE_APPROVED === 'true';
  const finnhubConfigured = Boolean(process.env.FINNHUB_API_KEY?.trim()) && process.env.FINNHUB_COMMERCIAL_USE_APPROVED === 'true';
  const bls = feedStatus(Boolean(usd?.unemploymentObservationDate && usd.wageGrowthObservationDate),
    isFresh(usd?.unemploymentObservationDate, 120) && isFresh(usd?.wageGrowthObservationDate, 120), Boolean(process.env.BLS_API_KEY?.trim()));
  const bea = feedStatus(Boolean(usd?.gdpObservationDate), Boolean(usd?.gdpObservationDate), Boolean(process.env.BEA_API_KEY?.trim()));

  const fred = feedStatus(Boolean(usd?.policyRateObservationDate && usd.inflationObservationDate),
    isFresh(usd?.policyRateObservationDate, 180) && isFresh(usd?.inflationObservationDate, 120), fredConfigured);
  const ecb = feedStatus(Boolean(eur?.policyRateObservationDate && eur.inflationObservationDate),
    isFresh(eur?.policyRateObservationDate, 180) && isFresh(eur?.inflationObservationDate, 120), true);
  const boe = feedStatus(Boolean(gbp?.policyRateObservationDate),
    isFresh(gbp?.policyRateObservationDate, 180), true);
  const boc = feedStatus(Boolean(cad?.policyRateObservationDate && cad.inflationObservationDate),
    isFresh(cad?.policyRateObservationDate, 180) && isFresh(cad?.inflationObservationDate, 120), true);
  const cftc = feedStatus(snapshot.cotSource === 'provider' && snapshot.cot.length > 0,
    snapshot.cot.some((item) => isFresh(item.reportDate, 14)), true);
  const calendar = feedStatus(snapshot.calendarSource === 'provider' && snapshot.catalysts.length > 0,
    snapshot.catalysts.some((item) => Date.parse(item.scheduledAt) >= Date.now() - 24 * 60 * 60 * 1000), finnhubConfigured);
  const worldBank = feedStatus(worldBankCurrencies.length > 0,
    worldBankCurrencies.some((item) => isFresh(item.inflationObservationDate, 365)), true);

  return [
    { name: 'FRED / US macro', endpoint: 'https://api.stlouisfed.org/fred/series/observations', ...fred, latencyMs: null, lastSuccessfulSyncUtc: fred.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'ECB Data Portal', endpoint: 'https://data-api.ecb.europa.eu/service/data', ...ecb, latencyMs: null, lastSuccessfulSyncUtc: ecb.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Bank of England', endpoint: 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp', ...boe, latencyMs: null, lastSuccessfulSyncUtc: boe.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Bank of Canada Valet', endpoint: 'https://www.bankofcanada.ca/valet/observations', ...boc, latencyMs: null, lastSuccessfulSyncUtc: boc.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'CFTC Commitments of Traders', endpoint: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json', ...cftc, latencyMs: null, lastSuccessfulSyncUtc: cftc.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'World Bank CPI', endpoint: 'https://api.worldbank.org/v2/country', ...worldBank, latencyMs: null, lastSuccessfulSyncUtc: worldBank.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'US Bureau of Labor Statistics', endpoint: 'https://api.bls.gov/publicAPI/v2/timeseries/data/', ...bls, latencyMs: null, lastSuccessfulSyncUtc: bls.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'US Bureau of Economic Analysis', endpoint: 'https://apps.bea.gov/api/data/', ...bea, latencyMs: null, lastSuccessfulSyncUtc: bea.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Economic Calendar', endpoint: 'Provider calendar adapter', ...calendar, latencyMs: null, lastSuccessfulSyncUtc: calendar.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
  ];
}
