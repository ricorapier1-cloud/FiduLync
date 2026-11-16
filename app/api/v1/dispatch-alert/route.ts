import { NextResponse } from 'next/server';
import { isAlgoApiConfigured, isAlgoAuthorized } from '@/lib/algoAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Fail closed: an absent secret must never turn this into a public alert relay.
  if (!isAlgoApiConfigured()) {
    return NextResponse.json({ ok: false, error: 'Alert dispatch authentication is not configured.' }, { status: 503 });
  }
  if (!isAlgoAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized alert dispatch' }, { status: 401 });
  }
  if (Number(req.headers.get('content-length') ?? 0) > 8_192) {
    return NextResponse.json({ ok: false, error: 'Alert payload is too large.' }, { status: 413 });
  }

  try {
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: 'Invalid alert payload.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const title = typeof input.title === 'string' ? input.title.trim() : 'MACROLYNC DESK ALERT';
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    const regime = typeof input.regime === 'string' ? input.regime.trim() : 'NEUTRAL';
    if (!message || message.length > 3_000 || title.length > 120 || regime.length > 80) {
      return NextResponse.json({ ok: false, error: 'Alert title, message or regime is invalid.' }, { status: 400 });
    }

    const formatted = `🛡️ *${title}*\\n*Regime:* ${regime}\\n${message}\\n_UTC: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}_`;
    const results: Record<string, string> = {};

    const tgToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const tgChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
    if (tgToken && tgChatId) {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text: formatted, parse_mode: 'Markdown' }),
        signal: AbortSignal.timeout(8_000),
      });
      results.telegram = tgRes.ok ? 'sent' : `error_${tgRes.status}`;
    } else {
      results.telegram = 'unconfigured';
    }

    const discordWebhook = (process.env.DISCORD_WEBHOOK_URL || '').trim();
    if (discordWebhook.startsWith('https://')) {
      const dcRes = await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: formatted.replace(/\\*/g, '**') }),
        signal: AbortSignal.timeout(8_000),
      });
      results.discord = dcRes.ok ? 'sent' : `error_${dcRes.status}`;
    } else {
      results.discord = 'unconfigured';
    }

    return NextResponse.json({ ok: true, channels: results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Alert dispatch failed or payload was malformed.' }, { status: 400 });
  }
}
