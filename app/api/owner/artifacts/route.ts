import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { hasStoredProductArtifact } from '@/lib/productRelease';

export const dynamic = 'force-dynamic';

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
    const [artifacts, products] = await Promise.all([
      supabaseRead<ArtifactRecord[]>('ea_product_artifacts',
        'select=ea_slug,storage_path,sha256,size_bytes,artifact_version,release_approved,approved_at,updated_at&order=updated_at.desc'),
      supabaseRead<Array<{ slug: string; name: string }>>('ea_products',
        'is_active=eq.true&category=neq.SANDBOX&select=slug,name&order=name.asc'),
    ]);
    if (!artifacts || !products) throw new Error('Artifact registry or product catalogue returned no result.');
    return json({ artifacts, products });
  } catch (error) {
    console.error('Owner artifact list failed:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Artifact registry could not be read.' }, 503);
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
