import { NextResponse } from 'next/server';
import { resolvePaystackBankAccount } from '@/lib/paystackBank';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountNumber = searchParams.get('accountNumber');
  const bankCode = searchParams.get('bankCode');

  if (!accountNumber || !bankCode) {
    return NextResponse.json({ error: 'Account number and bank code are required.' }, { status: 400 });
  }

  const resolution = await resolvePaystackBankAccount(accountNumber, bankCode);
  if (!resolution.ok) {
    return NextResponse.json({ error: resolution.message }, { status: resolution.status });
  }

  return NextResponse.json({ accountName: resolution.accountName, accountNumber: resolution.accountNumber });
}
