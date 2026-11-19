import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export type LicenseLeaseClaims = {
  iss: 'fidulync-algolync'; aud: 'mt5-license-heartbeat'; sub: string;
  license_hash: string; mt5_login: string; account_mode: 'LIVE' | 'DEMO';
  ea_slug: string; iat: number; exp: number; jti: string;
};
function base64url(value: string | Buffer): string { return Buffer.from(value).toString('base64url'); }
export function createLicenseLease(input: Omit<LicenseLeaseClaims, 'iss' | 'aud' | 'iat' | 'exp' | 'jti'>): { token: string; expiresAt: string } {
  const secret = process.env.ALGOLYNC_LEASE_SIGNING_SECRET?.trim() ?? '';
  if (secret.length < 48) throw new Error('ALGOLYNC_LEASE_SIGNING_SECRET is missing or too short.');
  const now = Math.floor(Date.now() / 1000);
  const claims: LicenseLeaseClaims = { ...input, iss: 'fidulync-algolync', aud: 'mt5-license-heartbeat', iat: now, exp: now + 86400, jti: randomBytes(16).toString('hex') };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const signingInput = header + '.' + payload;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return { token: signingInput + '.' + signature, expiresAt: new Date(claims.exp * 1000).toISOString() };
}

export function verifyLicenseLease(token: string): LicenseLeaseClaims | null {
  const secret = process.env.ALGOLYNC_LEASE_SIGNING_SECRET?.trim() ?? '';
  if (secret.length < 48 || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !/^[A-Za-z0-9_-]+$/.test(signaturePart)) return null;
  const expected = createHmac('sha256', secret).update(headerPart + '.' + payloadPart).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signaturePart, 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as Record<string, unknown>;
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as LicenseLeaseClaims;
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'HS256' || header.typ !== 'JWT'
      || claims.iss !== 'fidulync-algolync' || claims.aud !== 'mt5-license-heartbeat'
      || typeof claims.sub !== 'string' || typeof claims.license_hash !== 'string'
      || !/^\\d{1,19}$/.test(claims.mt5_login) || !['LIVE', 'DEMO'].includes(claims.account_mode)
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claims.ea_slug)
      || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
      || claims.iat > now + 60 || claims.exp <= now || claims.exp - claims.iat !== 86400
      || typeof claims.jti !== 'string' || claims.jti.length < 16) return null;
    return claims;
  } catch { return null; }
}
