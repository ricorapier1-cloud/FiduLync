import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { license_key, mt_account_number, pair, lot_size, profit_loss, action } = payload;

    if (!license_key || !mt_account_number || !pair || lot_size === undefined || profit_loss === undefined || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Malformed payload parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify EA License & Assigned MT Account Number
    const { data: licenseData, error: licenseErr } = await supabase
      .from("ea_licenses")
      .select("user_id, is_active")
      .eq("license_key", license_key)
      .eq("mt_account_number", String(mt_account_number))
      .single();

    if (licenseErr || !licenseData || !licenseData.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized EA license key or account binding" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Append to Trade History Ledger
    const { data: tradeRecord, error: insertErr } = await supabase
      .from("trade_history")
      .insert({
        user_id: licenseData.user_id,
        license_key,
        mt_account_number: String(mt_account_number),
        pair,
        lot_size: Number(lot_size),
        profit_loss: Number(profit_loss),
        action,
      })
      .select("id")
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to persist ledger entry" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, transaction_id: tradeRecord.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
