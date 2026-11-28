export type MT5HeartbeatPayload = {
  accountKey?: string;
  login?: string;
  server?: string;
  broker?: string;
  accountEquity: number;
  accountBalance: number;
  dailyClosedTrades: number;
  dailyLosses: number;
  openCurrencyLegs: string[];
  liveBrokerSpread: number;
  timestampUtc: string;
};

export type StoredHeartbeat = MT5HeartbeatPayload & {
  receivedAtUtc: string;
  ageMs: number;
  fresh: boolean;
};

// In-memory fallback cache for heartbeat state
let latestHeartbeat: StoredHeartbeat | null = null;

export function recordMT5Heartbeat(payload: MT5HeartbeatPayload): StoredHeartbeat {
  const now = Date.now();
  const stored: StoredHeartbeat = {
    ...payload,
    receivedAtUtc: new Date(now).toISOString(),
    ageMs: 0,
    fresh: true,
  };
  latestHeartbeat = stored;
  return stored;
}

export function getLatestMT5Heartbeat(): StoredHeartbeat | null {
  if (!latestHeartbeat) return null;
  const now = Date.now();
  const receivedMs = Date.parse(latestHeartbeat.receivedAtUtc);
  const ageMs = Number.isFinite(receivedMs) ? Math.max(0, now - receivedMs) : 999_999;
  const fresh = ageMs <= 120_000; // Fresh within 2 minutes (heartbeat posts every 60s)
  return {
    ...latestHeartbeat,
    ageMs,
    fresh,
  };
}

export function clearMT5Heartbeat(): void {
  latestHeartbeat = null;
}
