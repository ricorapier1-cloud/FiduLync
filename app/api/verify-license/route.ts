import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account')
    const product = searchParams.get('product')

    if (!account) {
      return NextResponse.json({ status: 'DENIED', reason: 'Missing MT5 account number' }, { status: 400 })
    }

    // Query Supabase for completed orders matching account number
    let query = supabase
      .from('orders')
      .select('id, email, mt5_account, product_slug, status')
      .eq('mt5_account', account.trim())
      .eq('status', 'completed')

    if (product) {
      query = query.eq('product_slug', product.trim())
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        status: 'DENIED',
        authorized: false,
        reason: 'No active license found for this MT5 account',
      })
    }

    return NextResponse.json({
      status: 'AUTHORIZED',
      authorized: true,
      account: account,
      product: data[0].product_slug,
    })
  } catch (err) {
    console.error('License verification error:', err)
    return NextResponse.json({ status: 'ERROR', reason: 'Internal server error' }, { status: 500 })
  }
}
