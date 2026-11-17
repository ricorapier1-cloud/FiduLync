import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { validateCustomerLicense } from '@/lib/customerTelemetry';
import { isSupabaseConfigured, supabaseInsert, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';
import { sendTransferCodeEmail } from '@/lib/transactionalEmail';

export const dynamic = 'force-dynamic';

function hashCode(requestId: string, code: string, pepper: string) {
  return createHmac('sha256', pepper).update(requestId + ':' + code).digest('hex');
}

export async function POST(request: Request) {
  const pepper = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!isSupabaseConfigured() || !pepper) {
    return NextResponse.json({ error: 'License transfer is not configured.' }, { status: 503 });
  }
  if (!checkRateLimit(getClientIp(request), 5, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many transfer attempts. Try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid transfer request.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const action = input.action;
  const licenseKey = typeof input.license_key === 'string' ? input.license_key.trim() : '';
  const currentText = String(input.current_mt5_account ?? '').trim();
  const newText = String(input.new_mt5_account ?? '').trim();
  const currentAccount = /^\d{1,20}$/.test(currentText) ? Number(currentText) : Number.NaN;
  const newAccount = /^\d{1,20}$/.test(newText) ? Number(newText) : Number.NaN;

  if (!licenseKey || licenseKey.length > 128 || !Number.isSafeInteger(currentAccount) || currentAccount <= 0
    || !Number.isSafeInteger(newAccount) || newAccount <= 0 || currentAccount === newAccount) {
    return NextResponse.json({ error: 'Enter the existing and new MT5 account numbers correctly.' }, { status: 400 });
  }

  try {
    const licenseKind = await supabaseRead<Array<{ea_slug:string|null}>>('licenses',
      'license_key=eq.' + encodeURIComponent(licenseKey) + '&select=ea_slug&limit=1');
    if (licenseKind?.[0]?.ea_slug) {
      return NextResponse.json({error:'Subscription licenses must be rebound through the MT5 Account Slots manager. The 72-hour cooldown is enforced there.'},{status:409});
    }
    if (!await validateCustomerLicense(currentAccount, licenseKey)) {
      return NextResponse.json({ error: 'The existing license/account pair could not be verified.' }, { status: 401 });
    }

    const licenseRows = await supabaseRead<Array<{ email: string; status: string; expires_at: string | null }>>(
      'licenses',
      'license_key=eq.' + encodeURIComponent(licenseKey) + '&mt5_account=eq.' + currentAccount + '&select=email,status,expires_at&limit=1'
    );
    const owner = licenseRows?.[0];
    if (!owner?.email) {
      return NextResponse.json({ error: 'The license owner email could not be verified.' }, { status: 503 });
    }

    if (action === 'request') {
      const id = randomUUID();
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const inserted = await supabaseInsert('license_transfer_requests', {
        id,
        license_key: licenseKey,
        current_mt5_account: currentAccount,
        new_mt5_account: newAccount,
        email: owner.email.toLowerCase(),
        code_hash: hashCode(id, code, pepper),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (!inserted) {
        return NextResponse.json({ error: 'Unable to create a transfer request.' }, { status: 503 });
      }

      const sent = await sendTransferCodeEmail(owner.email, code, id);
      if (!sent) {
        await supabaseQuery('license_transfer_requests', {
          method: 'DELETE',
          query: 'id=eq.' + encodeURIComponent(id),
          prefer: 'return=minimal',
        });
        return NextResponse.json({
          error: 'Email delivery is not configured. Contact support; the license has not been changed.',
        }, { status: 503 });
      }

      return NextResponse.json({
        success: true,
        request_id: id,
        masked_email: owner.email.replace(/^(.).+(@.*)$/, '$1••••$2'),
        expires_in_seconds: 600,
      });
    }

    if (action === 'confirm') {
      const requestId = typeof input.request_id === 'string' ? input.request_id : '';
      const code = typeof input.code === 'string' ? input.code.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(requestId) || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Enter the six-digit code from your email.' }, { status: 400 });
      }

      const result = await supabaseQuery<Array<{
        complete_license_transfer: { success: boolean; reason?: string; mt5_account?: number };
      }>>('rpc/complete_license_transfer', {
        method: 'POST',
        body: {
          p_request_id: requestId,
          p_license_key: licenseKey,
          p_current_mt5_account: currentAccount,
          p_new_mt5_account: newAccount,
          p_code_hash: hashCode(requestId, code, pepper),
        },
      });

      const rpcPayload = result as unknown as
        | { complete_license_transfer?: { success: boolean; reason?: string; mt5_account?: number }; success?: boolean; reason?: string; mt5_account?: number }
        | Array<{ complete_license_transfer?: { success: boolean; reason?: string; mt5_account?: number } }>
        | null;
      const outcome = Array.isArray(rpcPayload)
        ? rpcPayload[0]?.complete_license_transfer
        : rpcPayload && 'complete_license_transfer' in rpcPayload
          ? rpcPayload.complete_license_transfer
          : rpcPayload;

      if (!outcome?.success) {
        return NextResponse.json({ error: outcome?.reason || 'Transfer could not be completed.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        mt5_account: outcome.mt5_account,
        message: 'License transferred. Re-enter your license in the EA on the new MT5 account.',
      });
    }

    return NextResponse.json({ error: 'Unsupported transfer action.' }, { status: 400 });
  } catch (error) {
    console.error('Customer license transfer failed:', error);
    return NextResponse.json({ error: 'Transfer service is temporarily unavailable.' }, { status: 503 });
  }
}
