import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY || ''
    const bodyText = await req.text()
    
    // Validate Paystack HMAC Signature
    const signature = req.headers.get('x-paystack-signature')
    const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex')

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid Paystack Signature' }, { status: 401 })
    }

    const event = JSON.parse(bodyText)

    if (event.event === 'charge.success') {
      const metadata = event.data.metadata
      const dealId = metadata?.deal_id
      const reference = event.data.reference

      if (dealId) {
        const { error } = await supabaseAdmin
          .from('escrow_deals')
          .update({
            status: 'funded_in_escrow',
            paystack_reference: reference
          })
          .eq('id', dealId)

        if (error) {
          console.error('Database update error:', error)
          return NextResponse.json({ error: 'Failed to update deal status' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 })
  }
}
