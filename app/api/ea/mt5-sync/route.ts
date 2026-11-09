import { createCipheriv, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';

export async function POST(request: Request) {
  const result = await requireUser(request);
  if ('response' in result) return result.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const listingId = typeof body.listing_id === 'string' ? body.listing_id : '';
  const account = typeof body.account === 'string' ? body.account.trim() : '';
  const server = typeof body.server === 'string' ? body.server.trim() : '';
  const investorPassword = typeof body.investor_password === 'string' ? body.investor_password : '';
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId) ||
    !/^\d{4,20}$/.test(account) ||
    server.length < 2 || server.length > 100 ||
    investorPassword.length < 1 || investorPassword.length > 128
  ) {
    return NextResponse.json({ error: 'Provide a valid listing, MT5 account, server and investor password.' }, { status: 400 });
  }

  const configuredKey = process.env.MT5_CREDENTIALS_ENCRYPTION_KEY;
  if (!configuredKey) {
    return NextResponse.json({ error: 'Encrypted MT5 sync is not configured.' }, { status: 503 });
  }

  const encryptionKey = Buffer.from(configuredKey, 'base64');
  if (encryptionKey.length !== 32) {
    console.error('MT5_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    return NextResponse.json({ error: 'Encrypted MT5 sync is not configured correctly.' }, { status: 503 });
  }

  const { data: listing, error: listingError } = await result.supabase
    .from('ea_listings')
    .select('id,owner_id')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) {
    console.error('Unable to verify MT5 listing ownership:', listingError);
    return NextResponse.json({ error: 'Unable to verify listing ownership.' }, { status: 503 });
  }
  if (!listing || listing.owner_id !== result.user.id) {
    return NextResponse.json({ error: 'Only the listing owner can connect its MT5 investor account.' }, { status: 403 });
  }

  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
  const encryptedCredentials = Buffer.concat([
    cipher.update(JSON.stringify({ account, server, investorPassword }), 'utf8'),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();
  const { error: saveError } = await result.supabase.from('ea_integrations').upsert({
    listing_id: listingId,
    owner_id: result.user.id,
    provider: 'mt5_direct',
    encrypted_credentials: encryptedCredentials.toString('base64'),
    credentials_nonce: nonce.toString('base64'),
    credentials_tag: authenticationTag.toString('base64'),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'listing_id,owner_id,provider' });

  if (saveError) {
    console.error('Encrypted MT5 integration could not be saved:', saveError);
    return NextResponse.json({ error: 'Unable to securely save MT5 investor credentials.' }, { status: 503 });
  }

  const { error: queueError } = await result.supabase.from('ea_verification_submissions').insert({
    listing_id: listingId,
    owner_id: result.user.id,
    provider: 'mt5_direct',
    status: 'pending',
  });
  if (queueError) {
    console.error('MT5 account verification could not be queued:', queueError);
    return NextResponse.json({ error: 'Credentials were encrypted, but the verification request could not be queued.' }, { status: 503 });
  }

  return NextResponse.json({ success: true, message: 'Investor account credentials were encrypted and submitted for verification.' }, { status: 201 });
}
