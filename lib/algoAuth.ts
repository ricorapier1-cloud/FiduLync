import 'server-only';

import { timingSafeEqual } from 'node:crypto';

export function isAlgoAuthorized(request: Request) {
  const expected = process.env.ALGO_PRIVATE_API_KEY?.trim();
  const provided = request.headers.get('x-algo-key')?.trim();
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isAlgoApiConfigured() {
  return Boolean(process.env.ALGO_PRIVATE_API_KEY?.trim());
}
