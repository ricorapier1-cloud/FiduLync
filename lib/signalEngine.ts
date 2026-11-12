import 'server-only';

import { getFundamentalSignal, getMacroSnapshot } from '@/lib/macroEngine';
import { getTechnicalSignal, type MarketRegime } from '@/lib/technicalEngine';
import type { MacroSnapshot } from '@/types/macro';

const G10 = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK']);
const TIER_ONE_EVENT = /\b(nfp|non[-\s]?farm|consumer price|cpi|fomc|federal open market|ecb|european central bank|boe|bank of england|rate decision|monetary policy)\b/i;
const NEWS_BLACKOUT_MS = 30 * 60 * 1_000;

export type MacroSignalPayload = {
  symbol: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confluence_score: number;
  regime: MarketRegime;
  atr_sl_pips: number | null;
  atr_tp_pips: number | null;
  news_lockout: boolean;
  safe_to_trade: boolean;
  timestamp_utc: string;
};

export function isSupportedSignalSymbol(symbol: string) {
  if (symbol === 'XAUUSD') return true;
  if (!/^[A-Z]{6}$/.test(symbol)) return false;
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  return base !== quote && G10.has(base) && G10.has(quote);
}

export function isNewsLockout(snapshot: MacroSnapshot, now = Date.now()) {
  return snapshot.catalysts.some((catalyst) => catalyst.impact === 'High'
    && TIER_ONE_EVENT.test(`${catalyst.title} ${catalyst.region}`)
    && Math.abs(Date.parse(catalyst.scheduledAt) - now) <= NEWS_BLACKOUT_MS);
}

export async function getMacroSignal(symbol: string, now = Date.now()): Promise<MacroSignalPayload | null> {
  const normalizedSymbol = symbol.toUpperCase();
  if (!isSupportedSignalSymbol(normalizedSymbol)) return null;

  const [snapshot, technical] = await Promise.all([
    getMacroSnapshot(),
    getTechnicalSignal(normalizedSymbol),
  ]);
  const fundamental = getFundamentalSignal(snapshot, normalizedSymbol);
  const score = fundamental
    ? Math.max(-100, Math.min(100, Math.round(fundamental.score * 0.6 + technical.score * 0.4)))
    : 0;
  const bias = score >= 20 ? 'LONG' : score <= -20 ? 'SHORT' : 'NEUTRAL';
  const newsLockout = isNewsLockout(snapshot, now);

  return {
    symbol: normalizedSymbol,
    bias,
    confluence_score: score,
    regime: technical.regime,
    atr_sl_pips: technical.atr_stop_pips,
    atr_tp_pips: technical.atr_take_profit_pips,
    news_lockout: newsLockout,
    safe_to_trade: Boolean(fundamental)
      && technical.available
      && snapshot.source !== 'fallback'
      && !newsLockout
      && technical.regime !== 'HIGH_VOL_CHOP'
      && bias !== 'NEUTRAL',
    timestamp_utc: new Date(now).toISOString(),
  };
}
