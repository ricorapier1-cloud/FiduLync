export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';

const providerHosts: Record<string, string[]> = {
  myfxbook: ['myfxbook.com'],
  fxblue: ['fxblue.com'],
};

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
  const provider = typeof body.provider === 'string' ? body.provider : '';
  const profileUrl = typeof body.profile_url === 'string' ? body.profile_url.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
    return NextResponse.json({ error: 'A valid listing ID is required.' }, { status: 400 });
  }
  if (!(provider in providerHosts)) {
    return NextResponse.json({ error: 'Choose Myfxbook or FXBlue. MT5 credentials use the encrypted sync flow.' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(profileUrl);
  } catch {
    return NextResponse.json({ error: 'Enter a valid provider profile URL.' }, { status: 400 });
  }
  const allowedHosts = providerHosts[provider];
  if (
    url.protocol !== 'https:' ||
    url.username || url.password ||
    !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
    profileUrl.length > 2000
  ) {
    return NextResponse.json({ error: 'Profile URL must be a secure link hosted by the selected provider.' }, { status: 400 });
  }

  const { data: listing, error: listingError } = await result.supabase
    .from('ea_listings')
    .select('id,owner_id')
    .eq('id', listingId)
    .maybeSingle();
  if (listingError) {
    console.error('Unable to verify listing owner:', listingError);
    return NextResponse.json({ error: 'Unable to verify listing ownership.' }, { status: 503 });
  }
  if (!listing || listing.owner_id !== result.user.id) {
    return NextResponse.json({ error: 'Only the listing owner can submit verification evidence.' }, { status: 403 });
  }

  const { error } = await result.supabase.from('ea_verification_submissions').insert({
    listing_id: listingId,
    owner_id: result.user.id,
    provider,
    profile_url: url.toString(),
    status: 'pending',
  });
  if (error) {
    console.error('EA verification request could not be saved:', error);
    return NextResponse.json({ error: 'Unable to submit provider evidence.' }, { status: 503 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
