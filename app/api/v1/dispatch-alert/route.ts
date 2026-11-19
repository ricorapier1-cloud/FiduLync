import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function hasValidSecret(request: Request, secret: string) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  const supplied = match?.[1] ?? '';
  if (!supplied) return false;
  const suppliedBytes = Buffer.from(supplied, 'utf8');
  const secretBytes = Buffer.from(secret, 'utf8');
  if (suppliedBytes.length !== secretBytes.length) return false;
  return timingSafeEqual(suppliedBytes, secretBytes);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const secret = process.env.ALGO_PRIVATE_API_KEY?.trim() ?? '';
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Private alert dispatch is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!hasValidSecret(req, secret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized alert dispatch' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 4_096) {
    return NextResponse.json({ ok: false, error: 'Alert payload is too large.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const body: unknown = JSON.parse(rawBody);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: 'Malformed alert payload' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const record = body as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim().slice(0, 100) : 'MACROLYNC PERSONAL ALERT';
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    const regime = typeof record.regime === 'string' ? record.regime.trim().slice(0, 50) : 'UNCLASSIFIED';
    if (!message || message.length > 2_500) {
      return NextResponse.json({ ok: false, error: 'Alert message must contain 1–2500 characters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const formatted = `🛡️ *${title}*\n*Regime:* ${regime}\n${message}\n_UTC: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}_`;
    const results: Record<string, string> = {};
    const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
    const tgChatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? '';
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL?.trim() ?? '';

    if (!tgToken || !tgChatId) {
      results.telegram = 'unconfigured';
    } else {
      const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text: formatted, parse_mode: 'Markdown' }),
        signal: AbortSignal.timeout(5_000),
      });
      results.telegram = response.ok ? 'sent' : `error_${response.status}`;
    }

    if (!discordWebhook.startsWith('https://')) {
      results.discord = 'unconfigured';
    } else {
      const response = await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: formatted.replace(/\*/g, '**') }),
        signal: AbortSignal.timeout(5_000),
      });
      results.discord = response.ok ? 'sent' : `error_${response.status}`;
    }

    return NextResponse.json({ ok: true, channels: results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Alert dispatch failed or payload was malformed.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
