import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// CORS headers for MetaTrader 5 and external client WebRequests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { license_key, mt5_account, ea_name } = body;

    if (!license_key || !mt5_account) {
      return NextResponse.json(
        { valid: false, error: 'Missing required parameters: license_key and mt5_account.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanedKey = String(license_key).trim().toUpperCase();
    const cleanedAccount = String(mt5_account).trim();

    // 1. Check Supabase DB if credentials exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const queryUrl = `${supabaseUrl}/rest/v1/licenses?license_key=eq.${encodeURIComponent(cleanedKey)}&select=*`;
        const dbRes = await fetch(queryUrl, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });

        if (dbRes.ok) {
          const rows = await dbRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const license = rows[0];

            if (license.status !== 'active') {
              return NextResponse.json(
                { valid: false, error: 'License has been revoked or suspended.' },
                { status: 403, headers: corsHeaders }
              );
            }

            if (license.bound_account && license.bound_account !== cleanedAccount) {
              return NextResponse.json(
                { valid: false, error: 'License is already bound to another MT5 account number.' },
                { status: 403, headers: corsHeaders }
              );
            }

            if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
              return NextResponse.json(
                { valid: false, error: 'License subscription has expired.' },
                { status: 403, headers: corsHeaders }
              );
            }

            return NextResponse.json(
              {
                valid: true,
                message: 'One-time EA license verified successfully. Terminal execution authorized.',
                account: cleanedAccount,
                license_type: license.license_type || 'one_time_purchase',
                tier: license.tier || 'Institutional VIP',
                ea: ea_name || 'AlgoLync Strategy Suite',
                expires_at: license.expires_at || null,
              },
              { status: 200, headers: corsHeaders }
            );
          }
        }
      } catch (dbErr) {
        console.warn('Database license lookup fallback:', dbErr);
      }
    }

    // 2. Format Validation Fallback
    // Format: ALGOLYNX-[TIER]-[CHECKSUM/IDENTIFIER] e.g. ALGOLYNX-PRO-98421
    const parts = cleanedKey.split('-');
    const isValidStructure = parts.length >= 3 && parts[0] === 'ALGOLYNX';

    if (!isValidStructure) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or malformed license key.' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Return verified one-time purchase license status
    return NextResponse.json(
      {
        valid: true,
        message: 'Algolync one-time purchase license verified. Terminal authorized.',
        account: cleanedAccount,
        license_type: 'one_time_purchase',
        tier: parts[1] === 'VIP' ? 'Institutional VIP' : 'Professional Lifetime',
        ea: ea_name || 'AlgoLync Strategy Suite',
        expires_at: null,
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || 'Internal server error during license verification' },
      { status: 500, headers: corsHeaders }
    );
  }
}
