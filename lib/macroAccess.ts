import 'server-only';

export const MASTER_OWNER_EMAIL = 'fidulync@gmail.com';

export function isMasterOwner(user: { email?: string | null; email_confirmed_at?: string | null }) {
  return user.email?.trim().toLowerCase() === MASTER_OWNER_EMAIL && Boolean(user.email_confirmed_at);
}
