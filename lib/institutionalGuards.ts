
export function isRolloverActive(): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMins = now.getUTCMinutes();
  const totalMins = utcHours * 60 + utcMins;
  // 20:45 UTC (1245 mins) to 22:15 UTC (1335 mins)
  return totalMins >= 1245 && totalMins <= 1335;
}

export function getTopExecutablePair(csiRankings: { currency: string; score: number }[]): { pair: string; direction: 'LONG' } | null {
  // Filter out illiquid Scandi/thin pairs for execution
  const liquidG8 = csiRankings.filter(item =>
    !['NOK', 'SEK'].includes(item.currency) && Number.isFinite(item.score));
  if (liquidG8.length < 2) return null;

  // Sort descending by score
  const sorted = [...liquidG8].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return {
    pair: `${strongest.currency}${weakest.currency}`,
    direction: 'LONG',
  };
}
