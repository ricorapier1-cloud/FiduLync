import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      buyerPhone,
      sellerPhone,
      sellerBankName,
      sellerAccountNumber,
      itemName,
      itemDescription,
      currency = 'NGN',
      price,
    } = body

    if (!itemName || !price || !sellerAccountNumber || !sellerBankName) {
      return NextResponse.json(
        { error: 'Missing required escrow parameters (item name, price, bank details)' },
        { status: 400 }
      )
    }

    const numericPrice = parseFloat(price)
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: 'Invalid price amount' }, { status: 400 })
    }

    // 1. Calculate 2% platform commission and net seller payout
    const platformFeeRate = 0.02
    const platformFee = Math.round(numericPrice * platformFeeRate * 100) / 100
    const netSellerPayout = Math.round((numericPrice - platformFee) * 100) / 100

    // 2. Generate a unique 8-character slug for the Safe Link
    const slug = Math.random().toString(36).substring(2, 10)

    // 3. Save escrow transaction record into Supabase
    const { data, error } = await supabase
      .from('escrows')
      .insert([
        {
          slug,
          buyer_phone: buyerPhone?.trim() || null,
          seller_phone: sellerPhone?.trim() || null,
          seller_bank_name: sellerBankName.trim(),
          seller_account_number: sellerAccountNumber.trim(),
          item_name: itemName.trim(),
          item_description: itemDescription?.trim() || '',
          currency: currency.toUpperCase(),
          total_amount: numericPrice,
          platform_fee: platformFee,
          net_payout: netSellerPayout,
          status: 'pending', // States: pending -> funded -> released -> transferred
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase escrow insert error:', error)
      return NextResponse.json({ error: 'Failed to create escrow link in database' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      slug: data.slug,
      totalAmount: data.total_amount,
      netPayout: data.net_payout,
      platformFee: data.platform_fee,
    })
  } catch (err) {
    console.error('Escrow creation API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
