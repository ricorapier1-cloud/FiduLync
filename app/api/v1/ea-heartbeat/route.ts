import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized } from '@/lib/algoAuth';
import { getHeartbeatFleet, parseHeartbeatInput, saveHeartbeat } from '@/lib/eaHeartbeat';

export const dynamic = 'force-dynamic';

function authorize(request: Request) {
  if (!isAlgoApiConfigured()) {
    return NextResponse.json({ error: 'The private algorithm API is not configured.' }, { status: 503 });
  }
  if (!isAlgoAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_384) return NextResponse.json({ error: 'Heartbeat payload is too large.' }, { status: 413 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'A valid JSON heartbeat payload is required.' }, { status: 400 });
  }
  const heartbeat = parseHeartbeatInput(payload);
  if (!heartbeat) return NextResponse.json({ error: 'Heartbeat payload fields are invalid.' }, { status: 400 });

  try {
    await saveHeartbeat(heartbeat);
    return NextResponse.json({ status: 'accepted', expires_in_seconds: 900 }, { status: 202 });
  } catch (error) {
    console.error('EA heartbeat could not be stored:', error);
    return NextResponse.json({ error: 'EA heartbeat storage is temporarily unavailable.' }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;
  try {
    const fleet = await getHeartbeatFleet();
    return NextResponse.json(fleet, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('EA heartbeat fleet could not be loaded:', error);
    return NextResponse.json({ error: 'EA heartbeat telemetry is temporarily unavailable.' }, { status: 503 });
  }
}
