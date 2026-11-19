import 'server-only';

import { createHash } from 'node:crypto';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

type ProductArtifact = {
  ea_slug: string;
  storage_path: string;
  sha256: string;
  size_bytes: number | string;
  artifact_version: string;
  release_approved: boolean;
  approved_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function createPrivateStorageReadUrl(storagePath: string): Promise<string | null> {
  if (!storagePath || storagePath.startsWith('/')
    || storagePath.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return null;

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) throw new Error('Private EA artifact storage is not configured.');

  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/algolync-artifacts/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: 60 }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  if (!isRecord(payload)) return null;
  const signedPath = typeof payload.signedURL === 'string' ? payload.signedURL
    : typeof payload.signedUrl === 'string' ? payload.signedUrl : '';
  if (!signedPath) return null;
  return signedPath.startsWith('http') ? signedPath : `${supabaseUrl}/storage/v1${signedPath.startsWith('/') ? signedPath : `/${signedPath}`}`;
}

export async function hasPrivateStorageObject(storagePath: string): Promise<boolean> {
  return Boolean(await createPrivateStorageReadUrl(storagePath));
}

async function verifyStoredObjectHash(artifact: ProductArtifact): Promise<boolean> {
  const signedUrl = await createPrivateStorageReadUrl(artifact.storage_path);
  if (!signedUrl) return false;
  const response = await fetch(signedUrl, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== Number(artifact.size_bytes)) return false;
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  return actualHash === artifact.sha256.toLowerCase();
}

async function verifyStoredObject(artifact: ProductArtifact): Promise<boolean> {
  if (typeof artifact.storage_path !== 'string'
    || !artifact.storage_path.trim()
    || typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(artifact.sha256)
    || !Number.isSafeInteger(Number(artifact.size_bytes)) || Number(artifact.size_bytes) <= 0
    || typeof artifact.artifact_version !== 'string' || !artifact.artifact_version.trim()) return false;
  return hasPrivateStorageObject(artifact.storage_path);
}

async function checkProductArtifact(eaSlug: string, requireApproval: boolean): Promise<boolean> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eaSlug) || !isSupabaseConfigured()) return false;

  const artifacts = await supabaseRead<ProductArtifact[]>('ea_product_artifacts',
    `ea_slug=eq.${encodeURIComponent(eaSlug)}&select=ea_slug,storage_path,sha256,size_bytes,artifact_version,release_approved,approved_at&limit=1`);
  if (!artifacts) throw new Error('EA release registry is unavailable.');
  const artifact = artifacts[0];
  if (!artifact || artifact.ea_slug !== eaSlug) return false;
  if (requireApproval && !(artifact.release_approved === true
    && typeof artifact.approved_at === 'string'
    && Number.isFinite(Date.parse(artifact.approved_at)))) return false;
  const exists = await verifyStoredObject(artifact);
  if (!exists) return false;
  return requireApproval ? true : verifyStoredObjectHash(artifact);
}

/** Confirms that the registered private .ex5 object still exists and has integrity metadata. */
export function hasStoredProductArtifact(eaSlug: string): Promise<boolean> {
  return checkProductArtifact(eaSlug, false);
}

/** A product is releasable only after owner approval and private Storage verification. */
export function hasApprovedProductArtifact(eaSlug: string): Promise<boolean> {
  return checkProductArtifact(eaSlug, true);
}
