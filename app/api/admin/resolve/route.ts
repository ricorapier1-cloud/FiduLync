import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // In production, verify admin session here!
    const { link_id, action } = await request.json()
    
    if (!['refund_buyer', 'release_seller'].includes(action)) {
      return NextResponse.json({ error: 'Invalid resolution action' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    const newStatus = action === 'refund_buyer' ? 'refunded' : 'completed'

    const { error } = await supabase
      .from('escrows')
      .update({ status: newStatus })
      .eq('link_id', link_id)

    if (error) throw error

    // Note: If 'release_seller', you would trigger the Paystack Transfer API here 
    // exactly like we did in the /status route.
    // If 'refund_buyer', you would trigger the Paystack Refund API.

    return NextResponse.json({ success: true, newStatus }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Resolution failed' }, { status: 500 })
  }
}
