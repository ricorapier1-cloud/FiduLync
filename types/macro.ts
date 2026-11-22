export type DataFreshness =
  | 'LIVE'
  | 'DELAYED'
  | 'LATEST PUBLISHED'
  | 'CACHED'
  | 'STALE'
  | 'DERIVED'
  | 'UNAVAILABLE';

export type MacroRegime =
  | 'POLICY_DIVERGENCE_CARRY'
  | 'INFLATION_SHOCK_HAWKISH'
  | 'GROWTH_SLOWDOWN_RISK_OFF'
  | 'COMMODITY_DRIVEN'
  | 'EVENT_LOCKOUT_HIGH_UNCERTAINTY'
  | 'INSUFFICIENT_EVIDENCE';

export type FundamentalBias =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'BEARISH'
  | 'STRONG_BEARISH';

export type ConfidenceLevel =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INSUFFICIENT_EVIDENCE';

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
  policyRateObservationDate?: string;
  inflationObservationDate?: string;
  twoYearYieldObservationDate?: string;
  stance: string;
  gdpGrowthYoY?: number;
  unemploymentRate?: number;
  freshness?: DataFreshness;
  lastUpdatedUtc?: string;
};

export type CotPosition = {
  market: string;
  netContracts: number;
  percentile: number;
  weeklyChange: number;
  commercialNet?: number;
  openInterest?: number;
  reportDate?: string;
  freshness?: DataFreshness;
};

export type EconomicCatalyst = {
  id: string;
  region: string;
  title: string;
  scheduledAt: string;
  impact: 'High' | 'Medium';
  consensus: string;
  actual: string | null;
  previous?: string | null;
  revised?: string | null;
  lockoutActive?: boolean;
};

export type CrossAssetTelemetry = {
  usTwoYearYield: number;
  usTenYearYield: number;
  usTenYearRealYield: number;
  usBreakevenTenYear: number;
  broadTradeWeightedUsd: number;
  vix: number;
  vixRegime: 'LOW' | 'ELEVATED' | 'STRESS';
  goldUsd: number;
  crudeWti: number;
  brentCrude: number;
  copperUsd: number;
  highYieldSpreadBps: number;
  globalRiskAppetite: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  timestampUtc: string;
  freshness: DataFreshness;
};

export type CountryFundamentalProfile = {
  currency: string;
  country: string;
  centralBank: string;
  policyRate: number;
  headlineInflation: number;
  coreInflation: number;
  inflationAcceleration: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  gdpGrowthYoY: number;
  gdpGrowthQoQ: number;
  pmiComposite: number;
  unemploymentRate: number;
  wageGrowthYoY: number;
  currentAccountGdpPct: number;
  fiscalBalanceGdpPct: number;
  commoditySensitivity: 'NET_EXPORTER' | 'NET_IMPORTER' | 'BALANCED' | 'SOVEREIGN_HEDGE';
  centralBankStance: 'RESTRICTIVE_HOLD' | 'HAWKISH_TIGHTENING' | 'NEUTRAL' | 'DOVISH_PIVOT' | 'ACCOMMODATIVE';
  twoYearSovereignYield: number | null;
  tenYearSovereignYield: number | null;
  realRatePct: number;
  freshness: DataFreshness;
  lastUpdatedUtc: string;
};

export type PairDossier = {
  symbol: string;
  base: string;
  quote: string;
  macroRegime: MacroRegime;
  fundamentalBias: FundamentalBias;
  biasScore: number; // -100 to +100
  confidence: ConfidenceLevel;
  policyDiffBps: number;
  realYieldDiffBps: number;
  twoYearYieldDiffBps: number | null;
  cotPercentileDiff: number;
  crossAssetConfirmation: string;
  summary: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  scenarios: {
    bullish: { probabilityPct: number; title: string; catalysts: string[] };
    bearish: { probabilityPct: number; title: string; catalysts: string[] };
    neutral: { probabilityPct: number; title: string; catalysts: string[] };
  };
  invalidationTriggers: string[];
  nextCatalyst: {
    title: string;
    scheduledAt: string;
    region: string;
    impact: 'High' | 'Medium';
    lockoutActive: boolean;
  } | null;
  eventRiskLockout: boolean;
};

export type ProviderStatus = {
  name: string;
  endpoint: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNCONFIGURED';
  latencyMs: number | null;
  lastSuccessfulSyncUtc: string | null;
  rateLimitRemaining: number | null;
  circuitBreakerTripped: boolean;
  freshness: DataFreshness;
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
  crossAsset?: CrossAssetTelemetry;
  regime?: MacroRegime;
  countryProfiles?: CountryFundamentalProfile[];
  providerStatus?: ProviderStatus[];
};

export type MarketQuote = {
  symbol: 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'XAUUSD';
  price: number;
  changePercent: number | null;
  timestamp: string;
  source: 'mt5' | 'finnhub' | 'frankfurter' | 'exchangerate-api' | 'gold-api';
};

export type ResearchHypothesis = {
  id: string;
  pair: string;
  regime: MacroRegime;
  bias: FundamentalBias;
  confidence: ConfidenceLevel;
  thesis: string;
  supportingEvidence: string[];
  invalidationConditions: string[];
  scenarios: {
    bullPct: number;
    basePct: number;
    bearPct: number;
  };
  status: 'ACTIVE' | 'VALIDATED' | 'INVALIDATED' | 'RETIRED';
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type RegimeBacktestCycle = {
  cycleId: string;
  period: string;
  regime: MacroRegime;
  primaryPair: string;
  policySpreadBps: number;
  benchmarkReturnPct: number;
  maxDrawdownPct: number;
  sampleObservations: number;
  sampleSizeAdequate: boolean;
  vintageIntegrity: 'POINT_IN_TIME_VERIFIED' | 'REVISION_ADJUSTED';
  regimeStability: 'STABLE' | 'TRANSITIONAL' | 'HIGH_VOLATILITY';
  methodologyNotes: string;
};
