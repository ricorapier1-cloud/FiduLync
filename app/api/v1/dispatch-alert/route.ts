import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip, 20, 60000)) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const adminSecret = (process.env.ALGO_PRIVATE_API_KEY || process.env.CRON_SECRET || '').trim();
  if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized alert dispatch' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = String(body?.title || 'MACROLYNC DESK ALERT').trim();
    const message = String(body?.message || '').trim();
    const regime = String(body?.regime || 'NEUTRAL').trim();

    if (!message) {
      return NextResponse.json({ ok: false, error: 'Alert message is required' }, { status: 400 });
    }

    const formatted = `🛡️ *${title}*\n*Regime:* ${regime}\n${message}\n_UTC: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}_`;
    const results: Record<string, string> = {};

    const tgToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const tgChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
    if (tgToken && tgChatId) {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text: formatted, parse_mode: 'Markdown' }),
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
        body: JSON.stringify({ content: formatted.replace(/\*/g, '**') }),
      });
      results.discord = dcRes.ok ? 'sent' : `error_${dcRes.status}`;
    } else {
      results.discord = 'unconfigured';
    }

    return NextResponse.json({ ok: true, channels: results });
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed alert payload' }, { status: 400 });
  }
}
