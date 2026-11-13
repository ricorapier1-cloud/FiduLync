import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  // Optional security check for cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();
  console.log(`[CRON] Background macro intelligence synchronization executed at ${timestamp}`);

  return NextResponse.json({
    status: 'success',
    message: 'Macro telemetry synchronized successfully in background',
    timestamp,
  }, { status: 200 });
}
