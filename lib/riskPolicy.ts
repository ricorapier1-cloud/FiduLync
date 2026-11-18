import 'server-only';

import type { RiskPolicy } from '@/lib/quantGovernance';

/**
 * Server-owned starting policy based on the owner's existing Quant_Core
 * guardrails. It is deliberately non-executable until demo validation,
 * model evidence and explicit owner review are complete.
 *
 * Never accept a RiskPolicy object from an EA, browser or request body.
 */
export const DEFAULT_PERSONAL_RISK_POLICY: Readonly<RiskPolicy> = Object.freeze({
  policyVersion: 'personal-quant-1.0.0',
  executionEnabled: false,
  modelValidated: false,
  executionQualityVerified: false,
  maxPerTradeRiskPct: 1.0,
  maxPortfolioRiskPct: 2.0,
  maxDailyDrawdownPct: 4.0,
  maxWeeklyDrawdownPct: 8.0,
  maxHighWaterDrawdownPct: 15.0,
  maxMarginUsagePct: 10.0,
  maxSpreadPoints: 30,
  maxQuoteAgeMs: 2_000,
  maxConsecutiveLosses: 3,
  rewardRiskMinimum: 1.5,
});

export function getPersonalRiskPolicy(): RiskPolicy {
  return { ...DEFAULT_PERSONAL_RISK_POLICY };
}
