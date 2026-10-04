import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { accountNumber, bankCode } = await req.json()

    if (!accountNumber || !bankCode) {
      return NextResponse.json({ error: 'Account number and bank code required' }, { status: 400 })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Paystack Secret Key not configured on server' }, { status: 500 })
    }

    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = await res.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Account resolution failed' }, { status: 400 })
    }

    return NextResponse.json({ account_name: data.data.account_name })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
