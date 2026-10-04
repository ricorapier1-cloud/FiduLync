import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { dealId, email, amountNGN } = await req.json()

    if (!dealId || !amountNGN) {
      return NextResponse.json({ error: 'Missing deal information' }, { status: 400 })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Paystack Secret Key missing' }, { status: 500 })
    }

    // Paystack takes amount in kobo (multiply NGN by 100)
    const amountInKobo = Math.round(Number(amountNGN) * 100)

    const origin = req.headers.get('origin') || 'https://fidulync.com'

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email || 'buyer@fidulync.com',
        amount: amountInKobo,
        callback_url: `${origin}/pay/${dealId}`,
        metadata: {
          deal_id: dealId
        }
      })
    })

    const data = await res.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 400 })
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
