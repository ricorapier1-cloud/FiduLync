import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-paystack-signature')
    
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)

    if (event.event === 'charge.success') {
      const { reference, customer } = event.data

      const { error } = await supabase
        .from('escrow_transactions')
        .update({ 
          status: 'vaulted',
          buyer_email: customer.email,
          paystack_reference: reference,
          updated_at: new Date().toISOString()
        })
        .eq('paystack_reference', reference)

      if (error) console.error('Error updating escrow status:', error)
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
