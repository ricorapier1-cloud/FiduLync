export type MacroCurrency = {
  code: string;
  centralBank: string;
  policyRate: number;
  inflation: number;
  inflationLabel: string;
  corePce?: number;
  corePceAsOf?: string;
  cpi?: number;
  cpiAsOf?: string;
  twoYearYield?: number;
  twoYearYieldAsOf?: string;
  twoYearYieldSource?: 'provider' | 'reference';
  policyRateSource?: 'provider' | 'reference';
  inflationSource?: 'provider' | 'reference';
  policyRateProvider?: 'fred' | 'alpha-vantage' | 'macro-provider' | 'ecb' | 'bank-of-canada' | 'bank-of-england' | 'bank-of-japan' | 'reserve-bank-of-australia' | 'reserve-bank-of-new-zealand' | 'swiss-national-bank';
  inflationProvider?: 'fred' | 'alpha-vantage' | 'macro-provider' | 'ecb' | 'bank-of-canada' | 'world-bank';
  policyRateAsOf?: string;
  inflationAsOf?: string;
  policyRateSourceUrl?: string;
  inflationSourceUrl?: string;
  stance: string;
};

export type CotPosition = {
  market: string;
  netContracts: number;
  percentile: number;
  weeklyChange: number;
  asOf?: string;
};

export type EconomicCatalyst = {
  id: string;
  region: string;
  title: string;
  scheduledAt: string;
  impact: 'High' | 'Medium';
  consensus: string;
  actual: string | null;
};

export type OfficialUsMacroIndicators = {
  cpiYearOverYearPct?: number;
  cpiPeriod?: string;
  coreCpiYearOverYearPct?: number;
  coreCpiPeriod?: string;
  unemploymentRatePct?: number;
  unemploymentPeriod?: string;
  nonfarmPayrollMonthlyChangeThousands?: number;
  payrollPeriod?: string;
  realGdpAnnualizedQuarterlyPct?: number;
  realGdpPeriod?: string;
  tenYearTreasuryYieldPct?: number;
  tenYearTreasuryYieldAsOf?: string;
  tenYearRealYieldPct?: number;
  tenYearRealYieldAsOf?: string;
  tenYearBreakevenInflationPct?: number;
  tenYearBreakevenInflationAsOf?: string;
  usdBroadIndex?: number;
  usdBroadIndexAsOf?: string;
  vixIndex?: number;
  vixIndexAsOf?: string;
  sp500Index?: number;
  sp500IndexAsOf?: string;
  wtiOilUsd?: number;
  wtiOilAsOf?: string;
  brentOilUsd?: number;
  brentOilAsOf?: string;
  usHighYieldSpreadPct?: number;
  usHighYieldSpreadAsOf?: string;
  retrievedAt: string;
  sources: string[];
};

export type MacroSnapshot = {
  usIndicators?: OfficialUsMacroIndicators;
  asOf: string;
  source: 'fallback' | 'provider' | 'partial';
  cotSource?: 'unavailable' | 'provider';
  cotProvider?: 'cftc' | 'custom';
  calendarSource?: 'reference' | 'provider';
  calendarProvider?: 'fair-economy' | 'finnhub' | 'fmp' | 'macro-provider';
  ecbRates?: Record<string, number>;
  currencies: MacroCurrency[];
  cot: CotPosition[];
  catalysts: EconomicCatalyst[];
};

export type MarketQuote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  timestamp: string;
  source: 'mt5' | 'finnhub' | 'frankfurter' | 'exchangerate-api' | 'gold-api';
  bid?: number;
  ask?: number;
  spread_points?: number;
  point?: number;
  broker?: string;
  server?: string;
};
