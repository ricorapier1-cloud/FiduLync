import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Product = {
  slug: string; name: string; version: string; category: string;
  monthly_price_ngn: number; monthly_price_usd: number; annual_price_ngn: number; annual_price_usd: number;
  extra_seat_price_ngn: number; extra_seat_price_usd: number; metrics_json: Record<string, unknown>;
};

export async function GET(request: Request) {
  if (!await requireOwner(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Product database is unavailable.' }, { status: 503 });
  try {
    const products = await supabaseRead<Product[]>(
      'ea_products',
      'select=slug,name,version,category,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,metrics_json&order=name.asc'
    );
    return NextResponse.json({ products: products ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner product pricing read failed:', error);
    return NextResponse.json({ error: 'Unable to load EA pricing.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!await requireOwner(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Product database is unavailable.' }, { status: 503 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const fields = ['monthly_price_ngn','monthly_price_usd','annual_price_ngn','annual_price_usd','extra_seat_price_ngn','extra_seat_price_usd'] as const;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: 'Invalid EA slug.' }, { status: 400 });
    const update: Record<string, number> = {};
    for (const field of fields) {
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value < 0 || value > 100_000_000) {
        return NextResponse.json({ error: `Invalid value for ${field}.` }, { status: 400 });
      }
      if (field.endsWith('_ngn') && !Number.isInteger(value)) {
        return NextResponse.json({ error: `${field} must be a whole NGN amount.` }, { status: 400 });
      }
      update[field] = Math.round(value * 100) / 100;
    }
    if (update.annual_price_ngn !== update.monthly_price_ngn * 10) {
      return NextResponse.json({ error: 'Annual NGN pricing must equal ten monthly payments (two months free).' }, { status: 400 });
    }
    if (Math.abs(update.annual_price_usd - update.monthly_price_usd * 10) > 0.01) {
      return NextResponse.json({ error: 'Annual USD pricing must equal ten monthly payments (two months free).' }, { status: 400 });
    }
    const updated = await supabaseQuery<Product[]>('ea_products', {
      method: 'PATCH', query: `slug=eq.${encodeURIComponent(slug)}&select=slug,name,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd`,
      body: { ...update, updated_at: new Date().toISOString() },
    });
    if (!updated?.length) return NextResponse.json({ error: 'EA product was not found or pricing was not updated.' }, { status: 404 });
    return NextResponse.json({ success: true, product: updated[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner product pricing update failed:', error);
    return NextResponse.json({ error: 'Unable to save EA pricing.' }, { status: 503 });
  }
}
