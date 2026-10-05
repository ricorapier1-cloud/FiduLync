import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // 1. Admin Protection: Requires an admin cookie or auth token
  if (pathname.startsWith('/admin')) {
    const adminAuth = request.cookies.get('admin_token');
    if (!adminAuth) {
      url.pathname = '/'; // Redirect hackers/users to home
      return NextResponse.redirect(url);
    }
  }

  // 2. Security Headers for Escrow Integrity
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/api/:path*'],
};
