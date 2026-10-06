import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { link } = await request.json()
    if (!link) return NextResponse.json({ error: 'Please provide a valid FiduLync link or Link ID' }, { status: 400 })

    // Extract link_id or slug from URL string if full URL was pasted
    const cleanId = link.split('/pay/').pop()?.split('?')[0]?.trim() || link.trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    const { data: escrow, error } = await supabase
      .from('escrows')
      .select('*')
      .or(`slug.eq.${cleanId},link_id.eq.${cleanId}`)
      .single()

    if (error || !escrow) {
      return NextResponse.json({ 
        verified: false, 
        message: 'Unverified or Fake Link! This escrow link was not generated on FiduLync servers.' 
      }, { status: 200 })
    }

    return NextResponse.json({
      verified: true,
      message: 'Authentic FiduLync Escrow Link Verified.',
      escrow: {
        id: escrow.link_id,
        title: escrow.title,
        amount: escrow.amount,
        sellerPhone: escrow.seller_phone ? `${escrow.seller_phone.slice(0, 4)}***${escrow.seller_phone.slice(-3)}` : 'Verified Seller',
        status: escrow.status,
        createdAt: escrow.created_at
      }
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error during verification' }, { status: 500 })
  }
}
