import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()
    const signature = req.headers.get('x-paystack-signature')
    const secret = process.env.PAYSTACK_SECRET_KEY

    // Verify webhook signature authenticity
    if (secret && signature) {
      const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex')
      if (hash !== signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(bodyText)

    // Handle successful charge event
    if (event.event === 'charge.success') {
      const { reference, customer, metadata } = event.data

      // Update order/escrow status in Supabase
      await supabase
        .from('orders')
        .insert([
          {
            reference,
            email: customer.email,
            product_slug: metadata?.product_slug || 'mql5-tool',
            mt5_account: metadata?.mt5_account || 'N/A',
            amount: event.data.amount / 100,
            status: 'completed',
          },
        ])

      console.log(`Payment confirmed for ${customer.email} [Ref: ${reference}]`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook Error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
