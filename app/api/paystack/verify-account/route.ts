import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNumber = searchParams.get('accountNumber');
    const bankCode = searchParams.get('bankCode');

    if (!accountNumber || !bankCode || accountNumber.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit account number and bank code required' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Paystack Secret Key is missing' }, { status: 500 });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    const data = await paystackRes.json();

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Account resolution failed' }, { status: 400 });
    }

    return NextResponse.json({
      accountName: data.data.account_name,
      accountNumber: data.data.account_number,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error resolving bank account' }, { status: 500 });
  }
}
