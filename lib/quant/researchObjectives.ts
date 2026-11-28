/** User-defined research targets. These are objectives, not achieved performance claims. */
export const RESEARCH_OBJECTIVES = Object.freeze({
  targetWinRateMin: 0.60,
  targetWinRateMax: 0.65,
  plannedRewardRisk: 2,
  priority: 'BALANCED_GROWTH' as const,
  drawdownPriority: 'CONTROLLED_DRAWDOWN' as const,
  setupPolicy: 'HIGH_QUALITY_ONLY' as const,
  dailyTradeQuota: null,
  minimumOutOfSampleTrades: 300,
  minimumWalkForwardFolds: 3,
  minimumCotObservations: 52,
});
