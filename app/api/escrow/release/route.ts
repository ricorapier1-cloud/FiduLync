import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { vault_id, buyer_id } = await req.json()

    // 1. Verify Vault State
    const { data: vault, error: vaultErr } = await supabase
      .from('escrow_vaults')
      .select('*, seller:profiles!seller_id(kyc_status, local_bank_code, local_account_number)')
      .eq('id', vault_id)
      .single()

    if (vaultErr || vault.status !== 'INSPECTION') {
      return NextResponse.json({ error: 'Vault not ready for release' }, { status: 400 })
    }

    // 2. Enforce KYC Check
    if (vault.seller.kyc_status !== 'VERIFIED') {
      return NextResponse.json({ error: 'Seller KYC incomplete. Funds held.' }, { status: 403 })
    }

    // 3. Calculate Platform Fee (FiduLync takes 3%)
    const platformFee = vault.amount * 0.03
    const payoutAmount = vault.amount - platformFee
    const amountInKobo = Math.floor(payoutAmount * 100)

    // 4. Create Paystack Transfer Recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'nuban',
        name: 'Seller Payout',
        account_number: vault.seller.local_account_number,
        bank_code: vault.seller.local_bank_code,
        currency: 'NGN'
      })
    })
    const recipientData = await recipientRes.json()

    // 5. Initiate Transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountInKobo,
        recipient: recipientData.data.recipient_code,
        reason: `FiduLync Payout: ${vault.title}`
      })
    })
    const transferData = await transferRes.json()

    if (!transferData.status) throw new Error('Transfer failed')

    // 6. Update Database State
    await supabase.from('escrow_vaults').update({ status: 'RELEASED' }).eq('id', vault_id)
    await supabase.from('vault_events').insert({
      vault_id,
      event_type: 'FUNDS_RELEASED',
      actor_id: buyer_id,
      metadata: { transfer_code: transferData.data.transfer_code }
    })

    return NextResponse.json({ status: 'success', message: 'Payout initiated successfully' })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
