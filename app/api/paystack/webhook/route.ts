import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature')
    const secret = process.env.PAYSTACK_SECRET_KEY

    if (!signature || !secret) {
      return NextResponse.json({ error: 'Unauthorized payload' }, { status: 401 })
    }

    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)

    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data

      // Verify event hasn't been processed (Replay Protection)
      // Check database for existing reference lock here...

      console.log(`Verified payment for reference: ${reference}, Amount: ${amount}`)

      // Update escrow state or deliver EA license server-side
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
