import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, amount, currency, link_id } = await req.json()
    const origin = req.headers.get('origin') || 'https://fidulync.vercel.app'
    
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ authorization_url: `/pay/${link_id}?success=true` })
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email || 'buyer@fidulync.com',
        amount: Math.round(Number(amount) * 100),
        currency,
        callback_url: `${origin}/pay/${link_id}?success=true`,
        metadata: { link_id }
      })
    })

    const data = await res.json()
    if (data.status) {
      return NextResponse.json({ authorization_url: data.data.authorization_url })
    }
    throw new Error(data.message)
  } catch (err) {
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 })
  }
}
