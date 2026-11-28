/** Canonical research mandate shared by MacroLync and Integrated Quant_Core. */
export const RESEARCH_OBJECTIVES = Object.freeze({
  winRateTargetMin: 0.60,
  winRateTargetMax: 0.65,
  plannedRewardRisk: 2,
  growthPriority: 'BALANCED_GROWTH' as const,
  drawdownPriority: 'CONTROLLED_DRAWDOWN' as const,
  setupPolicy: 'HIGH_QUALITY_ONLY' as const,
  dailyTradeQuota: null,
  minimumOutOfSampleTrades: 300,
  minimumWalkForwardFolds: 3,
  minimumOutOfSampleTradesPerFold: 30,
});
