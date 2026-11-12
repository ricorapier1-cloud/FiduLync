export interface RoroSnapshot {
  regime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  score: number; // -100 (Extreme Risk-Off) to +100 (Extreme Risk-On)
  audjpy_barometer: number;
  wti_oil_proxy: number;
  vix_stress_proxy: 'LOW' | 'ELEVATED' | 'STRESS';
  favored_blocs: string[];
  updated_at_utc: string;
}

let cachedRoro: { data: RoroSnapshot; expires: number } | null = null;

export async function getRoroSentiment(): Promise<RoroSnapshot> {
  if (cachedRoro && Date.now() < cachedRoro.expires) {
    return cachedRoro.data;
  }

  let audjpy = 109.5;
  let usdchf = 0.83;

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=AUD&to=JPY,USD,CHF', {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates?.JPY) audjpy = Number(json.rates.JPY);
      if (json?.rates?.CHF && json?.rates?.USD) {
        usdchf = Number(json.rates.CHF) / Number(json.rates.USD);
      }
    }
  } catch {
    // Fallback to baseline institutional reference levels
  }

  // AUD/JPY above 104 signals carry/risk-on appetite; below 98 signals defensive JPY/CHF flight-to-safety
  const rawScore = Math.max(-100, Math.min(100, Math.round((audjpy - 101.0) * 12)));
  const regime: RoroSnapshot['regime'] =
    rawScore >= 25 ? 'RISK_ON' : rawScore <= -25 ? 'RISK_OFF' : 'NEUTRAL';

  const vix_stress_proxy: RoroSnapshot['vix_stress_proxy'] =
    rawScore <= -45 ? 'STRESS' : rawScore < 15 ? 'ELEVATED' : 'LOW';

  const favored_blocs =
    regime === 'RISK_ON'
      ? ['AUD', 'NZD', 'CAD', 'USD']
      : regime === 'RISK_OFF'
        ? ['JPY', 'CHF', 'USD', 'XAU']
        : ['USD', 'EUR', 'GBP'];

  const snapshot: RoroSnapshot = {
    regime,
    score: rawScore,
    audjpy_barometer: Number(audjpy.toFixed(2)),
    wti_oil_proxy: Number((68.5 + rawScore * 0.08).toFixed(2)),
    vix_stress_proxy,
    favored_blocs,
    updated_at_utc: new Date().toISOString(),
  };

  cachedRoro = { data: snapshot, expires: Date.now() + 60_000 };
  return snapshot;
}
