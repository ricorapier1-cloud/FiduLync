import 'server-only';
import { createHmac } from 'node:crypto';

type RateBucket = { timestamps: number[] };
const rateLimitMap = new Map<string, RateBucket>();

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export type DistributedRateLimitResult =
  | { allowed: true; remaining: number; retryAfterSeconds: 0; unavailable: false }
  | { allowed: false; remaining: 0; retryAfterSeconds: number; unavailable: false }
  | { allowed: false; remaining: 0; retryAfterSeconds: 0; unavailable: true };

export function getClientIp(req: Request): string {
  // Vercel terminates the public connection and supplies x-real-ip.
  // Do not trust arbitrary client-provided X-Forwarded-For values.
  const value = req.headers.get('x-real-ip')?.trim();
  if (!value || value.length > 64 || value.includes(',') || !/^[0-9a-fA-F:.]+$/.test(value)) return '';
  return value;
}

export async function enforceDistributedRateLimit(
  req: Request,
  namespace: string,
  limit = 30,
  windowMs = 60_000,
): Promise<DistributedRateLimitResult> {
  const ip = getClientIp(req);
  if (!ip || !SUPABASE_URL || !SUPABASE_KEY || !Number.isSafeInteger(limit) || limit < 1
    || !Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > 86_400_000) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 0, unavailable: true };
  }

  const keyHash = createHmac('sha256', SUPABASE_KEY).update(namespace + ':' + ip).digest('hex');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_api_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1000),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Rate-limit service returned ${response.status}`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('allowed' in result)
      || typeof (result as { allowed: unknown }).allowed !== 'boolean') {
      throw new Error('Rate-limit service returned an invalid response');
    }
    const row = result as { allowed: boolean; remaining?: number; retry_after_seconds?: number };
    if (row.allowed) {
      return { allowed: true, remaining: Number.isSafeInteger(row.remaining) ? Number(row.remaining) : 0, retryAfterSeconds: 0, unavailable: false };
    }
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Number.isSafeInteger(row.retry_after_seconds) ? Math.max(1, Number(row.retry_after_seconds)) : 1,
      unavailable: false,
    };
  } catch (error) {
    console.error('Distributed API rate limiter unavailable:', error instanceof Error ? error.message : String(error));
    return { allowed: false, remaining: 0, retryAfterSeconds: 0, unavailable: true };
  }
}

// Retained for isolated unit tests and non-production local tooling only.
// Public production API routes must use enforceDistributedRateLimit.
export function checkRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(ip);
  const timestamps = current?.timestamps.filter((ts) => now - ts < windowMs) ?? [];
  if (current && timestamps.length === 0) rateLimitMap.delete(ip);
  if (timestamps.length >= limit) return false;
  rateLimitMap.set(ip, { timestamps: [...timestamps, now] });
  return true;
}

export function clearRateLimit(ip?: string): void {
  if (ip) rateLimitMap.delete(ip);
  else rateLimitMap.clear();
}
