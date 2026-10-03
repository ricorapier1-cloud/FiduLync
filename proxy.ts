import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="FiduLync Command Center"' }
    })
  }

  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':')
  const user = auth[0]
  const pass = auth[1]

  // Uses environment variables for production security, with a fallback for local testing
  const expectedUser = process.env.ADMIN_USERNAME || 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD || 'fidulync2026'

  if (user === expectedUser && pass === expectedPass) {
    return NextResponse.next()
  }

  return new NextResponse('Invalid credentials', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="FiduLync Command Center"' }
  })
}

// 2. Protect only the admin and admin API routes
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
}
