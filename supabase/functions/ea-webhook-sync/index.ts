import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { license_key, account_number, pair, lot_size, profit_loss, action } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: licenseData, error: licenseError } = await supabase
      .from('licenses')
      .select('id, user_id, active')
      .eq('license_key', license_key)
      .single();

    if (licenseError || !licenseData || !licenseData.active) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or revoked EA license key.' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { error: ledgerError } = await supabase
      .from('trade_history')
      .insert([{
        user_id: licenseData.user_id,
        seller_account: account_number,
        pair: pair,
        lot_size: lot_size,
        profit_loss: profit_loss,
        action: action,
        executed_at: new Date().toISOString()
      }]);

    if (ledgerError) throw ledgerError;

    return new Response(JSON.stringify({ success: true, message: 'Ledger successfully mutated.' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
