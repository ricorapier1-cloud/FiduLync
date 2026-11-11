import { NextResponse } from 'next/server';
import { getMarketQuotes } from '@/lib/marketFeeds';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const quotes = await getMarketQuotes();
    const now = Date.now();
    const live = quotes.some((quote) => quote.source === 'finnhub'
      && now - Date.parse(quote.timestamp) <= 120_000);
    return NextResponse.json({ quotes, live }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Market quote feeds and cached fallbacks are unavailable:', error);
    return NextResponse.json({ quotes: [], live: false }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  }
}
