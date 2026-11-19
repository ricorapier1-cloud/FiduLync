import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type ProductRecord = { slug: string; category: string; is_active: boolean };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

async function ownerGate(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return { response: json({ error: 'Owner authentication required.' }, 401) };
  const rate = await enforceDistributedRateLimit(request, 'owner-artifact-upload-url', 20, 60_000);
  if (rate.unavailable) return { response: json({ error: 'Owner artifact service is temporarily unavailable.' }, 503) };
  if (!rate.allowed) return { response: json({ error: 'Owner artifact rate limit exceeded.' }, 429) };
  if (!isSupabaseConfigured()) return { response: json({ error: 'Artifact database is not configured.' }, 503) };
  return { owner };
}

async function eligibleProduct(slug: string): Promise<boolean> {
  const products = await supabaseRead<ProductRecord[]>('ea_products',
    `slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=slug,category,is_active&limit=1`);
  if (!products) throw new Error('Product catalogue is unavailable.');
  return Boolean(products[0] && products[0].is_active && products[0].category !== 'SANDBOX');
}

function validArtifactInput(value: Record<string, unknown>) {
  const slug = typeof value.ea_slug === 'string' ? value.ea_slug.trim().toLowerCase() : '';
  const version = typeof value.artifact_version === 'string' ? value.artifact_version.trim() : '';
  const sha256 = typeof value.sha256 === 'string' ? value.sha256.trim().toLowerCase() : '';
  const size = typeof value.size_bytes === 'number' ? value.size_bytes : Number(value.size_bytes);
  const fileName = typeof value.file_name === 'string' ? value.file_name.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(version)
    || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isSafeInteger(size) || size <= 0 || size > 25 * 1024 * 1024
    || !fileName.endsWith('.ex5')) return null;
  return { slug, version, sha256, size, fileName };
}

export async function POST(request: Request) {
  const auth = await ownerGate(request);
  if ('response' in auth) return auth.response;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'A valid upload request is required.' }, 400);
    const input = validArtifactInput(body as Record<string, unknown>);
    if (!input) return json({ error: 'Invalid product, version, SHA-256 or file size.' }, 400);
    if (!(await eligibleProduct(input.slug))) return json({ error: 'Only active commercial EA products can receive release artifacts.' }, 409);

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !serviceKey) throw new Error('Private Storage credentials are not configured.');
    const storagePath = `${input.slug}/${input.version}/${input.sha256}.ex5`;
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
    const signed = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/algolync-artifacts/${encodedPath}`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!signed.ok) throw new Error(`Supabase signed-upload request failed (${signed.status}).`);
    const payload: unknown = await signed.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Supabase returned an invalid signed-upload response.');
    const response = payload as Record<string, unknown>;
    const path = typeof response.url === 'string' ? response.url : typeof response.signedURL === 'string' ? response.signedURL : '';
    if (!path) throw new Error('Supabase did not return a signed upload URL.');
    const uploadUrl = path.startsWith('http') ? path : `${supabaseUrl}/storage/v1${path.startsWith('/') ? path : `/${path}`}`;
    return json({ upload_url: uploadUrl, storage_path: storagePath, expires_in_seconds: 7200 }, 201);
  } catch (error) {
    console.error('Owner artifact signed-upload creation failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'A private signed upload could not be created.' }, 503);
  }
}
