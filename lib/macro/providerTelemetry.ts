import type { ProviderStatus } from '@/types/macro';

/**
 * Configuration is not proof of provider health. Until ingestion records a
 * successful request, latency and last-success fields intentionally remain null.
 */
export function getProviderTelemetry(): ProviderStatus[] {
  const providers = [
    {
      name: 'FRED (Federal Reserve Bank of St. Louis)',
      endpoint: 'https://api.stlouisfed.org/fred/series/observations',
      configured: Boolean(process.env.FRED_API_KEY?.trim()),
    },
    {
      name: 'European Central Bank (ECB Data Portal)',
      endpoint: 'https://data-api.ecb.europa.eu/service/data',
      configured: true,
    },
    {
      name: 'CFTC Commitments of Traders',
      endpoint: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json',
      configured: true,
    },
    {
      name: 'Bank of Canada (Valet API)',
      endpoint: 'https://www.bankofcanada.ca/valet/observations',
      configured: true,
    },
    {
      name: 'Finnhub Economic Calendar',
      endpoint: 'https://finnhub.io/api/v1/calendar/economic',
      configured: Boolean(process.env.FINNHUB_API_KEY?.trim()),
    },
    {
      name: 'Upstash Redis Distributed Cache',
      endpoint: 'Upstash REST',
      configured: Boolean(
        process.env.UPSTASH_REDIS_REST_URL?.trim()
        && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
      ),
    },
  ];

  return providers.map((provider) => ({
    name: provider.name,
    endpoint: provider.endpoint,
    // A configured credential or public endpoint is not a successful health check.
    status: provider.configured ? 'DEGRADED' : 'UNCONFIGURED',
    latencyMs: null,
    lastSuccessfulSyncUtc: null,
    rateLimitRemaining: null,
    circuitBreakerTripped: false,
    freshness: 'UNAVAILABLE',
  }));
}
