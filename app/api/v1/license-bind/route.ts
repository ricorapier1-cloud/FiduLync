import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { isSupabaseConfigured, supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { sendTransferCodeEmail } from '@/lib/transactionalEmail';

export const dynamic = 'force-dynamic';

function codeHash(requestId: string, code: string, pepper: string) {
  return createHmac('sha256', pepper).update(requestId + ':' + code).digest('hex');
}

export async function POST(request: Request) {
  const rate = await enforceDistributedRateLimit(request, 'license-bind-transfer', 5, 60 * 60_000);
  if (rate.unavailable) return NextResponse.json({ success: false, error: 'License binding security service is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (!rate.allowed) return NextResponse.json({ success: false, error: 'Too many binding attempts. Try again later.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({ success: false, error: 'Request body exceeds 8 KB.' }, { status: 413 });

  const pepper = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!isSupabaseConfigured() || !pepper) {
    return NextResponse.json({ success: false, error: 'License binding is temporarily unavailable.' }, { status: 503 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Invalid binding request.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const action = input.action;
  const licenseKey = typeof input.license_key === 'string' ? input.license_key.trim().toUpperCase() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const accountText = String(input.mt5_account ?? '').trim();
  const mt5Account = /^\d{1,20}$/.test(accountText) ? Number(accountText) : Number.NaN;

  if (!/^ALGOLYNX-[A-Z0-9-]{8,100}$/.test(licenseKey)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !Number.isSafeInteger(mt5Account) || mt5Account <= 0) {
    return NextResponse.json({ success: false, error: 'Enter a valid license key, purchase email and MT5 login number.' }, { status: 400 });
  }

  try {
    if (action === 'request') {
      const licenses = await supabaseRead<Array<{ license_key: string; email: string; status: string; expires_at: string | null }>>(
        'licenses',
        `license_key=eq.${encodeURIComponent(licenseKey)}&email=eq.${encodeURIComponent(email)}&mt5_account=is.null&select=license_key,email,status,expires_at&limit=1`
      );
      const license = licenses?.[0];
      if (!license || license.status !== 'active'
        || (license.expires_at !== null && Date.parse(license.expires_at) <= Date.now())) {
        return NextResponse.json({ success: false, error: 'No active unbound license matches that key and purchase email.' }, { status: 404 });
      }

      const id = randomUUID();
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const inserted = await supabaseInsert('license_transfer_requests', {
        id,
        license_key: licenseKey,
        current_mt5_account: 0,
        new_mt5_account: mt5Account,
        email,
        code_hash: codeHash(id, code, pepper),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (!inserted) throw new Error('Supabase did not confirm the binding request insert.');

      const sent = await sendTransferCodeEmail(email, code, id);
      if (!sent) {
        await supabaseQuery('license_transfer_requests', {
          method: 'DELETE',
          query: `id=eq.${encodeURIComponent(id)}`,
          prefer: 'return=minimal',
        });
        return NextResponse.json({ success: false, error: 'Email delivery is not configured. No account has been bound.' }, { status: 503 });
      }
      return NextResponse.json({
        success: true,
        request_id: id,
        masked_email: email.replace(/^(.).+(@.*)$/, '$1••••$2'),
        expires_in_seconds: 600,
        message: 'A one-time verification code has been sent to the purchase email.',
      });
    }

    if (action === 'confirm') {
      const requestId = typeof input.request_id === 'string' ? input.request_id : '';
      const code = typeof input.code === 'string' ? input.code.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(requestId) || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ success: false, error: 'Enter the six-digit email verification code.' }, { status: 400 });
      }
      const result = await supabaseQuery<unknown>('rpc/complete_initial_license_binding', {
        method: 'POST',
        body: {
          p_request_id: requestId,
          p_license_key: licenseKey,
          p_new_mt5_account: mt5Account,
          p_code_hash: codeHash(requestId, code, pepper),
        },
      });
      const outcome = Array.isArray(result) ? result[0] : result;
      const payload = outcome && typeof outcome === 'object' && 'complete_initial_license_binding' in outcome
        ? (outcome as Record<string, unknown>).complete_initial_license_binding : outcome;
      if (!payload || typeof payload !== 'object' || !('success' in payload) || (payload as { success: unknown }).success !== true) {
        const reason = payload && typeof payload === 'object' && 'reason' in payload
          ? String((payload as { reason: unknown }).reason) : 'Account binding could not be completed.';
        return NextResponse.json({ success: false, error: reason }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        mt5_account: mt5Account,
        message: 'License successfully bound. Enter the same license key in your MT5 EA.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported binding action.' }, { status: 400 });
  } catch (error) {
    console.error('AlgoLync initial license binding failed:', {
      license_key_suffix: licenseKey.slice(-8),
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'License binding service is temporarily unavailable.' }, { status: 503 });
  }
}
