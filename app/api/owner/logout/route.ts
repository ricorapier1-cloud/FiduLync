import { NextResponse } from 'next/server';

const OWNER_COOKIE = 'fidulync_owner_session';

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

  response.cookies.set(OWNER_COOKIE, '', {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  return response;
}
