import { NextRequest, NextResponse } from 'next/server';

const OWNER_COOKIE = 'fidulync_owner_session';
const OWNER_COOKIE_MAX_AGE = 55 * 60;

function isPublicAsset(pathname: string): boolean {
  return pathname.startsWith('/_next/static/')
    || pathname.startsWith('/_next/image')
    || pathname === '/favicon.ico'
    || pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || /\.[a-zA-Z0-9]{2,8}$/.test(pathname);
}

function ownerLoginRedirect(request: NextRequest, clearCookie: boolean): NextResponse {
  const url = new URL('/owner', request.url);
  const requestedPath = request.nextUrl.pathname + request.nextUrl.search;
  if (requestedPath !== '/owner' && requestedPath.startsWith('/') && !requestedPath.startsWith('//')) {
    url.searchParams.set('next', requestedPath);
  }
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  if (clearCookie) {
    response.cookies.set(OWNER_COOKIE, '', {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // The owner sign-in and recovery page must remain reachable without a session.
  if (pathname === '/owner' || pathname.startsWith('/owner/')) return NextResponse.next();

  // API routes enforce their own authorization; static assets are not application pages.
  if (pathname === '/api' || pathname.startsWith('/api/') || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(OWNER_COOKIE)?.value;
  if (!token || token.length > 8192) return ownerLoginRedirect(request, Boolean(token));

  const supabaseUrl = (
    process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || ''
  ).trim().replace(/\/$/, '');
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || ''
  ).trim();
  const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();

  // Missing identity configuration must never grant access.
  if (!supabaseUrl || !publishableKey || !ownerEmail) {
    return ownerLoginRedirect(request, true);
  }

  try {
    const authResponse = await fetch(supabaseUrl + '/auth/v1/user', {
      method: 'GET',
      headers: {
        apikey: publishableKey,
        Authorization: 'Bearer ' + token,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (!authResponse.ok) return ownerLoginRedirect(request, true);

    const user: unknown = await authResponse.json();
    if (typeof user !== 'object' || user === null || Array.isArray(user)) {
      return ownerLoginRedirect(request, true);
    }

    const record = user as Record<string, unknown>;
    const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
    const confirmed = typeof record.email_confirmed_at === 'string'
      || typeof record.confirmed_at === 'string';

    if (email !== ownerEmail || !confirmed) return ownerLoginRedirect(request, true);

    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  } catch {
    // Fail closed when Supabase cannot verify the owner session.
    return ownerLoginRedirect(request, true);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
