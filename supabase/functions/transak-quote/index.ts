// Public quote endpoint: returns estimated USDT for a given INR amount via Transak staging API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSAK_API_KEY = '45987960-e6b0-4218-ad7d-56985b67953a';
const TRANSAK_API_BASE = 'https://api-stg.transak.com'; // staging

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { inr_amount } = await req.json();
    const amt = Number(inr_amount);
    if (!amt || amt <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid INR amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transak pricing API - get USDT (BSC) quote for INR via UPI
    const params = new URLSearchParams({
      partnerApiKey: TRANSAK_API_KEY,
      fiatCurrency: 'INR',
      cryptoCurrency: 'USDT',
      network: 'bsc',
      paymentMethod: 'upi',
      fiatAmount: String(amt),
      isBuyOrSell: 'BUY',
    });

    const url = `${TRANSAK_API_BASE}/api/v1/pricing/public/quotes?${params}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await r.json();

    if (!r.ok || !data?.response) {
      console.error('Transak quote error:', data);
      // Fallback rough estimate so UI still works
      const fallback = Number((amt / 86.5).toFixed(4));
      return new Response(JSON.stringify({
        usdt_amount: fallback,
        rate: 86.5,
        fees_inr: 0,
        fallback: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const q = data.response;
    return new Response(JSON.stringify({
      usdt_amount: Number(q.cryptoAmount),
      rate: Number(q.conversionPrice),
      fees_inr: Number(q.totalFee ?? 0),
      fiat_amount: Number(q.fiatAmount),
      quote_id: q.quoteId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('quote error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
