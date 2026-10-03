import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const link_id = `fdl_${Date.now().toString(36)}`
    
    // Attempt database insertion if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      await supabase.from('deals').insert([{
        link_id,
        title: body.title,
        amount: body.amount,
        currency: body.currency,
        buyer_phone: body.buyer_phone,
        seller_phone: body.seller_phone,
        seller_bank_code: body.seller_bank_code,
        seller_account: body.seller_account,
        seller_account_name: body.seller_account_name,
        status: 'pending'
      }])
    }

    return NextResponse.json({ success: true, link_id })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
