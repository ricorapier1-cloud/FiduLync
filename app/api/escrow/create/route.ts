import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, amount, sellerPhone, buyerPhone, payoutBank, payoutAccount } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase environment variables missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    const linkId = Math.random().toString(36).substring(2, 10)

    const payload = {
      title: title || 'Safe Link Escrow',
      amount: Number(amount),
      seller_phone: sellerPhone,
      buyer_phone: buyerPhone,
      payout_bank: payoutBank,
      payout_account: payoutAccount,
      status: 'pending',
      link_id: linkId
    }

    const { data, error } = await supabase
      .from('escrows')
      .insert([payload])
      .select()

    if (error) {
      console.error('Database Insert Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data[0], linkId }, { status: 200 })
  } catch (err: any) {
    console.error('Server Handler Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
