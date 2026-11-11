import 'server-only';

import { Redis } from '@upstash/redis';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const staleMemoryCache = new Map<string, unknown>();
const warned = new Set<string>();
let redisClient: Redis | null | undefined;

function warnOnce(key: string, message: string, error?: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message, error);
}

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    warnOnce('missing-credentials', 'Upstash cache is not configured; using in-process caching.');
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = Redis.fromEnv();
  } catch (error) {
    warnOnce('client-init', 'Upstash client could not be initialized; using in-process caching.', error);
    redisClient = null;
  }
  return redisClient;
}

export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  forceRefresh = false,
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  const redis = getRedisClient();

  if (!forceRefresh && cached?.expiresAt && cached.expiresAt > now) return cached.value;

  if (!forceRefresh && redis) {
    try {
      const value = await redis.get<T>(key);
      if (value !== null) {
        memoryCache.set(key, { value, expiresAt: now + ttl * 1000 });
        staleMemoryCache.set(key, value);
        return value;
      }
    } catch (error) {
      warnOnce('read-failure', 'Upstash cache read failed; fetching the upstream value.', error);
    }
  }

  try {
    const value = await fetchFn();
    memoryCache.set(key, { value, expiresAt: now + ttl * 1000 });
    staleMemoryCache.set(key, value);

    if (redis) {
      try {
        await redis.set(key, value, { ex: ttl });
        await redis.set(`${key}:stale`, value, { ex: Math.max(ttl * 24, 86_400) });
      } catch (error) {
        warnOnce('write-failure', 'Upstash cache write failed; retaining the in-process value.', error);
      }
    }
    return value;
  } catch (error) {
    const staleMemoryValue = staleMemoryCache.get(key) as T | undefined;
    if (staleMemoryValue !== undefined) {
      warnOnce(`fetch-failure:${key}`, `Upstream request failed for ${key}; serving the in-process snapshot.`, error);
      return staleMemoryValue;
    }

    if (redis) {
      try {
        const staleRedisValue = await redis.get<T>(`${key}:stale`);
        if (staleRedisValue !== null) {
          staleMemoryCache.set(key, staleRedisValue);
          warnOnce(`fetch-failure:${key}`, `Upstream request failed for ${key}; serving the Redis snapshot.`, error);
          return staleRedisValue;
        }
      } catch (cacheError) {
        warnOnce('stale-read-failure', 'Upstash stale snapshot read failed.', cacheError);
      }
    }
    throw error;
  }
}
