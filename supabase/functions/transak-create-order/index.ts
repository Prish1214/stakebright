// Creates a pending transak_orders row and returns the Transak widget URL for the user.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSAK_API_KEY = '45987960-e6b0-4218-ad7d-56985b67953a';
const TRANSAK_WIDGET_BASE = 'https://global-stg.transak.com'; // staging

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { inr_amount, target_wallet, usdt_amount, rate } = await req.json();
    const amt = Number(inr_amount);
    if (!amt || amt < 100) {
      return new Response(JSON.stringify({ error: 'Minimum INR amount is ₹100' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['staking', 'trading', 'mining'].includes(target_wallet)) {
      return new Response(JSON.stringify({ error: 'Invalid wallet' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const partnerOrderId = `${user.id}_${Date.now()}`;

    const { data: row, error: insErr } = await supabase
      .from('transak_orders')
      .insert({
        user_id: user.id,
        partner_order_id: partnerOrderId,
        target_wallet,
        inr_amount: amt,
        usdt_amount: usdt_amount ?? null,
        conversion_rate: rate ?? null,
        status: 'pending',
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const params = new URLSearchParams({
      apiKey: TRANSAK_API_KEY,
      environment: 'STAGING',
      defaultFiatCurrency: 'INR',
      fiatCurrency: 'INR',
      defaultCryptoCurrency: 'USDT',
      cryptoCurrencyCode: 'USDT',
      network: 'bsc',
      defaultPaymentMethod: 'upi',
      disableWalletAddressForm: 'true',
      hideMenu: 'true',
      themeColor: '7c3aed',
      partnerOrderId,
      email: user.email ?? '',
      fiatAmount: String(amt),
      // Funds settle into Transak's internal flow; webhook will credit user.
    });

    const widget_url = `${TRANSAK_WIDGET_BASE}?${params.toString()}`;

    return new Response(JSON.stringify({
      success: true,
      widget_url,
      partner_order_id: partnerOrderId,
      order_id: row.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('create-order error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
