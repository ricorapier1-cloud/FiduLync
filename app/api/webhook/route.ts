import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    // 1. Webhook Signature Verification (Anti-Scammer Defense)
    const secretKey = process.env.PAYSTACK_SECRET_KEY || ''
    if (secretKey && signature) {
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(bodyText)
        .digest('hex')

      if (hash !== signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    }

    const event = JSON.parse(bodyText)

    // 2. Handle Successful Charge
    if (event.event === 'charge.success') {
      const transaction = event.data
      const reference = transaction.reference // Format: slug_randomnumber
      const slug = reference.split('_')[0] + '_' + reference.split('_')[1]

      // 3. Update Supabase Escrow Status Safely
      const { error } = await supabase
        .from('escrows')
        .update({ status: 'funded' })
        .eq('slug', slug)

      if (error) {
        console.error('Database update failed:', error.message)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
