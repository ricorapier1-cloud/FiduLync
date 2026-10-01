import { NextResponse } from 'next/server'
import { sendTelegramAlert } from '@/lib/telegram'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, mt5Account, amountUSD, productSlug } = body

    if (!email || !mt5Account || !amountUSD) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json({ error: 'Paystack secret key is missing' }, { status: 500 })
    }

    // Convert USD to Paystack Kobo/Cents equivalent or NGN base
    const amountInMinorUnit = Math.round(parseFloat(amountUSD) * 100)

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInMinorUnit,
        currency: 'USD',
        callback_url: 'https://fidulync.vercel.app/store?status=success',
        metadata: {
          product_slug: productSlug,
          mt5_account: mt5Account,
          source: 'AlgoLync Store',
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      return NextResponse.json({ error: paystackData.message || 'Payment initialization failed' }, { status: 400 })
    }

    // Send instant Telegram notification about checkout initiation
    await sendTelegramAlert(
      `🛒 <b>AlgoLync Checkout Started</b>\n\n<b>Product:</b> ${productSlug}\n<b>Price:</b> $${amountUSD} USD\n<b>Buyer Email:</b> ${email}\n<b>MT5 Account:</b> ${mt5Account}`
    )

    return NextResponse.json({ authorization_url: paystackData.data.authorization_url })
  } catch (err) {
    console.error('Checkout API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
