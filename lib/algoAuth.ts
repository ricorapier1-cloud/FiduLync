import 'server-only';

import { timingSafeEqual } from 'node:crypto';

export function isAlgoAuthorized(request: Request): boolean {
  const expected = process.env.ALGO_PRIVATE_API_KEY?.trim();
  // Credentials in URLs can leak through access logs, browser history and analytics.
  const provided = request.headers.get('x-algo-key')?.trim();
  if (!expected || !provided || expected.length > 512 || provided.length > 512) return false;

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isSameOriginBrowserRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') !== 'same-origin') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function isAlgoApiConfigured(): boolean {
  return Boolean(process.env.ALGO_PRIVATE_API_KEY?.trim());
}
