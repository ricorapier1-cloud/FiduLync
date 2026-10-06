import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session }, error } = await supabase.auth.getSession();

  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session || error) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const isSystemAdmin = session.user?.app_metadata?.is_admin === true;

    if (!isSystemAdmin) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login?error=insufficient_privileges', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
