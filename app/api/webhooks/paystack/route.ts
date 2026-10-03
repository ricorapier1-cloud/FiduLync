import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const textBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    // 1. Verify Paystack Signature
    const secret = process.env.PAYSTACK_SECRET_KEY || ''
    const expectedSignature = crypto.createHmac('sha512', secret).update(textBody).digest('hex')
    
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(textBody)

    // 2. Process Successful Charge
    if (event.event === 'charge.success') {
      const linkId = event.data.metadata.custom_fields.find((f: any) => f.variable_name === 'link_id')?.value

      if (linkId) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

        // Update Escrow state from pending -> funded
        const { error } = await supabase
          .from('escrows')
          .update({ status: 'funded' })
          .eq('link_id', linkId)

        if (error) throw error
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
