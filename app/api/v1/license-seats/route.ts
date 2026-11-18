import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type License = {
  license_key: string; ea_slug: string | null; status: string | null; expires_at: string | null;
  included_live_seats: number; extra_live_seats: number; included_demo_seats: number; tier: string; mt5_account: number | null;
};

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 12, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many account-slot requests.' }, { status: 429 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: 'Seat management is unavailable.' }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const licenseKey = typeof body.license_key === 'string' ? body.license_key.trim().toUpperCase() : '';
    const action = body.action === 'bind' ? 'bind' : 'list';
    if (!/^ALGOLYNX-[A-Z0-9-]{8,100}$/.test(licenseKey)) {
      return NextResponse.json({ success: false, error: 'A valid license key is required.' }, { status: 400 });
    }

    const licenses = await supabaseRead<License[]>(
      'licenses',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,ea_slug,status,expires_at,included_live_seats,extra_live_seats,included_demo_seats&limit=1`
    );
    const license = licenses?.[0];
    if (!license || !license.ea_slug) return NextResponse.json({ success: false, error: 'Subscription not found.' }, { status: 404 });

    if (action === 'bind') {
      if (String(license.tier).toUpperCase() === 'DEMO_TRIAL') {
        return NextResponse.json({ success: false, error: 'Demo trial accounts are permanently locked to the MT5 demo login used at registration.' }, { status: 403 });
      }
      const slotType = body.slot_type === 'DEMO' ? 'DEMO' : body.slot_type === 'LIVE' ? 'LIVE' : '';
      const slotNumber = Number(body.slot_number);
      const newLoginText = String(body.new_mt5_login ?? '').trim();
      const newLogin = /^\\d{1,20}$/.test(newLoginText) ? Number(newLoginText) : Number.NaN;
      const currentText = String(body.current_mt5_login ?? '').trim();
      const currentLogin = currentText === '' ? null : /^\\d{1,20}$/.test(currentText) ? Number(currentText) : Number.NaN;
      const brokerServer = typeof body.broker_server === 'string' ? body.broker_server.trim().slice(0, 120) : null;
      if (!slotType || !Number.isSafeInteger(slotNumber) || slotNumber < 1
        || !Number.isSafeInteger(newLogin) || newLogin <= 0
        || (currentLogin !== null && (!Number.isSafeInteger(currentLogin) || currentLogin <= 0))) {
        return NextResponse.json({ success: false, error: 'Slot type, slot number and valid new MT5 login are required.' }, { status: 400 });
      }
      const result = await supabaseQuery<Record<string, unknown>>('rpc/bind_ea_license_seat', {
        method: 'POST',
        body: {
          p_license_key: licenseKey, p_slot_type: slotType, p_slot_number: slotNumber,
          p_current_mt5_login: currentLogin, p_new_mt5_login: newLogin, p_broker_server: brokerServer,
        },
      });
      return NextResponse.json({ success: true, result }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (String(license.tier).toUpperCase() === 'DEMO_TRIAL') {
      return NextResponse.json({ success: true, ea_slug: license.ea_slug, status: license.status, expires_at: license.expires_at, demo_locked: true, slots: [{ slot_type: 'DEMO', slot_number: 1, mt5_login: license.mt5_account, broker_server: null, rebind_available_at: null }] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const rows = await supabaseRead<Array<{
      slot_type: 'LIVE' | 'DEMO'; slot_number: number; mt5_login: number | null;
      broker_server: string | null; rebind_available_at: string | null;
    }>>(
      'ea_license_seats',
      `license_key=eq.${encodeURIComponent(licenseKey)}&select=slot_type,slot_number,mt5_login,broker_server,rebind_available_at&order=slot_type.asc,slot_number.asc`
    );
    const seats = rows ?? [];
    const slots = [
      ...Array.from({ length: Math.max(0, license.included_live_seats + license.extra_live_seats) }, (_, index) => ({ slot_type: 'LIVE' as const, slot_number: index + 1 })),
      ...Array.from({ length: Math.max(0, license.included_demo_seats) }, (_, index) => ({ slot_type: 'DEMO' as const, slot_number: index + 1 })),
    ].map((slot) => {
      const current = seats.find((seat) => seat.slot_type === slot.slot_type && seat.slot_number === slot.slot_number);
      return { ...slot, mt5_login: current?.mt5_login ?? null, broker_server: current?.broker_server ?? null, rebind_available_at: current?.rebind_available_at ?? null };
    });

    return NextResponse.json({
      success: true, ea_slug: license.ea_slug, status: license.status,
      expires_at: license.expires_at, slots,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seat operation failed.';
    if (/cooldown/i.test(message)) return NextResponse.json({ success: false, error: message }, { status: 409 });
    console.error('AlgoLync seat management failed:', error);
    return NextResponse.json({ success: false, error: 'Seat management failed. Check the license and retry.' }, { status: 503 });
  }
}
