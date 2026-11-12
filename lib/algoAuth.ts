import 'server-only';

import { timingSafeEqual } from 'node:crypto';

export function isAlgoAuthorized(request: Request) {
  const expected = process.env.ALGO_PRIVATE_API_KEY?.trim();
  const provided = request.headers.get('x-algo-key')?.trim()
    || new URL(request.url).searchParams.get('key')?.trim();
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isSameOriginBrowserRequest(request: Request) {
  if (request.headers.get('sec-fetch-site') !== 'same-origin') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function isAlgoApiConfigured() {
  return Boolean(process.env.ALGO_PRIVATE_API_KEY?.trim());
}
