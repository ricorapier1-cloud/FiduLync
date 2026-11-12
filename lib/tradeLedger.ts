import 'server-only';

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

const TRADE_INDEX_KEY = 'algo:closed-trades:index';
const MAX_MEMORY_TRADES = 1_000;
const MAX_ANALYTICS_TRADES = 1_000;
const RECENT_TRADES = 10;
const warned = new Set<string>();

export type ClosedTrade = {
  ticket: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  profit_usd: number;
  r_multiple: number;
  confluence_score: number;
  regime: 'TRENDING_EXPANSION' | 'MEAN_REVERTING' | 'HIGH_VOL_CHOP' | 'UNAVAILABLE';
  closed_at_utc: string;
};

export type TradeExpectancy = {
  configured: boolean;
  total_trades: number;
  win_rate_pct: number | null;
  profit_factor: number | null;
  average_r_multiple: number | null;
  max_drawdown_pct: number | null;
  recent_closed_trades: ClosedTrade[];
};

const memoryTrades = new Map<string, ClosedTrade>();
let redisClient: Redis | null | undefined;

function warnOnce(key: string, message: string, error?: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message, error);
}

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    warnOnce('missing-credentials', 'Upstash trade ledger is not configured; using in-process storage.');
    redisClient = null;
    return redisClient;
  }
  try {
    redisClient = Redis.fromEnv();
  } catch (error) {
    warnOnce('client-init', 'Upstash trade ledger could not be initialized; using in-process storage.', error);
    redisClient = null;
  }
  return redisClient;
}

function tradeId(trade: Pick<ClosedTrade, 'ticket' | 'symbol'>) {
  return createHash('sha256').update(`${trade.symbol}\u0000${trade.ticket}`).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseClosedTrade(value: unknown): ClosedTrade | null {
  if (!isRecord(value)) return null;
  const ticket = typeof value.ticket === 'string'
    ? value.ticket.trim()
    : typeof value.ticket === 'number' && Number.isSafeInteger(value.ticket)
      ? String(value.ticket)
      : '';
  const symbol = typeof value.symbol === 'string' ? value.symbol.trim().toUpperCase() : '';
  const direction = typeof value.direction === 'string' ? value.direction.trim().toUpperCase() : '';
  const regime = value.regime;
  const closedAt = value.closed_at_utc;
  if (!/^[0-9]{1,40}$/.test(ticket)
    || !/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(symbol)
    || (direction !== 'LONG' && direction !== 'SHORT')
    || typeof value.entry_price !== 'number' || !Number.isFinite(value.entry_price) || value.entry_price <= 0
    || typeof value.exit_price !== 'number' || !Number.isFinite(value.exit_price) || value.exit_price <= 0
    || typeof value.profit_usd !== 'number' || !Number.isFinite(value.profit_usd)
    || typeof value.r_multiple !== 'number' || !Number.isFinite(value.r_multiple) || Math.abs(value.r_multiple) > 1_000
    || typeof value.confluence_score !== 'number' || !Number.isInteger(value.confluence_score)
    || value.confluence_score < -100 || value.confluence_score > 100
    || (regime !== 'TRENDING_EXPANSION' && regime !== 'MEAN_REVERTING'
      && regime !== 'HIGH_VOL_CHOP' && regime !== 'UNAVAILABLE')
    || typeof closedAt !== 'string' || !closedAt.endsWith('Z') || !Number.isFinite(Date.parse(closedAt))) {
    return null;
  }
  return {
    ticket,
    symbol,
    direction,
    entry_price: value.entry_price,
    exit_price: value.exit_price,
    profit_usd: value.profit_usd,
    r_multiple: value.r_multiple,
    confluence_score: value.confluence_score,
    regime,
    closed_at_utc: new Date(closedAt).toISOString(),
  };
}

export async function saveClosedTrade(trade: ClosedTrade): Promise<boolean> {
  const id = tradeId(trade);
  if (memoryTrades.has(id)) return false;

  const redis = getRedisClient();
  if (redis) {
    try {
      const inserted = await redis.set(`algo:closed-trades:record:${id}`, trade, { nx: true });
      if (inserted !== 'OK') return false;
      await redis.sadd(TRADE_INDEX_KEY, id);
    } catch (error) {
      warnOnce('write-failure', 'Upstash trade ledger write failed; retaining the in-process trade.', error);
    }
  }

  memoryTrades.set(id, trade);
  if (memoryTrades.size > MAX_MEMORY_TRADES) {
    const oldestId = [...memoryTrades.entries()]
      .sort((left, right) => Date.parse(left[1].closed_at_utc) - Date.parse(right[1].closed_at_utc))[0]?.[0];
    if (oldestId) memoryTrades.delete(oldestId);
  }
  return true;
}

function buildExpectancy(trades: ClosedTrade[], configured: boolean): TradeExpectancy {
  const ordered = trades
    .sort((left, right) => Date.parse(left.closed_at_utc) - Date.parse(right.closed_at_utc))
    .slice(-MAX_ANALYTICS_TRADES);
  const wins = ordered.filter((trade) => trade.profit_usd > 0);
  const losses = ordered.filter((trade) => trade.profit_usd < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.profit_usd, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.profit_usd, 0));
  const averageR = ordered.length
    ? ordered.reduce((sum, trade) => sum + trade.r_multiple, 0) / ordered.length
    : null;

  let cumulativeProfit = 0;
  let peakProfit = 0;
  let maxDrawdownPct = 0;
  for (const trade of ordered) {
    cumulativeProfit += trade.profit_usd;
    peakProfit = Math.max(peakProfit, cumulativeProfit);
    if (peakProfit > 0) {
      maxDrawdownPct = Math.max(maxDrawdownPct, ((peakProfit - cumulativeProfit) / peakProfit) * 100);
    }
  }

  return {
    configured,
    total_trades: ordered.length,
    win_rate_pct: ordered.length ? (wins.length / ordered.length) * 100 : null,
    profit_factor: grossLoss > 0 ? grossProfit / grossLoss : null,
    average_r_multiple: averageR,
    max_drawdown_pct: peakProfit > 0 ? maxDrawdownPct : null,
    recent_closed_trades: [...ordered].reverse().slice(0, RECENT_TRADES),
  };
}

export async function getTradeExpectancy(): Promise<TradeExpectancy> {
  const redis = getRedisClient();
  let configured = false;
  const trades = new Map<string, ClosedTrade>(memoryTrades);

  if (redis) {
    try {
      const ids = await redis.smembers<string[]>(TRADE_INDEX_KEY);
      const records = await Promise.all(ids.map((id) =>
        redis.get<ClosedTrade>(`algo:closed-trades:record:${id}`)));
      ids.forEach((id, index) => {
        const trade = records[index];
        if (trade) trades.set(id, trade);
      });
      configured = true;
    } catch (error) {
      warnOnce('read-failure', 'Upstash trade ledger read failed; serving in-process trades.', error);
    }
  }

  return buildExpectancy([...trades.values()], configured);
}
