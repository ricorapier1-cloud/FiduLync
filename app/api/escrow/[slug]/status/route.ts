import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const { status } = await request.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    const { error } = await supabase
      .from('escrows')
      .update({ status: status || 'completed' })
      .or(`slug.eq.${params.slug},link_id.eq.${params.slug}`)

    if (error) throw error
    return NextResponse.json({ success: true, status }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
