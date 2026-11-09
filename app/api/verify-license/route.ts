import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      return NextResponse.json({ status: 'ERROR', reason: 'License verification is not configured.' }, { status: 503 })
    }

    const supabase = createClient(url, key)
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
