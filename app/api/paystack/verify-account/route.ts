import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountNumber = searchParams.get('accountNumber')
  const bankCode = searchParams.get('bankCode')

  if (!accountNumber || !bankCode) {
    return NextResponse.json({ error: 'Account number and bank code required' }, { status: 400 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is missing in environment variables.")
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        // Cache control to prevent outdated bank resolutions
        cache: 'no-store' 
      }
    )

    const data = await paystackRes.json()

    if (data.status) {
      return NextResponse.json({ accountName: data.data.account_name })
    } else {
      return NextResponse.json({ error: data.message || 'Account not found. Check details.' }, { status: 404 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to connect to verification server' }, { status: 500 })
  }
}
