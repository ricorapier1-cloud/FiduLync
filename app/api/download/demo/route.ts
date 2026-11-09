import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestedName = new URL(request.url).searchParams.get('file') || 'AlgoLync';
  const product = requestedName.replace(/[\r\n]/g, '').slice(0, 100);
  const fileStem = product.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'AlgoLync';
  const documentation = [
    `${product} — AlgoLync sample documentation demo`,
    '',
    'This is a documentation sample, not a compiled MetaTrader .ex5 binary.',
    'No executable demo has been uploaded for this listing yet.',
    '',
    'To test a strategy:',
    '1. Request a verified demo build from the listing owner.',
    '2. Test in MetaTrader 5 Strategy Tester on historical data.',
    '3. Verify account and drawdown limits before using a live account.',
    '',
    'Risk notice: trading leveraged products can result in losses exceeding deposits.',
    'Illustrative or simulated performance is not a guarantee of future results.',
  ].join('\n');

  return new NextResponse(documentation, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileStem}_Demo_README.txt"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
