export type DeskQuoteContext = {
  symbol: string;
  mid: number;
  observation_time_utc: string;
  source: string;
  quote_type: 'PROVIDER_QUOTE' | 'REFERENCE_RATE';
};

export type MacroContextPayload = {
  schema_version: '1.0.0';
  generated_at_utc: string;
  timezone: 'Africa/Lagos';
  symbol: string;
  base: string;
  quote: string;
  macro_regime: string;
  fundamental_bias: string;
  decision_status: 'INSUFFICIENT_EVIDENCE' | 'RESEARCH_CONTEXT_AVAILABLE';
  bias_score: number | null;
  confidence: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT_EVIDENCE';
  policy_diff_bps: number | null;
  real_policy_rate_diff_bps: number | null;
  real_yield_diff_bps: null;
  two_year_yield_diff_bps: number | null;
  cot_percentile_diff: number | null;
  cross_asset_confirmation: string;
  live_quotes: DeskQuoteContext[];
  daily_governance: {
    state: 'NOT_CONNECTED_TO_SERVER';
    trades_taken: null;
    losses: null;
    locked: null;
    authority: 'MT5_ACCOUNT_SIDE_ENFORCEMENT_REQUIRED';
  };
  calendar_verified: boolean;
  event_risk_status: 'PROVIDER_CALENDAR' | 'UNVERIFIED_CALENDAR';
  news_lockout: boolean;
  next_catalyst: {
    title: string;
    scheduled_at_utc: string;
    region: string;
    impact: 'High' | 'Medium';
    lockout_active: boolean;
  } | null;
  invalidation_triggers: string[];
  provenance: {
    as_of_utc: string;
    source_mode: 'fallback' | 'provider' | 'partial';
    calendar_source: 'reference' | 'provider';
    cot_source: 'unavailable' | 'provider';
  };
  disclaimer: string;
};
