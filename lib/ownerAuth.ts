import 'server-only';

// Privileged access belongs to one explicitly configured administrator.
// Support and customer mailboxes are never implicitly trusted.
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'ricorapier1@gmail.com').trim().toLowerCase();

export function isAuthorizedOwnerEmail(email?: string | null): boolean {
  return Boolean(email && OWNER_EMAIL && email.trim().toLowerCase() === OWNER_EMAIL);
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
  if (!accessToken || accessToken.length > 8192 || !supabaseUrl || !publishableKey || !OWNER_EMAIL) return null;

  try {
    const response = await fetch(\${supabaseUrl.replace(/\/$/, '')}/auth/v1/user, {
      headers: { apikey: publishableKey, Authorization: \`Bearer \${accessToken}\` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const user: unknown = await response.json();
    if (typeof user !== 'object' || user === null || Array.isArray(user)) return null;
    const record = user as Record<string, unknown>;
    const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
    const id = typeof record.id === 'string' ? record.id : '';
    const confirmed = typeof record.email_confirmed_at === 'string' || typeof record.confirmed_at === 'string';
    if (!isAuthorizedOwnerEmail(email) || !id || !confirmed) return null;
    return { id, email };
  } catch {
    // Auth provider errors are always deny, never fail open.
    return null;
  }
}
