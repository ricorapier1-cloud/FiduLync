import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';
import { hasApprovedProductArtifact } from '@/lib/productRelease';

export const dynamic = 'force-dynamic';

type ProductRecord = { slug: string; category: string; is_active: boolean };

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug')?.trim().toLowerCase() ?? '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ ready: false, error: 'A valid product slug is required.' }, {
      status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ready: false, error: 'Product release registry is unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  try {
    const products = await supabaseRead<ProductRecord[]>('ea_products',
      `slug=eq.${encodeURIComponent(slug)}&select=slug,category,is_active&limit=1`);
    if (!products) throw new Error('Product catalogue is unavailable.');
    const product = products[0];
    if (!product || !product.is_active || product.category === 'SANDBOX') {
      return NextResponse.json({ ready: false, error: 'This product is not active for release.' }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const ready = await hasApprovedProductArtifact(slug);
    return NextResponse.json({
      ready,
      status: ready ? 'APPROVED_RELEASE_ARTIFACT' : 'AWAITING_APPROVED_EX5',
      message: ready ? 'Approved private EA release artifact is available.' : 'An approved compiled .ex5 release artifact is not yet available.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Product release readiness check failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ready: false, error: 'Product release status could not be verified.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
