import 'server-only';

import { supabaseRead } from '@/lib/supabaseAdmin';
import { RESEARCH_OBJECTIVES } from '@/lib/quant/researchObjectives';

type ValidationReport = {
  id: string;
  research_run_id: string;
  report_type: string;
  evidence: Record<string, unknown>;
  metrics: Record<string, unknown>;
  blockers: string[];
  eligible_for_review: boolean;
  reviewed_at: string | null;
  reviewer_note: string | null;
};

type ResearchRun = {
  id: string;
  status: string;
  code_fingerprint: string;
  dataset_fingerprint: string;
  validation_start: string | null;
  validation_end: string | null;
  out_of_sample_start: string | null;
  out_of_sample_end: string | null;
  completed_at: string | null;
};

export type StrategyValidationGate = {
  status: 'NOT_VALIDATED' | 'VALIDATED';
  verified: boolean;
  approvedReportId: string | null;
  blockers: string[];
  objectives: typeof RESEARCH_OBJECTIVES;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function notValidated(blockers: string[], approvedReportId: string | null = null): StrategyValidationGate {
  return { status: 'NOT_VALIDATED', verified: false, approvedReportId, blockers, objectives: RESEARCH_OBJECTIVES };
}

/**
 * Trading approval is unavailable unless an owner-reviewed, deployment-approval
 * report proves the stated objectives on untouched OOS data after full costs.
 */
export async function getStrategyValidationGate(): Promise<StrategyValidationGate> {
  const reportId = process.env.STRATEGY_VALIDATION_APPROVED_REPORT_ID?.trim() ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reportId)) {
    return notValidated(['NO_OWNER_APPROVED_OUT_OF_SAMPLE_VALIDATION_REPORT']);
  }

  try {
    const query = new URLSearchParams({
      select: 'id,research_run_id,report_type,evidence,metrics,blockers,eligible_for_review,reviewed_at,reviewer_note',
      id: `eq.${reportId}`,
      report_type: 'eq.DEPLOYMENT_APPROVAL',
      eligible_for_review: 'eq.true',
      reviewed_at: 'not.is.null',
      limit: '1',
    });
    const rows = await supabaseRead<ValidationReport[]>('validation_reports', query.toString());
    const report = rows?.[0];
    if (!report) return notValidated(['APPROVED_VALIDATION_REPORT_NOT_FOUND']);

    const blockers: string[] = [];
    const evidence = report.evidence ?? {};
    const metrics = report.metrics ?? {};
    if (report.reviewer_note !== 'APPROVED_FOR_LIVE_USE') blockers.push('OWNER_REVIEW_APPROVAL_MISSING');
    if (!report.reviewed_at || !Number.isFinite(Date.parse(report.reviewed_at)) || Date.parse(report.reviewed_at) > Date.now()) blockers.push('REVIEW_TIMESTAMP_INVALID');
    const runRows = await supabaseRead<ResearchRun[]>('research_runs', new URLSearchParams({
      select: 'id,status,code_fingerprint,dataset_fingerprint,validation_start,validation_end,out_of_sample_start,out_of_sample_end,completed_at',
      id: `eq.${report.research_run_id}`,
      limit: '1',
    }).toString());
    const run = runRows?.[0];
    const configuredCodeFingerprint = process.env.STRATEGY_VALIDATION_CODE_FINGERPRINT?.trim() ?? '';
    if (!run || run.status !== 'COMPLETED' || !run.completed_at
      || !run.validation_start || !run.validation_end
      || !run.out_of_sample_start || !run.out_of_sample_end) {
      blockers.push('RESEARCH_RUN_OR_UNTOUCHED_OOS_WINDOW_INCOMPLETE');
    }
    if (!configuredCodeFingerprint || !run || run.code_fingerprint !== configuredCodeFingerprint
      || evidence.strategyCodeFingerprint !== run?.code_fingerprint
      || evidence.datasetFingerprint !== run?.dataset_fingerprint) {
      blockers.push('VALIDATED_STRATEGY_OR_DATASET_FINGERPRINT_MISMATCH');
    }
    if (!Array.isArray(report.blockers) || report.blockers.length > 0) blockers.push('VALIDATION_REPORT_HAS_BLOCKERS');

    const requiredEvidence: Array<[string, unknown]> = [
      ['POINT_IN_TIME_VINTAGES_NOT_VERIFIED', evidence.pointInTimeVintagesVerified],
      ['SOURCE_MANIFEST_NOT_VERIFIED', evidence.sourceManifestVerified],
      ['STRATEGY_PARAMETERS_NOT_FROZEN', evidence.strategyParametersFrozen],
      ['INDEPENDENT_REVIEW_NOT_COMPLETED', evidence.independentReviewCompleted],
      ['UNTOUCHED_OUT_OF_SAMPLE_NOT_VERIFIED', evidence.untouchedOutOfSample],
      ['WALK_FORWARD_NOT_COMPLETED', Number(evidence.walkForwardFolds) >= RESEARCH_OBJECTIVES.minimumWalkForwardFolds],
      ['QUALITY_FILTER_NOT_ENFORCED', evidence.allTradesPassedQualityFilter],
      ['SPREAD_STRESS_NOT_APPLIED', evidence.spreadStressApplied],
      ['SLIPPAGE_STRESS_NOT_APPLIED', evidence.slippageStressApplied],
      ['COMMISSION_STRESS_NOT_APPLIED', evidence.commissionStressApplied],
      ['SWAP_STRESS_NOT_APPLIED', evidence.swapStressApplied],
      ['PARAMETER_SENSITIVITY_NOT_COMPLETED', evidence.parameterSensitivityCompleted],
      ['MULTI_REGIME_COVERAGE_NOT_VERIFIED', evidence.multiRegimeCoverageVerified],
      ['LOOKAHEAD_BIAS_NOT_EXCLUDED', evidence.noLookaheadBias],
      ['SURVIVORSHIP_BIAS_NOT_CHECKED', evidence.survivorshipBiasChecked],
      ['BROKER_EXECUTION_NOT_VERIFIED', evidence.brokerExecutionVerified],
      ['DRAWDOWN_LIMIT_NOT_OWNER_APPROVED', evidence.drawdownLimitOwnerApproved],
    ];
    for (const [code, value] of requiredEvidence) if (value !== true) blockers.push(code);

    const oosTrades = finiteNumber(metrics.outOfSampleTradeCount);
    const winRate = finiteNumber(metrics.winRate);
    const winRateLower = finiteNumber(metrics.winRateWilson95Lower);
    const realisedRewardRisk = finiteNumber(metrics.realizedRewardRisk);
    const stressedExpectancy = finiteNumber(metrics.stressedNetExpectancyR);
    const maxDrawdown = finiteNumber(metrics.maxDrawdownPct);
    const approvedDrawdown = finiteNumber(evidence.approvedMaxDrawdownPct);

    if (oosTrades === null || oosTrades < RESEARCH_OBJECTIVES.minimumOutOfSampleTrades) blockers.push('INSUFFICIENT_OUT_OF_SAMPLE_TRADES');
    if (winRate === null || winRate < RESEARCH_OBJECTIVES.targetWinRateMin || winRate > 1) blockers.push('OBSERVED_WIN_RATE_BELOW_60_PERCENT_OR_INVALID');
    if (winRateLower === null || winRateLower < RESEARCH_OBJECTIVES.targetWinRateMin || winRateLower > 1) blockers.push('WIN_RATE_95_PERCENT_LOWER_BOUND_BELOW_60_PERCENT_OR_INVALID');
    if (realisedRewardRisk === null || realisedRewardRisk < RESEARCH_OBJECTIVES.plannedRewardRisk) blockers.push('NET_REALISED_REWARD_RISK_BELOW_1_TO_2');
    if (stressedExpectancy === null || stressedExpectancy <= 0) blockers.push('STRESSED_NET_EXPECTANCY_NOT_POSITIVE');
    if (approvedDrawdown === null || approvedDrawdown <= 0) blockers.push('APPROVED_DRAWDOWN_LIMIT_MISSING');
    if (maxDrawdown === null || approvedDrawdown === null || maxDrawdown > approvedDrawdown) blockers.push('MAX_DRAWDOWN_EXCEEDS_APPROVED_LIMIT');

    const uniqueBlockers = [...new Set(blockers)];
    if (uniqueBlockers.length) return notValidated(uniqueBlockers, report.id);

    return {
      status: 'VALIDATED',
      verified: true,
      approvedReportId: report.id,
      blockers: [],
      objectives: RESEARCH_OBJECTIVES,
    };
  } catch (error) {
    console.error('Strategy validation report could not be verified:', error);
    return notValidated(['VALIDATION_REPORT_STORE_UNAVAILABLE'], reportId);
  }
}
