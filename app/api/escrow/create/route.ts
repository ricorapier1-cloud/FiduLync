import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    let body = {}
    try { body = await request.json() } catch (e) { body = {} }

    // FORCE-CLEAN AMOUNT: Strips out '₦', ',', spaces, and text. Extracts only pure numbers.
    const rawAmountStr = String(body.amount ?? body.price ?? body.itemPrice ?? body.totalAmount ?? '0')
    const cleanAmount = parseFloat(rawAmountStr.replace(/[^0-9.]/g, '')) || 0

    // FALLBACKS: Guarantees no database field is ever sent as 'undefined'
    const payload = {
      title: body.title || body.itemName || body.item || 'Safe Link Escrow',
      description: body.description || body.itemDescription || '',
      amount: cleanAmount,
      seller_phone: body.sellerPhone || body.seller_phone || body.phone || '0000000000',
      buyer_phone: body.buyerPhone || body.buyer_phone || '',
      payout_bank: body.payoutBank || body.payout_bank || body.bank || '',
      payout_account: body.payoutAccount || body.payout_account || body.account || '',
      status: 'pending',
      link_id: Math.random().toString(36).substring(2, 10)
    }
    
    // Duplicate link_id into slug to satisfy any remaining DB constraints
    const finalPayload = { ...payload, slug: payload.link_id }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'System config missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    const { data, error } = await supabase.from('escrows').insert([finalPayload]).select()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data: data[0], 
      linkId: payload.link_id, 
      slug: payload.link_id, 
      url: `/pay/${payload.link_id}` 
    }, { status: 200 })

  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error)
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 })
  }
}
