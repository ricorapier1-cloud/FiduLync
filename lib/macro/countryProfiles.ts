import type { CountryFundamentalProfile, MacroSnapshot } from '@/types/macro';

export const G8_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] as const;
export type G8Currency = (typeof G8_CURRENCIES)[number];

export const BASELINE_COUNTRY_PROFILES: Record<string, Omit<CountryFundamentalProfile, 'policyRate' | 'headlineInflation' | 'realRatePct' | 'twoYearSovereignYield' | 'lastUpdatedUtc'>> = {
  USD: {
    currency: 'USD',
    country: 'United States',
    centralBank: 'Federal Reserve',
    coreInflation: 2.8,
    inflationAcceleration: 'DECELERATING',
    gdpGrowthYoY: 2.7,
    gdpGrowthQoQ: 0.7,
    pmiComposite: 54.1,
    unemploymentRate: 4.1,
    wageGrowthYoY: 3.8,
    currentAccountGdpPct: -3.0,
    fiscalBalanceGdpPct: -6.2,
    commoditySensitivity: 'SOVEREIGN_HEDGE',
    centralBankStance: 'RESTRICTIVE_HOLD',
    tenYearSovereignYield: 4.42,
    freshness: 'LATEST PUBLISHED',
  },
  EUR: {
    currency: 'EUR',
    country: 'Eurozone',
    centralBank: 'European Central Bank',
    coreInflation: 2.7,
    inflationAcceleration: 'STABLE',
    gdpGrowthYoY: 0.9,
    gdpGrowthQoQ: 0.4,
    pmiComposite: 49.8,
    unemploymentRate: 6.3,
    wageGrowthYoY: 4.5,
    currentAccountGdpPct: 2.8,
    fiscalBalanceGdpPct: -3.6,
    commoditySensitivity: 'NET_IMPORTER',
    centralBankStance: 'DOVISH_PIVOT',
    tenYearSovereignYield: 2.38,
    freshness: 'LATEST PUBLISHED',
  },
  GBP: {
    currency: 'GBP',
    country: 'United Kingdom',
    centralBank: 'Bank of England',
    coreInflation: 3.3,
    inflationAcceleration: 'STABLE',
    gdpGrowthYoY: 1.0,
    gdpGrowthQoQ: 0.1,
    pmiComposite: 51.5,
    unemploymentRate: 4.3,
    wageGrowthYoY: 4.8,
    currentAccountGdpPct: -3.1,
    fiscalBalanceGdpPct: -4.4,
    commoditySensitivity: 'NET_IMPORTER',
    centralBankStance: 'RESTRICTIVE_HOLD',
    tenYearSovereignYield: 4.45,
    freshness: 'LATEST PUBLISHED',
  },
  JPY: {
    currency: 'JPY',
    country: 'Japan',
    centralBank: 'Bank of Japan',
    coreInflation: 2.3,
    inflationAcceleration: 'ACCELERATING',
    gdpGrowthYoY: 0.3,
    gdpGrowthQoQ: 0.2,
    pmiComposite: 49.6,
    unemploymentRate: 2.5,
    wageGrowthYoY: 2.9,
    currentAccountGdpPct: 3.8,
    fiscalBalanceGdpPct: -5.4,
    commoditySensitivity: 'NET_IMPORTER',
    centralBankStance: 'HAWKISH_TIGHTENING',
    tenYearSovereignYield: 1.07,
    freshness: 'LATEST PUBLISHED',
  },
  CHF: {
    currency: 'CHF',
    country: 'Switzerland',
    centralBank: 'Swiss National Bank',
    coreInflation: 0.8,
    inflationAcceleration: 'DECELERATING',
    gdpGrowthYoY: 1.8,
    gdpGrowthQoQ: 0.4,
    pmiComposite: 49.9,
    unemploymentRate: 2.6,
    wageGrowthYoY: 1.7,
    currentAccountGdpPct: 7.2,
    fiscalBalanceGdpPct: -0.4,
    commoditySensitivity: 'SOVEREIGN_HEDGE',
    centralBankStance: 'ACCOMMODATIVE',
    tenYearSovereignYield: 0.42,
    freshness: 'LATEST PUBLISHED',
  },
  CAD: {
    currency: 'CAD',
    country: 'Canada',
    centralBank: 'Bank of Canada',
    coreInflation: 2.6,
    inflationAcceleration: 'DECELERATING',
    gdpGrowthYoY: 1.5,
    gdpGrowthQoQ: 0.3,
    pmiComposite: 50.4,
    unemploymentRate: 6.5,
    wageGrowthYoY: 4.9,
    currentAccountGdpPct: -0.6,
    fiscalBalanceGdpPct: -1.4,
    commoditySensitivity: 'NET_EXPORTER',
    centralBankStance: 'DOVISH_PIVOT',
    tenYearSovereignYield: 3.25,
    freshness: 'LATEST PUBLISHED',
  },
  AUD: {
    currency: 'AUD',
    country: 'Australia',
    centralBank: 'Reserve Bank of Australia',
    coreInflation: 3.5,
    inflationAcceleration: 'STABLE',
    gdpGrowthYoY: 1.0,
    gdpGrowthQoQ: 0.2,
    pmiComposite: 50.2,
    unemploymentRate: 4.1,
    wageGrowthYoY: 3.5,
    currentAccountGdpPct: 1.2,
    fiscalBalanceGdpPct: -0.3,
    commoditySensitivity: 'NET_EXPORTER',
    centralBankStance: 'RESTRICTIVE_HOLD',
    tenYearSovereignYield: 4.52,
    freshness: 'LATEST PUBLISHED',
  },
  NZD: {
    currency: 'NZD',
    country: 'New Zealand',
    centralBank: 'Reserve Bank of New Zealand',
    coreInflation: 3.1,
    inflationAcceleration: 'DECELERATING',
    gdpGrowthYoY: -0.2,
    gdpGrowthQoQ: -0.5,
    pmiComposite: 46.8,
    unemploymentRate: 4.8,
    wageGrowthYoY: 3.8,
    currentAccountGdpPct: -6.8,
    fiscalBalanceGdpPct: -2.8,
    commoditySensitivity: 'NET_EXPORTER',
    centralBankStance: 'DOVISH_PIVOT',
    tenYearSovereignYield: 4.48,
    freshness: 'LATEST PUBLISHED',
  },
};

export function getCountryProfiles(snapshot: MacroSnapshot): CountryFundamentalProfile[] {
  const nowUtc = snapshot.asOf || new Date().toISOString();
  return G8_CURRENCIES.map((code) => {
    const currency = snapshot.currencies.find((c) => c.code === code);
    const baseline = BASELINE_COUNTRY_PROFILES[code];

    const policyRate = currency?.policyRate ?? (code === 'USD' ? 4.75 : code === 'EUR' ? 3.25 : 4.0);
    const headlineInflation = currency?.inflation ?? (baseline?.coreInflation ?? 2.5);
    const realRatePct = Number((policyRate - headlineInflation).toFixed(2));
    const twoYearYield = currency?.twoYearYield ?? null;

    let stance: CountryFundamentalProfile['centralBankStance'] = baseline.centralBankStance;
    if (code === 'JPY') {
      stance = 'HAWKISH_TIGHTENING';
    } else if (policyRate > 4.0) {
      stance = 'RESTRICTIVE_HOLD';
    } else if (policyRate < 2.0 && policyRate > 0) {
      stance = 'ACCOMMODATIVE';
    }

    return {
      ...baseline,
      policyRate,
      headlineInflation,
      realRatePct,
      twoYearSovereignYield: twoYearYield,
      centralBankStance: stance,
      freshness: currency?.policyRateSource === 'provider' ? 'LIVE' : 'LATEST PUBLISHED',
      lastUpdatedUtc: nowUtc,
    };
  });
}
