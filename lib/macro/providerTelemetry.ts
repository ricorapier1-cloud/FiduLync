import type { MacroSnapshot, ProviderStatus } from '@/types/macro';

function isFresh(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function latestDate(...dates: Array<string | undefined>): string | null {
  return dates.filter((date): date is string => Boolean(date) && Number.isFinite(Date.parse(date!))).sort().at(-1) ?? null;
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
  const fredStorageAllowed = process.env.FRED_DATA_STORAGE_PERMISSION_APPROVED === 'true';
  const finnhubKeyPresent = Boolean(process.env.FINNHUB_API_KEY?.trim());
  const finnhubPlanActive = process.env.FINNHUB_PERSONAL_PLAN_ACTIVE === 'true';
  const finnhubConfigured = finnhubPlanActive && finnhubKeyPresent;
  const calendarConfigured = finnhubConfigured
    || process.env.FAIRECONOMY_COMMERCIAL_USE_APPROVED === 'true'
    || (process.env.FMP_COMMERCIAL_USE_APPROVED === 'true' && Boolean(process.env.FMP_API_KEY?.trim()));
  const bls = feedStatus(usd?.unemploymentProvider === 'BLS' && usd.wageGrowthProvider === 'BLS',
    isFresh(usd?.unemploymentObservationDate, 120) && isFresh(usd?.wageGrowthObservationDate, 120), true);
  const bea = feedStatus(usd?.gdpProvider === 'BEA' && Boolean(usd.gdpObservationDate), Boolean(usd?.gdpObservationDate), Boolean(process.env.BEA_API_KEY?.trim()));

  const fred = !fredStorageAllowed && fredKeyPresent
    ? { status: 'PERMISSION_REQUIRED' as const, freshness: 'UNAVAILABLE' as const }
    : feedStatus(fredStorageAllowed && Boolean(usd?.policyRateProvider === 'FRED' && usd.inflationProvider === 'FRED'),
      fredStorageAllowed && isFresh(usd?.policyRateObservationDate, 180) && isFresh(usd?.inflationObservationDate, 120), fredKeyPresent && fredStorageAllowed);
  const ecb = feedStatus(eur?.policyRateProvider === 'ECB' && eur.inflationProvider === 'ECB',
    isFresh(eur?.policyRateObservationDate, 180) && isFresh(eur?.inflationObservationDate, 120), true);
  const boe = feedStatus(gbp?.policyRateProvider === 'Bank of England' && Boolean(gbp.policyRateObservationDate),
    isFresh(gbp?.policyRateObservationDate, 180), true);
  const boc = feedStatus(cad?.policyRateProvider === 'Bank of Canada' && cad.inflationProvider === 'Bank of Canada',
    isFresh(cad?.policyRateObservationDate, 180) && isFresh(cad?.inflationObservationDate, 120), true);
  const cftc = feedStatus(snapshot.cotSource === 'provider' && snapshot.cot.length > 0,
    snapshot.cot.some((item) => isFresh(item.reportDate, 14)), true);
  const calendar = finnhubKeyPresent && !finnhubPlanActive && !calendarConfigured
    ? { status: 'PERMISSION_REQUIRED' as const, freshness: 'UNAVAILABLE' as const }
    : feedStatus(snapshot.calendarSource === 'provider' && snapshot.catalysts.length > 0,
      snapshot.catalysts.some((item) => Date.parse(item.scheduledAt) >= Date.now() - 60 * 60 * 1000 && Date.parse(item.scheduledAt) <= Date.now() + 45 * 24 * 60 * 60 * 1000), calendarConfigured);
  const bisCoverage = snapshot.currencies.filter((item) => item.policyRateProvider === 'BIS' && item.inflationProvider === 'BIS').length;
  const bis = feedStatus(bisCoverage >= 4, bisCoverage >= 4, true);
  const riksbank = feedStatus(sek?.policyRateProvider === 'Sveriges Riksbank',
    isFresh(sek?.policyRateObservationDate, 180), true);
  const norgesBank = feedStatus(nok?.policyRateProvider === 'Norges Bank',
    isFresh(nok?.policyRateObservationDate, 180), true);
  const worldBank = feedStatus(worldBankCurrencies.length > 0,
    worldBankCurrencies.some((item) => isFresh(item.inflationObservationDate, 365)), true);
  const eiaConfigured = Boolean(process.env.EIA_API_KEY?.trim());
  const treasury = feedStatus(Boolean(snapshot.usTreasury),
    snapshot.usTreasury?.freshness === 'LATEST PUBLISHED', true);
  const cboeVix = feedStatus(Boolean(snapshot.vix),
    snapshot.vix?.freshness === 'LATEST PUBLISHED', true);
  const eia = feedStatus(Boolean(snapshot.energyMarkets),
    Boolean(snapshot.energyMarkets && isFresh(snapshot.energyMarkets.wti.observationDate, 10) && isFresh(snapshot.energyMarkets.brent.observationDate, 10)), eiaConfigured);

  return [
    { name: 'FRED / Federal Reserve Economic Data', endpoint: 'https://api.stlouisfed.org/fred/series/observations', ...fred, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(usd?.policyRateObservationDate, usd?.inflationObservationDate), detail: !fredStorageAllowed && fredKeyPresent ? 'FRED key is configured but storage permission is not approved; cached FRED observations are excluded from active research.' : 'Provider status is based on fresh observations, not key presence.', nextAction: !fredStorageAllowed && fredKeyPresent ? 'Confirm FRED data-use/storage rights, then set FRED_DATA_STORAGE_PERMISSION_APPROVED=true in Vercel Production. Treasury, BIS and BLS alternatives remain active.' : undefined, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'ECB Data Portal', endpoint: 'https://data-api.ecb.europa.eu/service/data', ...ecb, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(eur?.policyRateObservationDate, eur?.inflationObservationDate), rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Bank of England', endpoint: 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp', ...boe, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: gbp?.policyRateObservationDate ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Bank of Canada Valet', endpoint: 'https://www.bankofcanada.ca/valet/observations', ...boc, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(cad?.policyRateObservationDate, cad?.inflationObservationDate), rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'CFTC Commitments of Traders', endpoint: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json', ...cftc, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(...snapshot.cot.map((item) => item.reportDate)), rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'BIS Statistics / G8 policy rates & CPI', endpoint: 'https://stats.bis.org/api/v2/data/dataflow/BIS', ...bis, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(...snapshot.currencies.filter((item) => item.policyRateProvider === 'BIS' || item.inflationProvider === 'BIS').flatMap((item) => [item.policyRateObservationDate, item.inflationObservationDate])), rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'World Bank CPI', endpoint: 'https://api.worldbank.org/v2/country', ...worldBank, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(...worldBankCurrencies.map((item) => item.inflationObservationDate)), rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'U.S. Energy Information Administration (WTI / Brent)', endpoint: 'https://api.eia.gov/v2/seriesid/', ...eia, latencyMs: null, lastSuccessfulSyncUtc: snapshot.energyMarkets?.wti.retrievedAtUtc ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'U.S. Treasury daily nominal and TIPS yield curves', endpoint: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml', ...treasury, latencyMs: null, lastSuccessfulSyncUtc: snapshot.usTreasury?.retrievedAtUtc ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Cboe VIX daily closing history', endpoint: 'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', ...cboeVix, latencyMs: null, lastSuccessfulSyncUtc: snapshot.vix?.retrievedAtUtc ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Sveriges Riksbank policy rate', endpoint: 'https://api.riksbank.se/swea/v1/Observations/Latest/SECBREPOEFF', ...riksbank, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: sek?.policyRateObservationDate ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Norges Bank policy rate', endpoint: 'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R', ...norgesBank, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: nok?.policyRateObservationDate ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'US Bureau of Labor Statistics', endpoint: 'https://api.bls.gov/publicAPI/v2/timeseries/data/', ...bls, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: latestDate(usd?.unemploymentObservationDate, usd?.wageGrowthObservationDate), rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'US Bureau of Economic Analysis', endpoint: 'https://apps.bea.gov/api/data/', ...bea, latencyMs: null, lastSuccessfulSyncUtc: null, latestObservationDate: usd?.gdpObservationDate ?? null, rateLimitRemaining: null, circuitBreakerTripped: false },
    { name: 'Economic Calendar', endpoint: 'Provider calendar adapter', ...calendar, latencyMs: null, lastSuccessfulSyncUtc: null, detail: snapshot.calendarSource === 'provider' ? 'Provider calendar events are available.' : 'No approved provider returned verified upcoming events. Event risk remains fail-closed; no static dates are inserted.', nextAction: !finnhubPlanActive && finnhubKeyPresent ? 'Confirm Finnhub personal-plan rights, then set FINNHUB_PERSONAL_PLAN_ACTIVE=true in Vercel Production. Otherwise approve an eligible FairEconomy/FMP feed.' : 'Enable an approved calendar adapter or keep the event gate blocked.', rateLimitRemaining: null, circuitBreakerTripped: false },
  ];
}
