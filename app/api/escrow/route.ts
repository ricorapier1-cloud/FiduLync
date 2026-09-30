import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { sellerName, sellerPhone, buyerPhone, itemName, itemDescription, currency, amount } = body

    if (!sellerName || !sellerPhone || !itemName || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const baseAmount = parseFloat(amount)
    const platformFee = Math.round(baseAmount * 0.02 * 100) / 100 // 2% Fee rounded
    const totalAmount = baseAmount + platformFee

    // Unique escrow slug generator
    const slug = `fl_${Math.random().toString(36).substring(2, 9)}`

    const { data, error } = await supabase
      .from('escrows')
      .insert([
        {
          slug,
          seller_name: sellerName,
          seller_phone: sellerPhone,
          buyer_phone: buyerPhone || null,
          item_name: itemName,
          item_description: itemDescription || '',
          currency: currency || 'NGN',
          amount: baseAmount,
          fee_amount: platformFee,
          total_amount: totalAmount,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase Error:', error)
      return NextResponse.json({ error: 'Failed to save escrow link' }, { status: 500 })
    }

    return NextResponse.json({ slug: data.slug, totalAmount, platformFee })
  } catch (err) {
    console.error('API Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
