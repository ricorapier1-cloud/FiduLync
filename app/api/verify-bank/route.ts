import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { accountNumber, bankCode } = await req.json();

    if (!accountNumber || !bankCode) {
      return NextResponse.json({ success: false, message: 'Account number and bank code are required' }, { status: 400 });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.status && data.data) {
      return NextResponse.json({
        success: true,
        accountName: data.data.account_name,
        accountNumber: data.data.account_number,
      });
    }

    return NextResponse.json({ success: false, message: data.message || 'Could not verify account details' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Bank verification service unavailable' }, { status: 500 });
  }
}
