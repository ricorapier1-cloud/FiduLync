import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized, isSameOriginBrowserRequest } from '@/lib/algoAuth';
import { getMacroSignal, isSupportedSignalSymbol } from '@/lib/signalEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const sameOriginPreview = isSameOriginBrowserRequest(request);
  if (!isAlgoApiConfigured() && !sameOriginPreview) {
    return NextResponse.json({ error: 'The private algorithm API is not configured.' }, { status: 503 });
  }
  if (!sameOriginPreview && !isAlgoAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const symbol = new URL(request.url).searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  if (!isSupportedSignalSymbol(symbol)) {
    return NextResponse.json({ error: 'A supported G10 FX pair or XAUUSD symbol is required.' }, { status: 400 });
  }

  try {
    const signal = await getMacroSignal(symbol);
    if (!signal) return NextResponse.json({ error: 'Signal inputs are unavailable.' }, { status: 503 });
    return NextResponse.json(signal, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error(`Macro signal request failed for ${symbol}:`, error);
    return NextResponse.json({ error: 'Macro signal is temporarily unavailable.' }, { status: 503 });
  }
}
