import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized } from '@/lib/algoAuth';
import { parseHeartbeatInput, saveHeartbeat } from '@/lib/eaHeartbeat';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 60, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded.' }, { status: 429 });
  }

  if (!isAlgoApiConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'EA telemetry authentication is not configured.' },
      { status: 503 }
    );
  }

  if (!isAlgoAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized EA telemetry.' }, { status: 401 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_384) {
    return NextResponse.json({ ok: false, error: 'Telemetry payload is too large.' }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'A valid JSON heartbeat is required.' }, { status: 400 });
  }

  const heartbeat = parseHeartbeatInput(payload);
  if (!heartbeat) {
    return NextResponse.json({ ok: false, error: 'Heartbeat payload fields are invalid.' }, { status: 400 });
  }

  try {
    await saveHeartbeat(heartbeat);
    // The shipped MQL5 bridge treats HTTP 202 as an accepted heartbeat.
    return NextResponse.json(
      { ok: true, server_utc: new Date().toISOString(), ttl_seconds: 900 },
      { status: 202, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('EA heartbeat could not be stored:', error);
    return NextResponse.json(
      { ok: false, error: 'Heartbeat storage is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
