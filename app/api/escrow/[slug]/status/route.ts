import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { status } = await request.json()
    const { slug } = params // This is the link_id
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || ''

    if (status !== 'completed') {
      return NextResponse.json({ error: 'Invalid status update' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    // 1. Fetch the escrow details
    const { data: escrow, error: fetchError } = await supabase
      .from('escrows')
      .select('*')
      .eq('link_id', slug)
      .single()

    if (fetchError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    if (escrow.status !== 'funded') {
      return NextResponse.json({ error: 'Only funded escrows can be completed' }, { status: 400 })
    }

    // 2. Calculate Payout (98% to seller, 2% platform fee)
    const totalAmount = Number(escrow.amount)
    const payoutAmountKobo = Math.floor(totalAmount * 0.98 * 100) // Paystack expects Kobo

    // 3. Create Paystack Transfer Recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'nuban',
        name: escrow.seller_account_name || 'FiduLync Seller',
        account_number: escrow.seller_account_number,
        bank_code: escrow.seller_bank_code,
        currency: 'NGN'
      })
    })
    
    const recipientData = await recipientRes.json()
    if (!recipientData.status) throw new Error('Failed to create transfer recipient')
    
    const recipientCode = recipientData.data.recipient_code

    // 4. Initiate the Transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        amount: payoutAmountKobo,
        recipient: recipientCode,
        reason: `FiduLync Payout for ID: ${slug}`
      })
    })

    const transferData = await transferRes.json()
    if (!transferData.status) throw new Error(transferData.message || 'Transfer failed')

    // 5. Mark as Completed in Supabase
    const { error: updateError } = await supabase
      .from('escrows')
      .update({ status: 'completed' })
      .eq('link_id', slug)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, message: 'Payout processed successfully' }, { status: 200 })
  } catch (err: any) {
    console.error('Payout Error:', err.message)
    return NextResponse.json({ error: 'Failed to process payout', details: err.message }, { status: 500 })
  }
}
