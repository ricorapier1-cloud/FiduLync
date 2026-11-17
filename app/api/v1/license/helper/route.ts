import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0', 'Content-Disposition': 'attachment; filename="MacroLyncLicense.mqh"' };
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'License authority unavailable.' }, { status: 503 });
  try {
    const body = await request.json();
    const key = String(body?.license_key ?? '').trim().toUpperCase();
    const login = Number(body?.mt5_login ?? 0);
    const slug = String(body?.ea_slug ?? '').trim().toLowerCase();
    if (!key || !Number.isSafeInteger(login) || login <= 0 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Valid license, MT5 login and EA slug are required.' }, { status: 400, headers });
    }
    const rows = await supabaseRead<Array<Record<string, unknown>>>('licenses',
      `license_key=eq.${encodeURIComponent(key)}&select=license_key,status,ea_slug,expires_at&limit=1`);
    const license = rows?.[0];
    if (!license || String(license.ea_slug ?? '') !== slug || String(license.status).toUpperCase() !== 'ACTIVE'
      || (license.expires_at && new Date(String(license.expires_at)).getTime() <= Date.now())) {
      return NextResponse.json({ error: 'No active license for this EA.' }, { status: 403, headers });
    }
    const seats = await supabaseRead<Array<{ mt5_login: number }>>('ea_license_seats',
      `license_key=eq.${encodeURIComponent(key)}&mt5_login=eq.${login}&select=mt5_login&limit=1`);
    if (!seats?.length) return NextResponse.json({ error: 'MT5 login is not bound to a subscription seat.' }, { status: 403, headers });
    const source = await readFile(join(process.cwd(), 'mql5', 'MacroLyncLicense.mqh'), 'utf8');
    return new NextResponse(source, { status: 200, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error) {
    console.error('Private MQL5 helper download failed:', error);
    return NextResponse.json({ error: 'Private helper download unavailable.' }, { status: 503, headers });
  }
}
