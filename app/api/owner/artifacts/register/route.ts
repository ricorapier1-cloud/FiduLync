import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';
import { hasPrivateStorageObject } from '@/lib/productRelease';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return json({ error: 'Owner authentication required.' }, 401);
  const rate = await enforceDistributedRateLimit(request, 'owner-artifact-register', 20, 60_000);
  if (rate.unavailable) return json({ error: 'Owner artifact service is temporarily unavailable.' }, 503);
  if (!rate.allowed) return json({ error: 'Owner artifact rate limit exceeded.' }, 429);
  if (!isSupabaseConfigured()) return json({ error: 'Artifact database is not configured.' }, 503);

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'A valid registration request is required.' }, 400);
    const input = body as Record<string, unknown>;
    const slug = typeof input.ea_slug === 'string' ? input.ea_slug.trim().toLowerCase() : '';
    const version = typeof input.artifact_version === 'string' ? input.artifact_version.trim() : '';
    const sha256 = typeof input.sha256 === 'string' ? input.sha256.trim().toLowerCase() : '';
    const size = typeof input.size_bytes === 'number' ? input.size_bytes : Number(input.size_bytes);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(version)
      || !/^[a-f0-9]{64}$/.test(sha256)
      || !Number.isSafeInteger(size) || size <= 0 || size > 25 * 1024 * 1024) {
      return json({ error: 'Invalid product, version, SHA-256 or file size.' }, 400);
    }

    const storagePath = `${slug}/${version}/${sha256}.ex5`;
    if (!(await hasPrivateStorageObject(storagePath))) {
      return json({ error: 'The uploaded private .ex5 object could not be verified.' }, 409);
    }

    const recorded = await supabaseQuery('rpc/record_ea_product_artifact_upload', {
      method: 'POST',
      body: {
        p_ea_slug: slug,
        p_storage_path: storagePath,
        p_sha256: sha256,
        p_size_bytes: size,
        p_artifact_version: version,
        p_owner_email: owner.email,
      },
    });
    if (!recorded) throw new Error('Artifact registration and owner audit transaction did not complete.');
    return json({
      uploaded: true,
      release_approved: false,
      ea_slug: slug,
      artifact_version: version,
      sha256,
      size_bytes: size,
      message: 'Private .ex5 stored and SHA-256 metadata registered. Owner release approval and MT5 compatibility verification are still required.',
    }, 201);
  } catch (error) {
    console.error('Owner artifact registration failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Artifact registration could not be completed.' }, 503);
  }
}
