export type MacroCurrency = {
  code: string;
  centralBank: string;
  policyRate: number;
  inflation: number;
  inflationLabel: string;
  corePce?: number;
  cpi?: number;
  twoYearYield?: number;
  twoYearYieldSource?: 'provider' | 'reference';
  policyRateSource?: 'provider' | 'reference';
  inflationSource?: 'provider' | 'reference';
  stance: string;
};

export type CotPosition = {
  market: string;
  netContracts: number;
  percentile: number;
  weeklyChange: number;
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

export type MacroSnapshot = {
  asOf: string;
  source: 'fallback' | 'provider' | 'partial';
  cotSource?: 'unavailable' | 'provider';
  calendarSource?: 'reference' | 'provider';
  ecbRates?: Record<string, number>;
  currencies: MacroCurrency[];
  cot: CotPosition[];
  catalysts: EconomicCatalyst[];
};

export type MarketQuote = {
  symbol: 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'XAUUSD';
  price: number;
  changePercent: number | null;
  timestamp: string;
  source: 'finnhub' | 'frankfurter' | 'exchangerate-api' | 'gold-api';
};
