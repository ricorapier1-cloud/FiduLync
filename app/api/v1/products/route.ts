import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type PublicEaProduct = {
  slug: string; name: string; tagline: string; version: string; category: string;
  monthly_price_ngn: number; monthly_price_usd: number;
  annual_price_ngn: number; annual_price_usd: number;
  extra_seat_price_ngn: number; extra_seat_price_usd: number;
  demo_days: number; included_live_seats: number; included_demo_seats: number;
  metrics_json: Record<string, unknown>; ex5_artifact_url: string | null; is_active: boolean;
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'The strategy catalogue is temporarily unavailable.' }, { status: 503 });
  }
  try {
    const products = await supabaseRead<PublicEaProduct[]>(
      'ea_products',
      'is_active=eq.true&select=slug,name,tagline,version,category,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,demo_days,included_live_seats,included_demo_seats,metrics_json,ex5_artifact_url,is_active&order=name.asc'
    );
    return NextResponse.json({ success: true, products: products ?? [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('AlgoLync catalogue read failed:', error);
    return NextResponse.json({ success: false, error: 'The strategy catalogue is temporarily unavailable.' }, { status: 503 });
  }
}
