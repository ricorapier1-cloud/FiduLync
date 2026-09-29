import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-paystack-signature')
    const secret = process.env.PAYSTACK_SECRET_KEY

    // Validate Paystack signature if secret key is present
    if (secret && signature) {
      const hash = crypto.createHmac('sha256', secret).update(body).digest('hex')
      if (hash !== signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)

    if (event.event === 'charge.success') {
      const reference = event.data.reference
      const slug = reference.split('_')[0]

      await supabase
        .from('escrows')
        .update({
          status: 'funded',
          paystack_reference: reference,
        })
        .eq('slug', slug)
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
