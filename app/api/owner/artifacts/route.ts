import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { hasStoredProductArtifact } from '@/lib/productRelease';

export const dynamic = 'force-dynamic';

type ProductRecord = { slug: string; category: string; is_active: boolean };
type ArtifactRecord = {
  ea_slug: string;
  storage_path: string;
  sha256: string;
  size_bytes: number;
  artifact_version: string;
  release_approved: boolean;
  approved_at: string | null;
  updated_at: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function storageCredentials() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Private artifact storage is not configured.');
  return { url, key };
}

async function authorize(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return { response: json({ error: 'Owner authentication required.' }, 401) };
  const rate = await enforceDistributedRateLimit(request, 'owner-artifacts', 20, 60_000);
  if (rate.unavailable) return { response: json({ error: 'Owner artifact service is temporarily unavailable.' }, 503) };
  if (!rate.allowed) return { response: json({ error: 'Owner artifact rate limit exceeded.' }, 429) };
  if (!isSupabaseConfigured()) return { response: json({ error: 'Artifact database is not configured.' }, 503) };
  return { owner };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  try {
    const artifacts = await supabaseRead<ArtifactRecord[]>('ea_product_artifacts',
      'select=ea_slug,storage_path,sha256,size_bytes,artifact_version,release_approved,approved_at,updated_at&order=updated_at.desc');
    if (!artifacts) throw new Error('Artifact registry returned no result.');
    return json({ artifacts });
  } catch (error) {
    console.error('Owner artifact list failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Artifact registry could not be read.' }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  const { owner } = auth;

  if (Number(request.headers.get('content-length') ?? 0) > 26 * 1024 * 1024) {
    return json({ error: 'Artifact upload exceeds the 25 MB limit.' }, 413);
  }

  let uploadedPath = '';
  try {
    const form = await request.formData();
    const eaSlug = typeof form.get('ea_slug') === 'string' ? String(form.get('ea_slug')).trim().toLowerCase() : '';
    const version = typeof form.get('artifact_version') === 'string' ? String(form.get('artifact_version')).trim() : '';
    const file = form.get('file');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)) return json({ error: 'A valid EA product slug is required.' }, 400);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(version)) return json({ error: 'Artifact version must be 1–32 letters, numbers, dots, underscores or hyphens.' }, 400);
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.ex5') || file.size <= 0 || file.size > 25 * 1024 * 1024) {
      return json({ error: 'Upload one compiled .ex5 file between 1 byte and 25 MB.' }, 400);
    }

    const products = await supabaseRead<ProductRecord[]>('ea_products',
      `slug=eq.${encodeURIComponent(eaSlug)}&is_active=eq.true&select=slug,category,is_active&limit=1`);
    if (!products) throw new Error('Product catalogue is unavailable.');
    const product = products[0];
    if (!product || !product.is_active || product.category === 'SANDBOX') {
      return json({ error: 'Only active commercial EA products can receive release artifacts.' }, 409);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const storagePath = `${eaSlug}/${version}/${sha256}.ex5`;
    const { url, key } = storageCredentials();
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
    const storageResponse = await fetch(`${url}/storage/v1/object/algolync-artifacts/${encodedPath}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: bytes,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!storageResponse.ok) {
      const detail = await storageResponse.text();
      console.error('Private EA artifact upload failed:', storageResponse.status, detail.slice(0, 500));
      return json({ error: 'Private artifact storage rejected the upload.' }, 503);
    }

    const recorded = await supabaseQuery('rpc/record_ea_product_artifact_upload', {
      method: 'POST',
      body: {
        p_ea_slug: eaSlug,
        p_storage_path: storagePath,
        p_sha256: sha256,
        p_size_bytes: bytes.byteLength,
        p_artifact_version: version,
        p_owner_email: owner.email,
      },
    });
    if (!recorded) throw new Error('Artifact upload record and audit transaction did not complete.');

    return json({
      uploaded: true,
      release_approved: false,
      ea_slug: eaSlug,
      artifact_version: version,
      sha256,
      size_bytes: bytes.byteLength,
      message: 'Private .ex5 stored and hashed. Owner release approval and MT5 compatibility verification are still required.',
    }, 201);
  } catch (error) {
    console.error('Owner artifact upload failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Artifact upload could not be completed. Any unregistered private object is not eligible for release.' }, 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if ('response' in auth) return auth.response;
  const { owner } = auth;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'A valid JSON request is required.' }, 400);
    const input = body as Record<string, unknown>;
    const eaSlug = typeof input.ea_slug === 'string' ? input.ea_slug.trim().toLowerCase() : '';
    const action = input.action;
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug)
      || (action !== 'approve' && action !== 'revoke')
      || input.confirm !== true
      || reason.length < 12 || reason.length > 500) {
      return json({ error: 'Confirm the release action and provide a reason of at least 12 characters.' }, 400);
    }

    if (action === 'approve' && !(await hasStoredProductArtifact(eaSlug))) {
      return json({ error: 'The private .ex5 object or its integrity metadata could not be verified.' }, 409);
    }

    const result = await supabaseQuery('rpc/set_ea_product_artifact_release_status', {
      method: 'POST',
      body: {
        p_ea_slug: eaSlug,
        p_release_approved: action === 'approve',
        p_owner_email: owner.email,
        p_reason: reason,
      },
    });
    if (!result) throw new Error('Release status and owner audit transaction did not complete.');
    return json({ updated: true, action, result });
  } catch (error) {
    console.error('Owner EA release status update failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'EA release status could not be changed.' }, 503);
  }
}
