import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { reason } = await request.json()
    const { slug } = params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    // 1. Fetch the escrow details
    const { data: escrow, error: fetchError } = await supabase
      .from('escrows')
      .select('status')
      .eq('link_id', slug)
      .single()

    if (fetchError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // 2. Ensure funds are currently locked and not already paid out
    if (escrow.status !== 'funded') {
      return NextResponse.json({ error: 'Only funded escrows can be disputed' }, { status: 400 })
    }

    // 3. Mark as Disputed in Supabase and log the reason
    const { error: updateError } = await supabase
      .from('escrows')
      .update({ 
        status: 'disputed',
        dispute_reason: reason || 'Buyer initiated dispute without explicit reason.'
      })
      .eq('link_id', slug)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, message: 'Transaction frozen and marked as disputed' }, { status: 200 })
  } catch (err: any) {
    console.error('Dispute Error:', err.message)
    return NextResponse.json({ error: 'Failed to process dispute', details: err.message }, { status: 500 })
  }
}
