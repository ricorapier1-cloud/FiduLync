import 'server-only';

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

const HEARTBEAT_TTL_SECONDS = 15 * 60;
const METADATA_TTL_SECONDS = 30 * 24 * 60 * 60;
const HEARTBEAT_INDEX_KEY = 'ea:heartbeat:index';
const warned = new Set<string>();

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

type MemoryHeartbeat = {
  record: HeartbeatRecord;
  metadata: HeartbeatMetadata;
  expiresAt: number;
  metadataExpiresAt: number;
};

const memoryHeartbeats = new Map<string, MemoryHeartbeat>();
let redisClient: Redis | null | undefined;

function warnOnce(key: string, message: string, error?: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message, error);
}

function getRedisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    warnOnce('missing-credentials', 'Upstash heartbeat storage is not configured; using in-process TTL storage.');
    redisClient = null;
    return redisClient;
  }
  if (redisClient !== undefined) return redisClient;

  try {
    redisClient = Redis.fromEnv();
  } catch (error) {
    warnOnce('client-init', 'Upstash heartbeat storage could not be initialized; using in-process TTL storage.', error);
    redisClient = null;
  }
  return redisClient;
}

function heartbeatId(input: Pick<HeartbeatInput, 'ea_name' | 'account_number'>) {
  return createHash('sha256').update(`${input.ea_name}\u0000${input.account_number}`).digest('hex');
}

function offlineRecord(metadata: HeartbeatMetadata): HeartbeatRecord {
  return {
    ...metadata,
    balance: null,
    equity: null,
    floating_pnl: null,
    drawdown_pct: null,
    open_positions: null,
    status: 'OFFLINE',
    heartbeat_status: 'OFFLINE',
  };
}

function getMemoryHeartbeats(now = Date.now()) {
  const records: HeartbeatRecord[] = [];
  for (const [id, entry] of memoryHeartbeats) {
    if (entry.metadataExpiresAt <= now) {
      memoryHeartbeats.delete(id);
      continue;
    }
    records.push(entry.expiresAt > now ? entry.record : offlineRecord(entry.metadata));
  }
  return records;
}

function sortHeartbeats(records: HeartbeatRecord[]) {
  return records.sort((left, right) => left.ea_name.localeCompare(right.ea_name)
    || left.account_number.localeCompare(right.account_number));
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
  memoryHeartbeats.set(id, {
    record,
    metadata,
    expiresAt: Date.now() + HEARTBEAT_TTL_SECONDS * 1000,
    metadataExpiresAt: Date.now() + METADATA_TTL_SECONDS * 1000,
  });

  if (!redis) return;
  try {
    await Promise.all([
      redis.set(`ea:heartbeat:state:${id}`, record, { ex: HEARTBEAT_TTL_SECONDS }),
      redis.set(`ea:heartbeat:meta:${id}`, metadata, { ex: METADATA_TTL_SECONDS }),
      redis.sadd(HEARTBEAT_INDEX_KEY, id),
      redis.expire(HEARTBEAT_INDEX_KEY, METADATA_TTL_SECONDS),
    ]);
  } catch (error) {
    warnOnce('write-failure', 'Upstash heartbeat write failed; retaining the in-process snapshot.', error);
  }
}

export async function getHeartbeatFleet(): Promise<{ configured: boolean; heartbeats: HeartbeatRecord[] }> {
  const redis = getRedisClient();
  if (!redis) return { configured: false, heartbeats: sortHeartbeats(getMemoryHeartbeats()) };

  try {
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
      return state ?? offlineRecord(metadata);
    }));

    const merged = new Map<string, HeartbeatRecord>();
    for (const record of [...getMemoryHeartbeats(), ...records.filter((item): item is HeartbeatRecord => item !== null)]) {
      const id = heartbeatId(record);
      const previous = merged.get(id);
      if (!previous || Date.parse(record.last_seen_utc) >= Date.parse(previous.last_seen_utc)) {
        merged.set(id, record);
      }
    }
    return { configured: true, heartbeats: sortHeartbeats([...merged.values()]) };
  } catch (error) {
    warnOnce('read-failure', 'Upstash heartbeat read failed; serving in-process TTL snapshots.', error);
    return { configured: false, heartbeats: sortHeartbeats(getMemoryHeartbeats()) };
  }
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
