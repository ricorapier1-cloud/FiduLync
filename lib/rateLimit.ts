type RateBucket = {
  timestamps: number[];
};

const rateLimitMap = new Map<string, RateBucket>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

export function checkRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(ip);

  const timestamps = current?.timestamps.filter((ts) => now - ts < windowMs) ?? [];
  if (current && timestamps.length === 0) {
    rateLimitMap.delete(ip);
  }

  const active = timestamps.length > 0 ? timestamps : [];
  const next = [...active, now];

  if (next.length > limit) {
    return false;
  }

  rateLimitMap.set(ip, { timestamps: next });
  return true;
}

export function clearRateLimit(ip?: string): void {
  if (ip) {
    rateLimitMap.delete(ip);
    return;
  }
  rateLimitMap.clear();
}
