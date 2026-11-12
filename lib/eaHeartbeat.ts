import 'server-only';

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

const HEARTBEAT_TTL_SECONDS = 15 * 60;
const METADATA_TTL_SECONDS = 30 * 24 * 60 * 60;
const HEARTBEAT_INDEX_KEY = 'ea:heartbeat:index';

export type HeartbeatInput = {
  ea_name: string;
  account_number: string;
  balance: number;
  equity: number;
  floating_pnl: number;
  drawdown_pct: number;
  open_positions: number;
  status: string;
};

export type HeartbeatRecord = Omit<HeartbeatInput, 'balance' | 'equity' | 'floating_pnl' | 'drawdown_pct' | 'open_positions'> & {
  balance: number | null;
  equity: number | null;
  floating_pnl: number | null;
  drawdown_pct: number | null;
  open_positions: number | null;
  heartbeat_status: 'ONLINE' | 'OFFLINE';
  last_seen_utc: string;
};

type HeartbeatMetadata = Pick<HeartbeatInput, 'ea_name' | 'account_number'> & {
  last_seen_utc: string;
};

let redisClient: Redis | null = null;

function getRedisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    throw new Error('Upstash Redis is not configured for EA heartbeat telemetry.');
  }
  redisClient ??= Redis.fromEnv();
  return redisClient;
}

function heartbeatId(input: Pick<HeartbeatInput, 'ea_name' | 'account_number'>) {
  return createHash('sha256').update(`${input.ea_name}\u0000${input.account_number}`).digest('hex');
}

export async function saveHeartbeat(input: HeartbeatInput) {
  const redis = getRedisClient();
  const id = heartbeatId(input);
  const record: HeartbeatRecord = {
    ...input,
    heartbeat_status: 'ONLINE',
    last_seen_utc: new Date().toISOString(),
  };
  const metadata: HeartbeatMetadata = {
    ea_name: input.ea_name,
    account_number: input.account_number,
    last_seen_utc: record.last_seen_utc,
  };
  await Promise.all([
    redis.set(`ea:heartbeat:state:${id}`, record, { ex: HEARTBEAT_TTL_SECONDS }),
    redis.set(`ea:heartbeat:meta:${id}`, metadata, { ex: METADATA_TTL_SECONDS }),
    redis.sadd(HEARTBEAT_INDEX_KEY, id),
    redis.expire(HEARTBEAT_INDEX_KEY, METADATA_TTL_SECONDS),
  ]);
}

export async function getHeartbeatFleet(): Promise<{ configured: boolean; heartbeats: HeartbeatRecord[] }> {
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    return { configured: false, heartbeats: [] };
  }
  const redis = getRedisClient();
  const ids = await redis.smembers(HEARTBEAT_INDEX_KEY);
  const records = await Promise.all(ids.map(async (id) => {
    const [state, metadata] = await Promise.all([
      redis.get<HeartbeatRecord>(`ea:heartbeat:state:${id}`),
      redis.get<HeartbeatMetadata>(`ea:heartbeat:meta:${id}`),
    ]);
    if (!metadata) {
      await redis.srem(HEARTBEAT_INDEX_KEY, id);
      return null;
    }
    if (state) return state;
    return {
      ...metadata,
      balance: null,
      equity: null,
      floating_pnl: null,
      drawdown_pct: null,
      open_positions: null,
      status: 'OFFLINE',
      heartbeat_status: 'OFFLINE' as const,
    };
  }));
  return {
    configured: true,
    heartbeats: records.filter((record): record is HeartbeatRecord => record !== null)
      .sort((left, right) => left.ea_name.localeCompare(right.ea_name)
        || left.account_number.localeCompare(right.account_number)),
  };
}

export function parseHeartbeatInput(value: unknown): HeartbeatInput | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { balance, equity, floating_pnl: floatingPnl, drawdown_pct: drawdownPct, open_positions: openPositions } = record;
  const accountNumber = typeof record.account_number === 'string'
    ? record.account_number.trim()
    : typeof record.account_number === 'number' && Number.isSafeInteger(record.account_number)
      ? String(record.account_number)
      : '';
  if (typeof record.ea_name !== 'string' || record.ea_name.trim().length === 0 || record.ea_name.length > 80
    || accountNumber.length === 0 || accountNumber.length > 80
    || typeof balance !== 'number' || !Number.isFinite(balance)
    || typeof equity !== 'number' || !Number.isFinite(equity)
    || typeof floatingPnl !== 'number' || !Number.isFinite(floatingPnl)
    || typeof drawdownPct !== 'number' || !Number.isFinite(drawdownPct)
    || typeof openPositions !== 'number' || !Number.isFinite(openPositions)) {
    return null;
  }
  if (balance < 0 || equity < 0 || drawdownPct < 0 || drawdownPct > 100
    || !Number.isInteger(openPositions) || openPositions < 0
    || typeof record.status !== 'string' || record.status.trim().length === 0 || record.status.length > 40) {
    return null;
  }
  return {
    ea_name: record.ea_name.trim(),
    account_number: accountNumber,
    balance,
    equity,
    floating_pnl: floatingPnl,
    drawdown_pct: drawdownPct,
    open_positions: openPositions,
    status: record.status.trim().toUpperCase(),
  };
}
