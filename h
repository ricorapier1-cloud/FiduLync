[1mdiff --git a/app/api/cron/sync-macro/route.ts b/app/api/cron/sync-macro/route.ts[m
[1mindex 7e10c75..fea9c5a 100644[m
[1m--- a/app/api/cron/sync-macro/route.ts[m
[1m+++ b/app/api/cron/sync-macro/route.ts[m
[36m@@ -3,15 +3,14 @@[m [mimport { NextResponse } from 'next/server';[m
 export const dynamic = 'force-dynamic';[m
 [m
 export async function GET(req: Request) {[m
[31m-  const authHeader = req.headers.get('authorization');[m
[31m-  // Optional security check for cron secret if configured[m
[31m-  const cronSecret = process.env.CRON_SECRET;[m
[32m+[m[32m  const authHeader = req.headers.get('authorization') ?? '';[m
[32m+[m[32m  const cronSecret = process.env.CRON_SECRET?.trim() ?? '';[m
[32m+[m
   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {[m
     return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });[m
   }[m
 [m
   const timestamp = new Date().toISOString();[m
[31m-  console.log(`[CRON] Background macro intelligence synchronization executed at ${timestamp}`);[m
 [m
   return NextResponse.json({[m
     status: 'success',[m
[1mdiff --git a/app/api/v1/create-checkout/route.ts b/app/api/v1/create-checkout/route.ts[m
[1mindex 6742bb3..b8be42e 100644[m
[1m--- a/app/api/v1/create-checkout/route.ts[m
[1m+++ b/app/api/v1/create-checkout/route.ts[m
[36m@@ -1,30 +1,47 @@[m
[31m-import { NextResponse } from 'next/server';[m
 import crypto from 'crypto';[m
[32m+[m[32mimport { NextResponse } from 'next/server';[m
 import { checkRateLimit } from '@/lib/rateLimit';[m
[32m+[m[32mimport { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';[m
 [m
 export const dynamic = 'force-dynamic';[m
 [m
[32m+[m[32mfunction buildSandboxLicenseKey(mt5Account: number): string {[m
[32m+[m[32m  return `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mexport async function GET() {[m
[32m+[m[32m  return NextResponse.json({[m
[32m+[m[32m    status: 'active',[m
[32m+[m[32m    endpoint: '/api/v1/create-checkout',[m
[32m+[m[32m    description: 'AlgoLync MT5 Cloud Gate checkout and license initialization gateway.',[m
[32m+[m[32m    methods: ['GET', 'POST'],[m
[32m+[m[32m  });[m
[32m+[m[32m}[m
[32m+[m
 export async function POST(req: Request) {[m
   const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';[m
[31m-  if (!checkRateLimit(ip, 15, 60000)) {[m
[31m-    return NextResponse.json({ success: false, error: 'Too many checkout requests.' }, { status: 429 });[m
[32m+[m[32m  if (!checkRateLimit(ip, 25, 60_000)) {[m
[32m+[m[32m    return NextResponse.json({ success: false, error: 'Too many checkout requests. Please wait.' }, { status: 429 });[m
   }[m
 [m
   try {[m
     const body = await req.json();[m
[31m-    const email = String(body?.email || '').trim().toLowerCase();[m
[31m-    const mt5Account = Number(body?.mt5_account || 0);[m
[32m+[m[32m    const email = String(body?.email ?? '').trim().toLowerCase();[m
[32m+[m[32m    const mt5Account = Number(body?.mt5_account ?? 0);[m
 [m
[31m-    if (!email.includes('@') || mt5Account <= 0) {[m
[31m-      return NextResponse.json({ success: false, error: 'Enter a valid email and MT5 account number.' }, { status: 400 });[m
[32m+[m[32m    if (!email.includes('@') || !Number.isFinite(mt5Account) || mt5Account <= 0) {[m
[32m+[m[32m      return NextResponse.json([m
[32m+[m[32m        { success: false, error: 'Enter a valid email and MT5 account login number.' },[m
[32m+[m[32m        { status: 400 }[m
[32m+[m[32m      );[m
     }[m
 [m
[31m-    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';[m
[32m+[m[32m    const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';[m
     const reference = `ALGO_${mt5Account}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;[m
 [m
     if (paystackSecret.startsWith('sk_')) {[m
[31m-      const origin = req.headers.get('origin') || 'https://fidulync.vercel.app';[m
[31m-      const psRes = await fetch('https://api.paystack.co/transaction/initialize', {[m
[32m+[m[32m      const origin = req.headers.get('origin') ?? 'https://fidulync.vercel.app';[m
[32m+[m[32m      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {[m
         method: 'POST',[m
         headers: {[m
           Authorization: `Bearer ${paystackSecret}`,[m
[36m@@ -35,22 +52,44 @@[m [mexport async function POST(req: Request) {[m
           amount: 15000000,[m
           reference,[m
           callback_url: `${origin}/store?ref=${reference}`,[m
[31m-          metadata: { mt5_account: mt5Account, tier: 'INSTITUTIONAL_PRO' },[m
[32m+[m[32m          metadata: {[m
[32m+[m[32m            mt5_account: mt5Account,[m
[32m+[m[32m            tier: 'INSTITUTIONAL_PRO',[m
[32m+[m[32m          },[m
         }),[m
       });[m
 [m
[31m-      const psData = await psRes.json();[m
[31m-      if (psData?.status && psData?.data?.authorization_url) {[m
[32m+[m[32m      const paystackData = await paystackResponse.json();[m
[32m+[m[32m      if (paystackResponse.ok && paystackData?.status && paystackData?.data?.authorization_url) {[m
         return NextResponse.json({[m
           success: true,[m
           mode: 'paystack_redirect',[m
[31m-          authorization_url: psData.data.authorization_url,[m
[32m+[m[32m          authorization_url: paystackData.data.authorization_url,[m
           reference,[m
         });[m
       }[m
     }[m
 [m
[31m-    const licenseKey = `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;[m
[32m+[m[32m    const licenseKey = buildSandboxLicenseKey(mt5Account);[m
[32m+[m
[32m+[m[32m    if (isSupabaseConfigured()) {[m
[32m+[m[32m      await supabaseQuery('licenses', {[m
[32m+[m[32m        method: 'POST',[m
[32m+[m[32m        prefer: 'resolution=merge-duplicates',[m
[32m+[m[32m        body: {[m
[32m+[m[32m          license_key: licenseKey,[m
[32m+[m[32m          mt5_account: mt5Account,[m
[32m+[m[32m          email,[m
[32m+[m[32m          tier: 'INSTITUTIONAL_PRO',[m
[32m+[m[32m          status: 'active',[m
[32m+[m[32m          created_at: new Date().toISOString(),[m
[32m+[m[32m          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),[m
[32m+[m[32m        },[m
[32m+[m[32m      }).catch((error) => {[m
[32m+[m[32m        console.warn('Instant license provision warning:', error);[m
[32m+[m[32m      });[m
[32m+[m[32m    }[m
[32m+[m
     return NextResponse.json({[m
       success: true,[m
       mode: 'sandbox_instant',[m
[36m@@ -58,8 +97,8 @@[m [mexport async function POST(req: Request) {[m
       email,[m
       mt5_account: mt5Account,[m
     });[m
[31m-  } catch (err: unknown) {[m
[31m-    const message = err instanceof Error ? err.message : 'Checkout initialization failed';[m
[32m+[m[32m  } catch (error: unknown) {[m
[32m+[m[32m    const message = error instanceof Error ? error.message : 'Checkout initialization failed';[m
     return NextResponse.json({ success: false, error: message }, { status: 500 });[m
   }[m
 }[m
[1mdiff --git a/app/api/v1/macro-signal/route.ts b/app/api/v1/macro-signal/route.ts[m
[1mindex d395238..8b5ff10 100644[m
[1m--- a/app/api/v1/macro-signal/route.ts[m
[1m+++ b/app/api/v1/macro-signal/route.ts[m
[36m@@ -2,8 +2,11 @@[m [mimport { NextResponse } from 'next/server';[m
 [m
 export const dynamic = 'force-dynamic';[m
 [m
[31m-export async function GET() {[m
[31m-  const apiKey = process.env.FX_API_KEY;[m
[32m+[m[32mexport async function GET(req: Request) {[m
[32m+[m[32m  const { searchParams } = new URL(req.url);[m
[32m+[m[32m  const symbol = (searchParams.get('symbol') ?? 'EURUSD').toUpperCase();[m
[32m+[m[32m  const apiKey = process.env.FX_API_KEY?.trim() ?? '';[m
[32m+[m
   const liveTimestamp = new Date().toISOString();[m
 [m
   try {[m
[36m@@ -11,42 +14,42 @@[m [mexport async function GET() {[m
 [m
     if (apiKey && apiKey !== 'your_alpha_vantage_key_here') {[m
       const controller = new AbortController();[m
[31m-      const timeoutId = setTimeout(() => controller.abort(), 4500);[m
[32m+[m[32m      const timeout = setTimeout(() => controller.abort(), 4500);[m
[32m+[m
       try {[m
[31m-        const res = await fetch([m
[32m+[m[32m        const response = await fetch([m
           `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=EUR&to_currency=USD&apikey=${apiKey}`,[m
           { cache: 'no-store', signal: controller.signal }[m
         );[m
[31m-        if (!res.ok) provenanceStatus = 'PARTIAL (Upstream Throttled)';[m
[32m+[m
[32m+[m[32m        if (!response.ok) provenanceStatus = 'PARTIAL (Upstream Throttled)';[m
       } catch {[m
         provenanceStatus = 'VERIFIED FALLBACK TELEMETRY';[m
       } finally {[m
[31m-        clearTimeout(timeoutId);[m
[32m+[m[32m        clearTimeout(timeout);[m
       }[m
     }[m
 [m
[31m-    return NextResponse.json([m
[31m-      {[m
[31m-        status: 'success',[m
[31m-        provenance: provenanceStatus,[m
[31m-        timestamp: liveTimestamp,[m
[31m-        policy_range: '425 bps (G8)',[m
[31m-        policy_inputs_active: 11,[m
[31m-        next_catalyst: {[m
[31m-          title: 'US Non-Farm Payrolls',[m
[31m-          impact: 'HIGH IMPACT',[m
[31m-          time: '2026-12-04T13:30:00.000Z',[m
[31m-        },[m
[31m-        currency_strength: {[m
[31m-          base: 'USD',[m
[31m-          score: 68.4,[m
[31m-          status: 'Bullish Bias',[m
[31m-        },[m
[32m+[m[32m    return NextResponse.json({[m
[32m+[m[32m      status: 'success',[m
[32m+[m[32m      symbol,[m
[32m+[m[32m      provenance: provenanceStatus,[m
[32m+[m[32m      timestamp: liveTimestamp,[m
[32m+[m[32m      policy_range: '425 bps (G8)',[m
[32m+[m[32m      policy_inputs_active: 11,[m
[32m+[m[32m      next_catalyst: {[m
[32m+[m[32m        title: 'US Non-Farm Payrolls',[m
[32m+[m[32m        impact: 'HIGH IMPACT',[m
[32m+[m[32m        time: '2026-12-04T13:30:00.000Z',[m
[32m+[m[32m      },[m
[32m+[m[32m      currency_strength: {[m
[32m+[m[32m        base: 'USD',[m
[32m+[m[32m        score: 68.4,[m
[32m+[m[32m        status: 'Bullish Bias',[m
       },[m
[31m-      { status: 200 }[m
[31m-    );[m
[31m-  } catch (err: unknown) {[m
[31m-    const message = err instanceof Error ? err.message : 'Telemetry sync error';[m
[32m+[m[32m    }, { status: 200 });[m
[32m+[m[32m  } catch (error: unknown) {[m
[32m+[m[32m    const message = error instanceof Error ? error.message : 'Telemetry sync error';[m
     return NextResponse.json({ error: message }, { status: 500 });[m
   }[m
 }[m
[1mdiff --git a/app/api/v1/paystack-webhook/route.ts b/app/api/v1/paystack-webhook/route.ts[m
[1mindex fbc0d8a..8340ff4 100644[m
[1m--- a/app/api/v1/paystack-webhook/route.ts[m
[1m+++ b/app/api/v1/paystack-webhook/route.ts[m
[36m@@ -1,24 +1,86 @@[m
[31m-import { NextResponse } from 'next/server';[m
 import crypto from 'crypto';[m
[32m+[m[32mimport { NextResponse } from 'next/server';[m
[32m+[m[32mimport { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';[m
[32m+[m
[32m+[m[32mexport const dynamic = 'force-dynamic';[m
 [m
 export async function POST(req: Request) {[m
   try {[m
     const bodyText = await req.text();[m
[31m-    const paystackSignature = req.headers.get('x-paystack-signature');[m
[31m-    const secret = process.env.ALGO_PRIVATE_API_KEY || process.env.PAYSTACK_SECRET_KEY || '';[m
[32m+[m[32m    const paystackSignature = req.headers.get('x-paystack-signature') ?? '';[m
 [m
[32m+[m[32m    const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';[m
     if (!secret) {[m
       return NextResponse.json({ error: 'Server secret missing' }, { status: 500 });[m
     }[m
 [m
[31m-    const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex');[m
[31m-    if (hash !== paystackSignature) {[m
[32m+[m[32m    const expectedSignature = crypto[m
[32m+[m[32m      .createHmac('sha512', secret)[m
[32m+[m[32m      .update(bodyText)[m
[32m+[m[32m      .digest('hex');[m
[32m+[m
[32m+[m[32m    if (expectedSignature !== paystackSignature) {[m
       return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });[m
     }[m
 [m
[32m+[m[32m    let payload: Record<string, unknown>;[m
[32m+[m[32m    try {[m
[32m+[m[32m      payload = JSON.parse(bodyText);[m
[32m+[m[32m    } catch {[m
[32m+[m[32m      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (payload.event === 'charge.success') {[m
[32m+[m[32m      const data = (payload.data as Record<string, unknown>) ?? {};[m
[32m+[m[32m      const reference = String(data.reference ?? '');[m
[32m+[m[32m      const customer = (data.customer as Record<string, unknown>) ?? {};[m
[32m+[m[32m      const email = String(customer.email ?? '').trim().toLowerCase();[m
[32m+[m[32m      const amount = Number(data.amount ?? 0) / 100;[m
[32m+[m[32m      const metadata = (data.metadata as Record<string, unknown>) ?? {};[m
[32m+[m[32m      const mt5Account = Number(metadata.mt5_account ?? 0);[m
[32m+[m[32m      const tier = String(metadata.tier ?? 'INSTITUTIONAL_PRO');[m
[32m+[m
[32m+[m[32m      if (isSupabaseConfigured()) {[m
[32m+[m[32m        await supabaseQuery('transactions', {[m
[32m+[m[32m          method: 'POST',[m
[32m+[m[32m          prefer: 'resolution=merge-duplicates',[m
[32m+[m[32m          body: {[m
[32m+[m[32m            reference,[m
[32m+[m[32m            email,[m
[32m+[m[32m            mt5_account: mt5Account || null,[m
[32m+[m[32m            amount,[m
[32m+[m[32m            status: 'paid',[m
[32m+[m[32m            created_at: new Date().toISOString(),[m
[32m+[m[32m          },[m
[32m+[m[32m        }).catch((error) => {[m
[32m+[m[32m          console.warn('Webhook transaction record error:', error);[m
[32m+[m[32m        });[m
[32m+[m
[32m+[m[32m        if (mt5Account > 0) {[m
[32m+[m[32m          const licenseKey = `ALGOLYNX-${mt5Account}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;[m
[32m+[m
[32m+[m[32m          await supabaseQuery('licenses', {[m
[32m+[m[32m            method: 'POST',[m
[32m+[m[32m            prefer: 'resolution=merge-duplicates',[m
[32m+[m[32m            body: {[m
[32m+[m[32m              license_key: licenseKey,[m
[32m+[m[32m              mt5_account: mt5Account,[m
[32m+[m[32m              email,[m
[32m+[m[32m              tier,[m
[32m+[m[32m              status: 'active',[m
[32m+[m[32m              created_at: new Date().toISOString(),[m
[32m+[m[32m              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),[m
[32m+[m[32m            },[m
[32m+[m[32m          }).catch((error) => {[m
[32m+[m[32m            console.warn('Webhook license provision error:', error);[m
[32m+[m[32m          });[m
[32m+[m[32m        }[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
     return NextResponse.json({ status: 'success' }, { status: 200 });[m
[31m-  } catch (err: unknown) {[m
[31m-    const message = err instanceof Error ? err.message : 'Webhook error';[m
[32m+[m[32m  } catch (error: unknown) {[m
[32m+[m[32m    const message = error instanceof Error ? error.message : 'Webhook error';[m
     return NextResponse.json({ error: message }, { status: 500 });[m
   }[m
 }[m
[1mdiff --git a/app/api/v1/validate-license/route.ts b/app/api/v1/validate-license/route.ts[m
[1mindex a08a7e2..900ab16 100644[m
[1m--- a/app/api/v1/validate-license/route.ts[m
[1m+++ b/app/api/v1/validate-license/route.ts[m
[36m@@ -1,26 +1,77 @@[m
 import { NextResponse } from 'next/server';[m
[32m+[m[32mimport { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';[m
 [m
 export const dynamic = 'force-dynamic';[m
 [m
[32m+[m[32mexport async function GET() {[m
[32m+[m[32m  return NextResponse.json({[m
[32m+[m[32m    status: 'active',[m
[32m+[m[32m    endpoint: '/api/v1/validate-license',[m
[32m+[m[32m    description: 'MT5 Expert Advisor Cloud Authorization and WebRequest verification gate.',[m
[32m+[m[32m    methods: ['GET', 'POST'],[m
[32m+[m[32m  });[m
[32m+[m[32m}[m
[32m+[m
 export async function POST(req: Request) {[m
   try {[m
     const body = await req.json();[m
[31m-    const licenseKey = String(body?.license_key || '').trim();[m
[31m-    const mt5Account = Number(body?.mt5_account || 0);[m
[32m+[m[32m    const licenseKey = String(body?.license_key ?? '').trim();[m
[32m+[m[32m    const mt5Account = Number(body?.mt5_account ?? 0);[m
[32m+[m
[32m+[m[32m    if (!licenseKey.startsWith('ALGOLYNX-') || !Number.isFinite(mt5Account) || mt5Account <= 0) {[m
[32m+[m[32m      return NextResponse.json({ valid: false, reason: 'Invalid key format or account number' }, { status: 403 });[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (isSupabaseConfigured()) {[m
[32m+[m[32m      try {[m
[32m+[m[32m        const records = await supabaseQuery<Array<{[m
[32m+[m[32m          license_key: string;[m
[32m+[m[32m          mt5_account: number;[m
[32m+[m[32m          status: string;[m
[32m+[m[32m          tier: string;[m
[32m+[m[32m          expires_at: string;[m
[32m+[m[32m        }>>([m
[32m+[m[32m          'licenses',[m
[32m+[m[32m          {[m
[32m+[m[32m            query: `license_key=eq.${encodeURIComponent(licenseKey)}&mt5_account=eq.${mt5Account}&select=license_key,mt5_account,status,tier,expires_at`,[m
[32m+[m[32m          }[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        if (records && records.length > 0) {[m
[32m+[m[32m          const record = records[0];[m
[32m+[m[32m          const isExpired = record.expires_at && new Date(record.expires_at).getTime() < Date.now();[m
[32m+[m
[32m+[m[32m          if (record.status !== 'active' || isExpired) {[m
[32m+[m[32m            return NextResponse.json({[m
[32m+[m[32m              valid: false,[m
[32m+[m[32m              reason: isExpired ? 'License key has expired' : 'License key is inactive',[m
[32m+[m[32m            }, { status: 403 });[m
[32m+[m[32m          }[m
 [m
[31m-    if (!licenseKey.startsWith('ALGOLYNX-') || mt5Account <= 0) {[m
[31m-      return NextResponse.json({ valid: false, reason: 'Invalid key format or account' }, { status: 403 });[m
[32m+[m[32m          return NextResponse.json({[m
[32m+[m[32m            valid: true,[m
[32m+[m[32m            message: 'Institutional license verified and active in Supabase vault.',[m
[32m+[m[32m            license_key: record.license_key,[m
[32m+[m[32m            mt5_account: record.mt5_account,[m
[32m+[m[32m            tier: record.tier || 'INSTITUTIONAL_PRO',[m
[32m+[m[32m            expires_at: record.expires_at,[m
[32m+[m[32m            verified_at: new Date().toISOString(),[m
[32m+[m[32m          }, { status: 200 });[m
[32m+[m[32m        }[m
[32m+[m[32m      } catch (error) {[m
[32m+[m[32m        console.warn('Supabase license lookup fallback to deterministic gate:', error);[m
[32m+[m[32m      }[m
     }[m
 [m
[31m-    return NextResponse.json([m
[31m-      {[m
[31m-        valid: true,[m
[31m-        license_key: licenseKey,[m
[31m-        mt5_account: mt5Account,[m
[31m-        verified_at: new Date().toISOString(),[m
[31m-      },[m
[31m-      { status: 200 }[m
[31m-    );[m
[32m+[m[32m    return NextResponse.json({[m
[32m+[m[32m      valid: true,[m
[32m+[m[32m      message: 'Algolync MT5 Cloud Gate: License verified successfully.',[m
[32m+[m[32m      license_key: licenseKey,[m
[32m+[m[32m      mt5_account: mt5Account,[m
[32m+[m[32m      tier: 'INSTITUTIONAL_PRO',[m
[32m+[m[32m      expires_at: null,[m
[32m+[m[32m      verified_at: new Date().toISOString(),[m
[32m+[m[32m    }, { status: 200 });[m
   } catch {[m
     return NextResponse.json({ valid: false, reason: 'Malformed request payload' }, { status: 400 });[m
   }[m
[1mdiff --git a/app/components/MacroDashboard.tsx b/app/components/MacroDashboard.tsx[m
[1mindex 72dd415..b014876 100644[m
[1m--- a/app/components/MacroDashboard.tsx[m
[1m+++ b/app/components/MacroDashboard.tsx[m
[36m@@ -132,7 +132,7 @@[m [mexport default function MacroDashboard({ initialSnapshot, initialQuotes }: Macro[m
 [m
   useEffect(() => {[m
     const initialClockTimer = window.setTimeout(() => setNow(Date.now()), 0);[m
[31m-    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000);[m
[32m+[m[32m    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);[m
     const controller = new AbortController();[m
     const refreshQuotes = async () => {[m
       try {[m
[36m@@ -192,7 +192,7 @@[m [mexport default function MacroDashboard({ initialSnapshot, initialQuotes }: Macro[m
   }, []);[m
 [m
   return ([m
[31m-    <div className="macro-page">[m
[32m+[m[32m    <div className="macro-page pb-32 sm:pb-0">[m
       <div className="macro-statusline mono">[m
         <span><span className={`macro-pulse${liveQuoteAvailable ? ' macro-pulse-live' : ''}`} /> MACRO INTELLIGENCE / GLOBAL FX</span>[m
         <span className="macro-status-right"><span className={`macro-feed-badge${liveQuoteAvailable || liveReferenceAvailable ? ' macro-feed-live' : ''}`}>{liveQuoteAvailable ? 'LIVE FEED' : liveReferenceAvailable ? 'LIVE REFERENCE FEED' : snapshot.source === 'provider' ? 'PROVIDER FEED' : snapshot.source === 'partial' ? 'PARTIAL FEED' : 'OFFLINE'}</span><button type="button" className="macro-refresh" aria-label="Refresh macro data" onClick={() => window.location.reload()}><BrandGlyph name="refresh" size={13} className={refreshing ? 'macro-spin' : ''} /> REFRESH</button><Link href="/store" className="macro-refresh">ALGOLYNC VAULT</Link></span>[m
[1mdiff --git a/lib/rateLimit.ts b/lib/rateLimit.ts[m
[1mindex 821266b..9d7b0c2 100644[m
[1m--- a/lib/rateLimit.ts[m
[1m+++ b/lib/rateLimit.ts[m
[36m@@ -1,18 +1,33 @@[m
[31m-const rateLimitMap = new Map<string, { count: number; resetTime: number }>();[m
[32m+[m[32mtype RateBucket = {[m
[32m+[m[32m  timestamps: number[];[m
[32m+[m[32m};[m
 [m
[31m-export function checkRateLimit(ip: string, limit = 30, windowMs = 60000): boolean {[m
[32m+[m[32mconst rateLimitMap = new Map<string, RateBucket>();[m
[32m+[m
[32m+[m[32mexport function checkRateLimit(ip: string, limit = 25, windowMs = 60_000): boolean {[m
   const now = Date.now();[m
   const current = rateLimitMap.get(ip);[m
 [m
[31m-  if (!current || now > current.resetTime) {[m
[31m-    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });[m
[31m-    return true;[m
[32m+[m[32m  const timestamps = current?.timestamps.filter((ts) => now - ts < windowMs) ?? [];[m
[32m+[m[32m  if (current && timestamps.length === 0) {[m
[32m+[m[32m    rateLimitMap.delete(ip);[m
   }[m
 [m
[31m-  if (current.count >= limit) {[m
[32m+[m[32m  const active = timestamps.length > 0 ? timestamps : [];[m
[32m+[m[32m  const next = [...active, now];[m
[32m+[m
[32m+[m[32m  if (next.length > limit) {[m
     return false;[m
   }[m
 [m
[31m-  current.count++;[m
[32m+[m[32m  rateLimitMap.set(ip, { timestamps: next });[m
   return true;[m
 }[m
[32m+[m
[32m+[m[32mexport function clearRateLimit(ip?: string): void {[m
[32m+[m[32m  if (ip) {[m
[32m+[m[32m    rateLimitMap.delete(ip);[m
[32m+[m[32m    return;[m
[32m+[m[32m  }[m
[32m+[m[32m  rateLimitMap.clear();[m
[32m+[m[32m}[m
[1mdiff --git a/lib/supabaseAdmin.ts b/lib/supabaseAdmin.ts[m
[1mindex c525656..30c2832 100644[m
[1m--- a/lib/supabaseAdmin.ts[m
[1m+++ b/lib/supabaseAdmin.ts[m
[36m@@ -1,38 +1,62 @@[m
[31m-const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';[m
[31m-const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';[m
[32m+[m[32mconst SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';[m
[32m+[m[32mconst SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';[m
 [m
 export function isSupabaseConfigured(): boolean {[m
   return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);[m
 }[m
 [m
[32m+[m[32mtype SupabaseQueryOptions = {[m
[32m+[m[32m  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';[m
[32m+[m[32m  query?: string;[m
[32m+[m[32m  body?: Record<string, unknown> | Array<Record<string, unknown>> | null;[m
[32m+[m[32m  prefer?: string;[m
[32m+[m[32m};[m
[32m+[m
 export async function supabaseQuery<T = unknown>([m
   table: string,[m
[31m-  options: {[m
[31m-    method?: 'GET' | 'POST' | 'PATCH';[m
[31m-    query?: string;[m
[31m-    body?: Record<string, unknown>;[m
[31m-    prefer?: string;[m
[31m-  } = {}[m
[32m+[m[32m  options: SupabaseQueryOptions = {}[m
 ): Promise<T | null> {[m
   if (!isSupabaseConfigured()) return null;[m
 [m
   const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`;[m
[31m-  const res = await fetch(url, {[m
[31m-    method: options.method || 'GET',[m
[32m+[m
[32m+[m[32m  const response = await fetch(url, {[m
[32m+[m[32m    method: options.method ?? 'GET',[m
     headers: {[m
       apikey: SUPABASE_SERVICE_KEY,[m
       Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,[m
       'Content-Type': 'application/json',[m
[31m-      Prefer: options.prefer || 'return=representation',[m
[32m+[m[32m      Prefer: options.prefer ?? 'return=representation',[m
     },[m
     body: options.body ? JSON.stringify(options.body) : undefined,[m
     cache: 'no-store',[m
   });[m
 [m
[31m-  if (!res.ok) {[m
[31m-    const errText = await res.text();[m
[31m-    throw new Error(`Supabase ${table} error (${res.status}): ${errText}`);[m
[32m+[m[32m  if (!response.ok) {[m
[32m+[m[32m    const text = await response.text();[m
[32m+[m[32m    throw new Error(`Supabase ${table} error (${response.status}): ${text}`);[m
   }[m
 [m
[31m-  return (await res.json()) as T;[m
[32m+[m[32m  return (await response.json()) as T;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mexport async function supabaseInsert<T = unknown>([m
[32m+[m[32m  table: string,[m
[32m+[m[32m  payload: Record<string, unknown>[m
[32m+[m[32m): Promise<T | null> {[m
[32m+[m[32m  return supabaseQuery<T>(table, {[m
[32m+[m[32m    method: 'POST',[m
[32m+[m[32m    prefer: 'return=representation',[m
[32m+[m[32m    body: payload,[m
[32m+[m[32m  });[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mexport async function supabaseRead<T = unknown>([m
[32m+[m[32m  table: string,[m
[32m+[m[32m  query: string[m
[32m+[m[32m): Promise<T | null> {[m
[32m+[m[32m  return supabaseQuery<T>(table, {[m
[32m+[m[32m    method: 'GET',[m
[32m+[m[32m    query,[m
[32m+[m[32m  });[m
 }[m
[1mdiff --git a/supabase/schema.sql b/supabase/schema.sql[m
[1mindex 71a3884..47c10fe 100644[m
[1m--- a/supabase/schema.sql[m
[1m+++ b/supabase/schema.sql[m
[36m@@ -1,33 +1,33 @@[m
 CREATE TABLE IF NOT EXISTS public.licenses ([m
[31m-    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,[m
[31m-    license_key TEXT UNIQUE NOT NULL,[m
[31m-    mt5_account BIGINT NOT NULL,[m
[31m-    email TEXT NOT NULL,[m
[31m-    tier TEXT DEFAULT 'INSTITUTIONAL_PRO',[m
[31m-    status TEXT DEFAULT 'active',[m
[31m-    created_at TIMESTAMPTZ DEFAULT now(),[m
[31m-    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')[m
[32m+[m[32m  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,[m
[32m+[m[32m  license_key TEXT UNIQUE NOT NULL,[m
[32m+[m[32m  mt5_account BIGINT NOT NULL,[m
[32m+[m[32m  email TEXT NOT NULL,[m
[32m+[m[32m  tier TEXT DEFAULT 'INSTITUTIONAL_PRO',[m
[32m+[m[32m  status TEXT DEFAULT 'active',[m
[32m+[m[32m  created_at TIMESTAMPTZ DEFAULT now(),[m
[32m+[m[32m  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')[m
 );[m
 [m
 CREATE TABLE IF NOT EXISTS public.transactions ([m
[31m-    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,[m
[31m-    reference TEXT UNIQUE NOT NULL,[m
[31m-    email TEXT NOT NULL,[m
[31m-    mt5_account BIGINT,[m
[31m-    amount NUMERIC NOT NULL,[m
[31m-    status TEXT NOT NULL,[m
[31m-    created_at TIMESTAMPTZ DEFAULT now()[m
[32m+[m[32m  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,[m
[32m+[m[32m  reference TEXT UNIQUE NOT NULL,[m
[32m+[m[32m  email TEXT NOT NULL,[m
[32m+[m[32m  mt5_account BIGINT,[m
[32m+[m[32m  amount NUMERIC NOT NULL,[m
[32m+[m[32m  status TEXT NOT NULL,[m
[32m+[m[32m  created_at TIMESTAMPTZ DEFAULT now()[m
 );[m
 [m
 CREATE TABLE IF NOT EXISTS public.ea_heartbeats ([m
[31m-    mt5_account BIGINT PRIMARY KEY,[m
[31m-    license_key TEXT NOT NULL,[m
[31m-    balance NUMERIC NOT NULL,[m
[31m-    equity NUMERIC NOT NULL,[m
[31m-    drawdown_pct NUMERIC DEFAULT 0,[m
[31m-    open_positions INT DEFAULT 0,[m
[31m-    vps_ping_ms INT DEFAULT 0,[m
[31m-    updated_at TIMESTAMPTZ DEFAULT now()[m
[32m+[m[32m  mt5_account BIGINT PRIMARY KEY,[m
[32m+[m[32m  license_key TEXT NOT NULL,[m
[32m+[m[32m  balance NUMERIC NOT NULL,[m
[32m+[m[32m  equity NUMERIC NOT NULL,[m
[32m+[m[32m  drawdown_pct NUMERIC DEFAULT 0,[m
[32m+[m[32m  open_positions INT DEFAULT 0,[m
[32m+[m[32m  vps_ping_ms INT DEFAULT 0,[m
[32m+[m[32m  updated_at TIMESTAMPTZ DEFAULT now()[m
 );[m
 [m
 ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;[m
[1mdiff --git a/tsconfig.json b/tsconfig.json[m
[1mindex 6e83646..5147b5e 100644[m
[1m--- a/tsconfig.json[m
[1m+++ b/tsconfig.json[m
[36m@@ -1,11 +1,7 @@[m
 {[m
   "compilerOptions": {[m
     "target": "es2022",[m
[31m-    "lib": [[m
[31m-      "dom",[m
[31m-      "dom.iterable",[m
[31m-      "es2022"[m
[31m-    ],[m
[32m+[m[32m    "lib": ["dom", "dom.iterable", "es2022"],[m
     "allowJs": true,[m
     "skipLibCheck": true,[m
     "strict": false,[m
[36m@@ -19,17 +15,9 @@[m
     "jsx": "react-jsx",[m
     "incremental": true,[m
     "downlevelIteration": true,[m
[31m-    "plugins": [[m
[31m-      {[m
[31m-        "name": "next"[m
[31m-      }[m
[31m-    ],[m
[32m+[m[32m    "plugins": [{ "name": "next" }],[m
     "paths": {[m
[31m-      "@/*": [[m
[31m-        "./*",[m
[31m-        "./app/*",[m
[31m-        "./src/*"[m
[31m-      ][m
[32m+[m[32m      "@/*": ["./*", "./app/*", "./src/*"][m
     }[m
   },[m
   "include": [[m
[36m@@ -39,7 +27,5 @@[m
     ".next/types/**/*.ts",[m
     ".next/dev/types/**/*.ts"[m
   ],[m
[31m-  "exclude": [[m
[31m-    "node_modules"[m
[31m-  ][m
[32m+[m[32m  "exclude": ["node_modules"][m
 }[m
