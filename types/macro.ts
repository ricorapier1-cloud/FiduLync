export type MacroCurrency = {
  code: string;
  centralBank: string;
  policyRate: number;
  inflation: number;
  inflationLabel: string;
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
  source: 'seed' | 'provider';
  currencies: MacroCurrency[];
  cot: CotPosition[];
  catalysts: EconomicCatalyst[];
};
