import type { ProviderStatus } from '@/types/macro';

/**
 * Credential presence is configuration, not proof of provider availability.
 * A provider becomes HEALTHY only after a real monitored ingestion result is
 * persisted; this module deliberately makes no synthetic health claims.
 */
export function getProviderTelemetry(): ProviderStatus[] {
  const providers = [
    { name: 'FRED', endpoint: 'https://api.stlouisfed.org/fred/series/observations', configured: Boolean(process.env.FRED_API_KEY?.trim()) },
    { name: 'ECB Data Portal', endpoint: 'https://data-api.ecb.europa.eu/service/data', configured: true },
    { name: 'CFTC Commitments of Traders', endpoint: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json', configured: true },
    { name: 'Bank of Canada Valet', endpoint: 'https://www.bankofcanada.ca/valet/observations', configured: true },
    { name: 'Finnhub Economic Calendar', endpoint: 'https://finnhub.io/api/v1/calendar/economic', configured: Boolean(process.env.FINNHUB_API_KEY?.trim()) },
    { name: 'Upstash Redis', endpoint: 'Upstash REST', configured: Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) },
  ];

  return providers.map((provider) => ({
    name: provider.name,
    endpoint: provider.endpoint,
    status: provider.configured ? 'DEGRADED' : 'UNCONFIGURED',
    latencyMs: null,
    lastSuccessfulSyncUtc: null,
    rateLimitRemaining: null,
    circuitBreakerTripped: false,
    freshness: 'UNAVAILABLE',
  }));
}
