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
  const sek = snapshot.currencies.find((item) => item.code === 'SEK');
  const nok = snapshot.currencies.find((item) => item.code === 'NOK');
  const worldBankCurrencies = snapshot.currencies.filter((item) => item.inflationProvider === 'World Bank' && item.inflationObservationDate);
  const fredKeyPresent = Boolean(process.env.FRED_API_KEY?.trim());
  const fredStorageAllowed = process.env.FRED_DATA_STORAGE_PERMISSION_APPROVED === 'true' || fredKeyPresent;
  const finnhubConfigured = Boolean(process.env.FINNHUB_API_KEY?.trim());
  const bls = feedStatus(usd?.unemploymentProvider === 'BLS' && usd.wageGrowthProvider === 'BLS',
    isFresh(usd?.unemploymentObservationDate, 120) && isFresh(usd?.wageGrowthObservationDate, 120), Boolean(process.env.BLS_API_KEY?.trim()));
  const bea = feedStatus(usd?.gdpProvider === 'BEA' && Boolean(usd.gdpObservationDate), Boolean(usd?.gdpObservationDate), Boolean(process.env.BEA_API_KEY?.trim()));

  const fred = feedStatus(fredStorageAllowed && Boolean(usd?.policyRateProvider === 'FRED' && usd.inflationProvider === 'FRED'),
    fredStorageAllowed && isFresh(usd?.policyRateObservationDate, 180) && isFresh(usd?.inflationObservationDate, 120), fredKeyPresent);
  const ecb = feedStatus(eur?.policyRateProvider === 'ECB' && eur.inflationProvider === 'ECB',
    isFresh(eur?.policyRateObservationDate, 180) && isFresh(eur?.inflationObservationDate, 120), true);
  const boe = feedStatus(gbp?.policyRateProvider === 'Bank of England' && Boolean(gbp.policyRateObservationDate),
    isFresh(gbp?.policyRateObservationDate, 180), true);
  const boc = feedStatus(cad?.policyRateProvider === 'Bank of Canada' && cad.inflationProvider === 'Bank of Canada',
    isFresh(cad?.policyRateObservationDate, 180) && isFresh(cad?.inflationObservationDate, 120), true);
  const cftc = feedStatus(snapshot.cotSource === 'provider' && snapshot.cot.length > 0,
    snapshot.cot.some((item) => isFresh(item.reportDate, 14)), true);
  const calendar = feedStatus(snapshot.calendarSource === 'provider' && snapshot.catalysts.length > 0,
    snapshot.catalysts.some((item) => Date.parse(item.scheduledAt) >= Date.now() - 24 * 60 * 60 * 1000), finnhubConfigured);
  const bisCoverage = snapshot.currencies.filter((item) => item.policyRateProvider === 'BIS' && item.inflationProvider === 'BIS').length;
  const bis = feedStatus(bisCoverage >= 4, bisCoverage >= 4, true);
  const riksbank = feedStatus(sek?.policyRateProvider === 'Sveriges Riksbank',
    isFresh(sek?.policyRateObservationDate, 180), true);
  const norgesBank = feedStatus(nok?.policyRateProvider === 'Norges Bank',
    isFresh(nok?.policyRateObservationDate, 180), true);
  const worldBank = feedStatus(worldBankCurrencies.length > 0,
    worldBankCurrencies.some((item) => isFresh(item.inflationObservationDate, 365)), true);
  const eiaConfigured = Boolean(process.env.EIA_API_KEY?.trim());
  const eia = feedStatus(Boolean(snapshot.energyMarkets),
    Boolean(snapshot.energyMarkets && isFresh(snapshot.energyMarkets.wti.observationDate, 10) && isFresh(snapshot.energyMarkets.brent.observationDate, 10)), eiaConfigured);

  return [
    { name: 'FRED / Federal Reserve Economic Data', endpoint: 'https://api.stlouisfed.org/fred/series/observations', ...fred, latencyMs: null, lastSuccessfulSyncUtc: fred.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'ECB Data Portal', endpoint: 'https://data-api.ecb.europa.eu/service/data', ...ecb, latencyMs: null, lastSuccessfulSyncUtc: ecb.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Bank of England', endpoint: 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp', ...boe, latencyMs: null, lastSuccessfulSyncUtc: boe.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Bank of Canada Valet', endpoint: 'https://www.bankofcanada.ca/valet/observations', ...boc, latencyMs: null, lastSuccessfulSyncUtc: boc.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'CFTC Commitments of Traders', endpoint: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json', ...cftc, latencyMs: null, lastSuccessfulSyncUtc: cftc.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'BIS Statistics / G8 policy rates & CPI', endpoint: 'https://stats.bis.org/api/v2/data/dataflow/BIS', ...bis, latencyMs: null, lastSuccessfulSyncUtc: bis.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'World Bank CPI', endpoint: 'https://api.worldbank.org/v2/country', ...worldBank, latencyMs: null, lastSuccessfulSyncUtc: worldBank.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'U.S. Energy Information Administration (WTI / Brent)', endpoint: 'https://api.eia.gov/v2/seriesid/', ...eia, latencyMs: null, lastSuccessfulSyncUtc: snapshot.energyMarkets?.wti.retrievedAtUtc ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Sveriges Riksbank policy rate', endpoint: 'https://api.riksbank.se/swea/v1/Observations/Latest/SECBREPOEFF', ...riksbank, latencyMs: null, lastSuccessfulSyncUtc: riksbank.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Norges Bank policy rate', endpoint: 'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R', ...norgesBank, latencyMs: null, lastSuccessfulSyncUtc: norgesBank.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'US Bureau of Labor Statistics', endpoint: 'https://api.bls.gov/publicAPI/v2/timeseries/data/', ...bls, latencyMs: null, lastSuccessfulSyncUtc: bls.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'US Bureau of Economic Analysis', endpoint: 'https://apps.bea.gov/api/data/', ...bea, latencyMs: null, lastSuccessfulSyncUtc: bea.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Economic Calendar', endpoint: 'Provider calendar adapter', ...calendar, latencyMs: null, lastSuccessfulSyncUtc: calendar.status === 'HEALTHY' ? snapshot.asOf : null, rateLimitRemaining: null, circuitBreakerTripped: false },
  ];
}
