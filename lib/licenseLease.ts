import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
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
