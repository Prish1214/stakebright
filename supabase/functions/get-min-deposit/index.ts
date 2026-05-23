import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user before proxying to NOWPayments.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { network } = await req.json();
    const net = network === 'trc20' ? 'trc20' : 'bep20';
    const payCurrency = net === 'trc20' ? 'usdttrc20' : 'usdtbsc';

    // Get minimum payment amount (returned in pay currency, ~equal to USD for USDT)
    const minResp = await fetch(
      `https://api.nowpayments.io/v1/min-amount?currency_from=${payCurrency}&currency_to=${payCurrency}&fiat_equivalent=usd`,
      { headers: { 'x-api-key': apiKey } }
    );
    const minData = await minResp.json();
    console.log('min-amount response:', JSON.stringify(minData));

    if (!minResp.ok) {
      return new Response(JSON.stringify({ error: 'Could not fetch minimum' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add a small buffer (NOWPayments converts USD -> crypto and rejects if equiv drops below min)
    // Add generous buffer — NOWPayments converts USD->crypto at request time
    // and rates fluctuate, so a small buffer prevents AMOUNT_MINIMAL_ERROR.
    const raw = Number(minData.min_amount) || 0;
    const minUsd = Math.ceil(raw + Math.max(raw * 0.15, 2));

    return new Response(JSON.stringify({
      network: net,
      min_usd: minUsd,
      raw_min: raw,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
