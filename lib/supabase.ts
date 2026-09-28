import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Transaction = {
  id: string
  seller_id?: string
  buyer_phone: string
  buyer_email?: string
  item_name: string
  item_description: string
  item_amount_kobo: number
  platform_fee_kobo: number
  total_payable_kobo: number
  payment_link_slug: string
  status: 'pending_payment' | 'funds_in_escrow' | 'item_dispatched' | 'funds_released' | 'disputed'
  payment_reference?: string
  fee_bearer: 'buyer' | 'seller' | 'split'
  courier_partner?: string
  tracking_number?: string
  pre_dispatch_media_url?: string
  created_at: string
  inspection_expires_at?: string
}
