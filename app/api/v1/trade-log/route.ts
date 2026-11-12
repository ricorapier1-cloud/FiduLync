import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized } from '@/lib/algoAuth';
import { parseClosedTrade, saveClosedTrade } from '@/lib/tradeLedger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAlgoApiConfigured()) {
    return NextResponse.json({ error: 'The private algorithm API is not configured.' }, { status: 503 });
  }
  if (!isAlgoAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_384) return NextResponse.json({ error: 'Trade payload is too large.' }, { status: 413 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'A valid JSON closed-trade payload is required.' }, { status: 400 });
  }
  const trade = parseClosedTrade(payload);
  if (!trade) return NextResponse.json({ error: 'Closed-trade payload fields are invalid.' }, { status: 400 });

  try {
    const saved = await saveClosedTrade(trade);
    return NextResponse.json({ status: saved ? 'accepted' : 'duplicate' }, { status: saved ? 202 : 200 });
  } catch (error) {
    console.error('Closed trade could not be stored:', error);
    return NextResponse.json({ error: 'Closed-trade storage is temporarily unavailable.' }, { status: 503 });
  }
}
