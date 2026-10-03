import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { account_number, bank_code } = await request.json()
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || ''

    const res = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` }
    })
    
    const data = await res.json()
    
    if (data.status) {
      return NextResponse.json({ success: true, account_name: data.data.account_name }, { status: 200 })
    } else {
      return NextResponse.json({ error: 'Bank account verification failed.' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Verification service offline.' }, { status: 500 })
  }
}
