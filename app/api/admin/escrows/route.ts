import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // In production, add authentication checks here!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

    const { data: escrows, error } = await supabase
      .from('escrows')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ escrows }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch escrows' }, { status: 500 })
  }
}
