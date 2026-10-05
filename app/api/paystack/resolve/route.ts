import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { account_number, bank_code } = await req.json();
    const secret = process.env.PAYSTACK_SECRET_KEY;

    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` }
    });

    const data = await response.json();
    
    if (data.status) {
      return NextResponse.json({ success: true, account_name: data.data.account_name });
    }
    return NextResponse.json({ success: false, message: 'Account not found' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
