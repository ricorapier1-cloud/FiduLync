import { NextResponse } from 'next/server';
import { resolvePaystackBankAccount } from '@/lib/paystackBank';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, message: 'A valid bank resolution request is required.' }, { status: 400 });
  }

  const { account_number, bank_code } = body as { account_number?: unknown; bank_code?: unknown };
  const resolution = await resolvePaystackBankAccount(
    typeof account_number === 'string' ? account_number : '',
    typeof bank_code === 'string' ? bank_code : '',
  );
  if (!resolution.ok) {
    return NextResponse.json({ success: false, message: resolution.message }, { status: resolution.status });
  }

  return NextResponse.json({
    success: true,
    account_name: resolution.accountName,
    account_number: resolution.accountNumber,
  });
}
