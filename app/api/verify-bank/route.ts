export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { resolvePaystackBankAccount } from '@/lib/paystackBank';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, message: 'A valid bank verification request is required.' }, { status: 400 });
  }

  const { accountNumber, bankCode } = body as { accountNumber?: unknown; bankCode?: unknown };
  if (
    typeof accountNumber !== 'string' ||
    !/^\d{10}$/.test(accountNumber) ||
    typeof bankCode !== 'string' ||
    !/^[a-zA-Z0-9]{2,10}$/.test(bankCode)
  ) {
    return NextResponse.json({ success: false, message: 'Provide a valid 10-digit account number and bank code.' }, { status: 400 });
  }

  const resolution = await resolvePaystackBankAccount(accountNumber, bankCode);
  if (!resolution.ok) {
    return NextResponse.json({ success: false, message: resolution.message }, { status: resolution.status });
  }

  return NextResponse.json({
    success: true,
    accountName: resolution.accountName,
    accountNumber: resolution.accountNumber,
  });
}
