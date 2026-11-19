import 'server-only';

export const AUTHORIZED_OWNER_EMAILS = new Set([
  'ricorapier1@gmail.com',
  'fidulync@gmail.com',
  (process.env.OWNER_EMAIL || '').trim().toLowerCase(),
  (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
].filter(Boolean));

export function isAuthorizedOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return AUTHORIZED_OWNER_EMAILS.has(email.trim().toLowerCase());
}

export type VerifiedOwner = { id: string; email: string };

export async function requireOwner(request: Request): Promise<VerifiedOwner | null> {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const accessToken = match?.[1]?.trim();
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || ''
  ).trim();
  if (!accessToken || !supabaseUrl || !publishableKey) return null;

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const user: unknown = await response.json();
    if (typeof user !== 'object' || user === null || Array.isArray(user)) return null;
    const record = user as Record<string, unknown>;
    const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
    const id = typeof record.id === 'string' ? record.id : '';
    const verified = typeof record.email_confirmed_at === 'string' || typeof record.confirmed_at === 'string' || record.role === 'authenticated';
    if (!isAuthorizedOwnerEmail(email) || !id || !verified) return null;
    return { id, email };
  } catch {
    return null;
  }
}
