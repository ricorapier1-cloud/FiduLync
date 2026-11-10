import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/lib/serverConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'A valid upload request is required' }, { status: 400 });
    }
    const { filename, fileType } = body as { filename?: unknown; fileType?: unknown };

    if (typeof filename !== 'string' || !filename.trim() || filename.length > 255 || typeof fileType !== 'string' || !fileType.trim()) {
      return NextResponse.json({ error: 'Filename and fileType are required' }, { status: 400 });
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase storage is not configured' }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cleanFilename = `${Date.now()}_${filename.trim().replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `evidence/${cleanFilename}`;

    const { data, error } = await supabase.storage
      .from('dispute-evidence')
      .createSignedUploadUrl(filePath);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: filePath,
      token: data.token,
    });
  } catch (err: unknown) {
    console.error('Signed upload URL creation failed:', err);
    return NextResponse.json({ error: 'Unable to prepare the evidence upload.' }, { status: 503 });
  }
}
