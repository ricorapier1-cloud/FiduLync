import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Jaro-Winkler String Similarity Algorithm implementation
function jaroWinklerDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;
  
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (matches2[j] || s1[i] !== s2[j]) continue;
      matches1[i] = true;
      matches2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = ((matches / len1) + (matches / len2) + ((matches - transpositions / 2) / matches)) / 3.0;
  
  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }
  
  return jaro + prefixLength * 0.1 * (1.0 - jaro);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { account_number, bank_code, expected_name } = await req.json();
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    
    if (!secretKey) throw new Error('System configuration error: Gateway key missing.');

    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    
    const data = await response.json();
    
    if (!data.status) {
      return new Response(JSON.stringify({ error: data.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resolvedName = data.data.account_name;
    const similarityScore = jaroWinklerDistance(expected_name.toLowerCase(), resolvedName.toLowerCase());

    if (similarityScore < 0.82) {
      return new Response(JSON.stringify({ 
        error: 'Identity mismatch. Fraud prevention threshold triggered.', 
        confidence: similarityScore 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ verified: true, account_name: resolvedName, confidence: similarityScore }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
