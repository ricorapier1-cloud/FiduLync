import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { linkId, event, trackingNumber, courier } = body

    if (!linkId || !event) {
      return NextResponse.json({ error: 'Missing linkId or event payload' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    // If a partnered logistics company (like Sendbox/Fez) flags a package as delivered:
    if (event === 'DELIVERY_DELIVERED' || event === 'package.delivered') {
      const { error } = await supabase
        .from('escrows')
        .update({ 
          status: 'delivered_pending_approval', 
          tracking_number: trackingNumber,
          courier_name: courier,
          auto_release_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48-Hour timer
        })
        .eq('link_id', linkId)

      if (error) throw error
    }

    return NextResponse.json({ success: true, message: 'Escrow timeline updated via Logistics Webhook' }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
