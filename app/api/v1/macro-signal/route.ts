import { NextResponse } from 'next/server';
import { getMacroSignal, isSupportedSignalSymbol } from '@/lib/signalEngine';
import { isSameOriginBrowserRequest } from '@/lib/algoAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 30 requests per minute.' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Research signal preview is same-origin browser-only. EAs use the per-installation supervisor token instead.
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized signal request.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') ?? 'EURUSD').trim().toUpperCase();

  if (!isSupportedSignalSymbol(symbol)) {
    return NextResponse.json(
      { error: 'Unsupported trading symbol.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const signal = await getMacroSignal(symbol);
    if (!signal) {
      return NextResponse.json(
        { error: 'A signal could not be generated for this symbol.' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(signal, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Macro signal generation failed:', error);
    return NextResponse.json(
      { error: 'Macro signal service is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
