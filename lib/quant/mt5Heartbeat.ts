import 'server-only';

import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const HEARTBEAT_FRESH_MS = 120_000;
const MAX_FUTURE_SKEW_MS = 30_000;
const MIN_HISTORY_SAMPLES = 1_000;

export type MT5HeartbeatPayload = {
  accountKey?: string;
  login: string;
  server: string;
  broker?: string | null;
  accountEquity: number;
  accountBalance: number;
  dailyClosedTrades: number;
  dailyLosses: number;
  dailyStatsTimeBasis: 'BROKER_SERVER_DAY';
  openCurrencyLegs?: string[] | null;
  liveBrokerSpread?: number | null;
  spreadSymbol?: string | null;
  timestampUtc: string;
};

export type StoredHeartbeat = {
  accountKey: string;
  login: string;
  server: string;
  broker: string | null;
  accountEquity: number;
  accountBalance: number;
  dailyClosedTrades: number;
  dailyLosses: number;
  dailyStatsTimeBasis: 'BROKER_SERVER_DAY';
  openCurrencyLegs: string[] | null;
  liveBrokerSpread: number | null;
  spreadSymbol: string | null;
  timestampUtc: string;
  receivedAtUtc: string;
  ageMs: number;
  fresh: boolean;
  rollingSevenDayDrawdownPct: number | null;
  drawdownSampleCount: number;
  drawdownCoverageComplete: boolean;
  governanceVerified: boolean;
};

type HeartbeatRow = {
  account_key: string;
  login: string;
  server: string;
  broker: string | null;
  account_equity: number | string;
  account_balance: number | string;
  daily_closed_trades: number;
  daily_losses: number;
  daily_stats_time_basis: 'BROKER_SERVER_DAY';
  open_currency_legs: unknown;
  live_broker_spread: number | string | null;
  spread_symbol: string | null;
  timestamp_utc: string;
  received_at: string;
};

function hasTimezone(value: string): boolean {
  return /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(value);
}

export function deriveMT5AccountKey(login: string, server: string): string {
  return createHash('sha256')
    .update(`${server.trim().toLowerCase()}:${login.trim()}`)
    .digest('hex');
}

export function isFreshMT5Timestamp(value: string, nowMs = Date.now()): boolean {
  if (!hasTimezone(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = nowMs - timestamp;
  return ageMs <= HEARTBEAT_FRESH_MS && ageMs >= -MAX_FUTURE_SKEW_MS;
}

function numeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function normalizeLegs(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const legs = value.filter((item): item is string =>
    typeof item === 'string' && /^[A-Z0-9._-]{3,16}$/.test(item));
  return legs.length === value.length ? legs : null;
}

export async function recordMT5Heartbeat(payload: MT5HeartbeatPayload): Promise<StoredHeartbeat> {
  const login = payload.login.trim();
  const server = payload.server.trim();
  const timestampUtc = payload.timestampUtc.trim();
  if (!login || login.length > 32 || !server || server.length > 128
    || !hasTimezone(timestampUtc) || !isFreshMT5Timestamp(timestampUtc)) {
    throw new Error('MT5 heartbeat identity or UTC timestamp is invalid or stale.');
  }
  if (!Number.isFinite(payload.accountEquity) || payload.accountEquity <= 0
    || !Number.isFinite(payload.accountBalance) || payload.accountBalance <= 0
    || !Number.isSafeInteger(payload.dailyClosedTrades) || payload.dailyClosedTrades < 0
    || !Number.isSafeInteger(payload.dailyLosses) || payload.dailyLosses < 0
    || payload.dailyLosses > payload.dailyClosedTrades
    || payload.dailyStatsTimeBasis !== 'BROKER_SERVER_DAY') {
    throw new Error('MT5 heartbeat account and daily ledger fields are invalid.');
  }
  if (payload.liveBrokerSpread !== null && payload.liveBrokerSpread !== undefined
    && (!Number.isFinite(payload.liveBrokerSpread) || payload.liveBrokerSpread < 0)) {
    throw new Error('MT5 heartbeat broker spread is invalid.');
  }
  const accountKey = deriveMT5AccountKey(login, server);
  if (payload.accountKey && payload.accountKey !== accountKey) {
    throw new Error('MT5 account key does not match the supplied broker login and server.');
  }

  const supabase = getSupabaseAdmin();
  const { data: previous, error: previousError } = await supabase
    .from('macrolinc_mt5_heartbeat_history')
    .select('timestamp_utc')
    .eq('account_key', accountKey)
    .order('timestamp_utc', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) throw new Error(`Could not verify previous MT5 heartbeat: ${previousError.message}`);
  if (previous?.timestamp_utc && Date.parse(previous.timestamp_utc) >= Date.parse(timestampUtc)) {
    throw new Error('Out-of-order or duplicate MT5 heartbeat rejected.');
  }

  const { error: insertError } = await supabase
    .from('macrolinc_mt5_heartbeat_history')
    .insert({
      account_key: accountKey,
      login,
      server,
      broker: payload.broker?.trim() || null,
      account_equity: payload.accountEquity,
      account_balance: payload.accountBalance,
      daily_closed_trades: payload.dailyClosedTrades,
      daily_losses: payload.dailyLosses,
      daily_stats_time_basis: payload.dailyStatsTimeBasis,
      live_broker_spread: payload.liveBrokerSpread ?? null,
      spread_symbol: payload.spreadSymbol?.trim() || null,
      open_currency_legs: payload.openCurrencyLegs ?? null,
      timestamp_utc: new Date(Date.parse(timestampUtc)).toISOString(),
    });
  if (insertError) throw new Error(`Could not persist MT5 heartbeat: ${insertError.message}`);

  const stored = await getLatestMT5Heartbeat(accountKey);
  if (!stored) throw new Error('Persisted MT5 heartbeat could not be read back.');
  return stored;
}

export async function getLatestMT5Heartbeat(accountKey?: string): Promise<StoredHeartbeat | null> {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('macrolinc_mt5_heartbeat_history')
      .select('account_key,login,server,broker,account_equity,account_balance,daily_closed_trades,daily_losses,daily_stats_time_basis,open_currency_legs,live_broker_spread,spread_symbol,timestamp_utc,received_at')
      .order('timestamp_utc', { ascending: false })
      .limit(accountKey ? 1 : 10);
    if (accountKey) query = query.eq('account_key', accountKey);
    const { data, error } = await query;
    if (error) throw new Error(`Could not read persisted MT5 heartbeat: ${error.message}`);
    const rows = (data ?? []) as HeartbeatRow[];
    if (!rows.length) return null;

    const now = Date.now();
    const freshRows = rows.filter((row) => {
      const receivedAt = Date.parse(row.received_at);
      const sourceAt = Date.parse(row.timestamp_utc);
      return Number.isFinite(receivedAt) && Number.isFinite(sourceAt)
        && now - receivedAt <= HEARTBEAT_FRESH_MS && now - receivedAt >= -MAX_FUTURE_SKEW_MS
        && now - sourceAt <= HEARTBEAT_FRESH_MS && now - sourceAt >= -MAX_FUTURE_SKEW_MS;
    });
    if (!accountKey && new Set(freshRows.map((row) => row.account_key)).size > 1) {
      // Never combine or arbitrarily choose between simultaneously active broker accounts.
      return null;
    }
    const row = freshRows[0];
    if (!row) return null;

    const { data: drawdownRows, error: drawdownError } = await supabase.rpc(
      'get_macrolinc_rolling_7d_drawdown',
      { p_account_key: row.account_key },
    );
    if (drawdownError) {
      console.error('MT5 rolling drawdown history is unavailable:', drawdownError.message);
    }
    const drawdownRow = Array.isArray(drawdownRows) ? drawdownRows[0] : drawdownRows;
    const coverageComplete = drawdownRow?.coverage_complete === true;
    const drawdownValue = numeric(drawdownRow?.drawdown_pct);
    const sampleCount = numeric(drawdownRow?.sample_count) ?? 0;
    const receivedAtMs = Date.parse(row.received_at);
    const sourceAtMs = Date.parse(row.timestamp_utc);
    const ageMs = Math.max(0, now - Math.min(receivedAtMs, sourceAtMs));
    const fresh = ageMs <= HEARTBEAT_FRESH_MS
      && now - sourceAtMs >= -MAX_FUTURE_SKEW_MS;
    const accountEquity = numeric(row.account_equity);
    const accountBalance = numeric(row.account_balance);
    const dailyClosedTrades = Number(row.daily_closed_trades);
    const dailyLosses = Number(row.daily_losses);
    const governanceVerified = fresh && coverageComplete
      && drawdownValue !== null && sampleCount >= MIN_HISTORY_SAMPLES
      && accountEquity !== null && accountEquity > 0
      && accountBalance !== null && accountBalance > 0
      && Number.isSafeInteger(dailyClosedTrades) && dailyClosedTrades >= 0
      && Number.isSafeInteger(dailyLosses) && dailyLosses >= 0
      && dailyLosses <= dailyClosedTrades;

    if (accountEquity === null || accountBalance === null) return null;
    return {
      accountKey: row.account_key,
      login: row.login,
      server: row.server,
      broker: row.broker,
      accountEquity,
      accountBalance,
      dailyClosedTrades,
      dailyLosses,
      dailyStatsTimeBasis: row.daily_stats_time_basis,
      openCurrencyLegs: normalizeLegs(row.open_currency_legs),
      liveBrokerSpread: numeric(row.live_broker_spread),
      spreadSymbol: row.spread_symbol,
      timestampUtc: row.timestamp_utc,
      receivedAtUtc: row.received_at,
      ageMs,
      fresh,
      rollingSevenDayDrawdownPct: coverageComplete && drawdownValue !== null ? drawdownValue : null,
      drawdownSampleCount: sampleCount,
      drawdownCoverageComplete: coverageComplete,
      governanceVerified,
    };
  } catch (error) {
    console.error('MT5 heartbeat persistence/read failed:', error);
    return null;
  }
}
