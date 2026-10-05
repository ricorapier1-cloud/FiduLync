import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Jaro-Winkler Algorithmic Name Similarity Metric
function jaroWinklerDistance(s1: string, s2: string): number {
  let m = 0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1.length === 0 || str2.length === 0) return 0;
  if (str1 === str2) return 1;

  const range = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const match1 = new Array(str1.length).fill(false);
  const match2 = new Array(str2.length).fill(false);

  for (let i = 0; i < str1.length; i++) {
    const low = i >= range ? i - range : 0;
    const high = i + range <= str2.length - 1 ? i + range : str2.length - 1;
    for (let j = low; j <= high; j++) {
      if (!match2[j] && str1[i] === str2[j]) {
        match1[i] = true;
        match2[j] = true;
        m++;
        break;
      }
    }
  }

  if (m === 0) return 0;

  let t = 0;
  let point = 0;
  for (let i = 0; i < str1.length; i++) {
    if (match1[i]) {
      while (!match2[point]) point++;
      if (str1[i] !== str2[point]) t++;
      point++;
    }
  }
  t /= 2;

  const jaro = (m / str1.length + m / str2.length + (m - t) / m) / 3;
  let p = 0.1;
  let l = 0;
  while (str1[l] === str2[l] && l < 4) l++;

  return jaro + l * p * (1 - jaro);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { account_number, bank_code, target_name } = await req.json();

    if (!account_number || !bank_code) {
      return new Response(
        JSON.stringify({ success: false, error: "Account number and bank code required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const paystackRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`,
      {
        headers: { Authorization: `Bearer ${paystackSecret}` },
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return new Response(
        JSON.stringify({ success: false, error: paystackData.message || "Account resolution failed" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedName = paystackData.data.account_name;
    let matchScore = 1.0;
    let isMatched = true;

    if (target_name) {
      matchScore = jaroWinklerDistance(resolvedName, target_name);
      isMatched = matchScore >= 0.75; // 75% similarity threshold
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_name: resolvedName,
        account_number: paystackData.data.account_number,
        match_score: matchScore,
        is_verified_match: isMatched,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
