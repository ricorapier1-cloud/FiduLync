import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    // 1. Authenticate Developer API Key (Authorization Header)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 })
    }

    // 2. Parse Request Payload
    const body = await req.json()
    const { buyer_email, seller_email, amount, title, milestones } = body

    if (!buyer_email || !seller_email || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 3. Create Vault in Supabase (Service Role bypasses RLS)
    const { data: vault, error } = await supabase
      .from('escrow_vaults')
      .insert({ title, amount, status: 'CREATED' })
      .select()
      .single()

    if (error) throw error

    // 4. Generate Hosted Checkout URL (FiduLync Payment Page)
    const checkoutUrl = `https://fidulync.com/pay/${vault.id}`

    return NextResponse.json({
      status: 'success',
      vault_id: vault.id,
      checkout_url: checkoutUrl,
      message: 'Escrow vault generated successfully.'
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
