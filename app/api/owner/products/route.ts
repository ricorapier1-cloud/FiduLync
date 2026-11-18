import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Product = {
  slug: string;
  name: string;
  version: string;
  category: string;
  monthly_price_ngn: number;
  monthly_price_usd: number;
  annual_price_ngn: number;
  annual_price_usd: number;
  extra_seat_price_ngn: number;
  extra_seat_price_usd: number;
  metrics_json: Record<string, unknown>;
};

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Product database is unavailable.' }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid EA slug.' }, { status: 400 });
    }

    const fields = [
      'monthly_price_ngn', 'monthly_price_usd', 'annual_price_ngn',
      'annual_price_usd', 'extra_seat_price_ngn', 'extra_seat_price_usd',
    ] as const;
    const update: Record<(typeof fields)[number], number> = {
      monthly_price_ngn: 0, monthly_price_usd: 0, annual_price_ngn: 0,
      annual_price_usd: 0, extra_seat_price_ngn: 0, extra_seat_price_usd: 0,
    };
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

    const rpc = await supabaseQuery<Record<string, unknown>>('rpc/owner_update_ea_product_pricing', {
      method: 'POST',
      body: {
        p_slug: slug,
        p_owner_email: owner.email,
        p_monthly_price_ngn: update.monthly_price_ngn,
        p_monthly_price_usd: update.monthly_price_usd,
        p_annual_price_ngn: update.annual_price_ngn,
        p_annual_price_usd: update.annual_price_usd,
        p_extra_seat_price_ngn: update.extra_seat_price_ngn,
        p_extra_seat_price_usd: update.extra_seat_price_usd,
      },
    });
    const result = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!result || result.success !== true) {
      return NextResponse.json({ error: 'Pricing update was not committed.' }, { status: 409 });
    }
    return NextResponse.json({
      success: true,
      product: { slug, ...update },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner product pricing update failed:', error);
    return NextResponse.json({ error: 'Unable to save EA pricing.' }, { status: 503 });
  }
}
