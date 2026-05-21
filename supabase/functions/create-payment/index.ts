import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!apiKey) {
      console.error('NOWPAYMENTS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { amount, target_wallet, network } = await req.json();

    if (!amount || amount < 1) {
      return new Response(JSON.stringify({ error: 'Minimum deposit amount is 1 USDT' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validWallets = ['staking', 'trading', 'mining', 'main'];
    const validNetworks = ['bep20', 'trc20'];
    const wallet = validWallets.includes(target_wallet) ? target_wallet : 'staking';
    const net = validNetworks.includes(network) ? network : 'bep20';
    const payCurrency = net === 'trc20' ? 'usdttrc20' : 'usdtbsc';

    console.log('Creating payment for user:', user.id, 'amount:', amount);

    // Get the webhook URL dynamically
    const webhookUrl = `${supabaseUrl}/functions/v1/nowpayments-webhook`;

    // Create payment via NOWPayments API
    const paymentResponse = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: `${user.id}_${Date.now()}`,
        order_description: `Deposit of ${amount} USDT`,
        ipn_callback_url: webhookUrl,
        success_url: `${req.headers.get('origin')}/deposit?status=success`,
        cancel_url: `${req.headers.get('origin')}/deposit?status=cancelled`,
      }),
    });

    const paymentData = await paymentResponse.json();
    console.log('NOWPayments response:', JSON.stringify(paymentData, null, 2));

    if (!paymentResponse.ok) {
      console.error('Payment provider error:', paymentData);
      let friendly = paymentData.message || 'Failed to create payment';
      if (paymentData.code === 'AMOUNT_MINIMAL_ERROR') {
        const m = String(paymentData.message || '').match(/([\d.]+)/);
        const cryptoMin = m ? Math.ceil(parseFloat(m[1]) + 2) : null;
        friendly = cryptoMin
          ? `Amount is below the minimum required for USDT (${net.toUpperCase()}). Please deposit at least ${cryptoMin} USDT.`
          : `Amount is below the minimum required for USDT (${net.toUpperCase()}). Please increase your deposit amount.`;
      }
      // Return 200 so the friendly message reaches the client (invoke() hides bodies on non-2xx)
      return new Response(JSON.stringify({ error: friendly }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create pending deposit record with payment_id as transaction_hash
    const { data: depositData, error: depositError } = await supabase
      .from('deposits')
      .insert({
        user_id: user.id,
        amount: amount,
        transaction_hash: paymentData.payment_id.toString(),
        status: 'pending',
        target_wallet: wallet,
        network: net,
        admin_notes: `NOWPayments [${net.toUpperCase()}] -> ${wallet} wallet. Pay address: ${paymentData.pay_address}. Expected: ${paymentData.pay_amount} ${paymentData.pay_currency}`,
      })
      .select('id')
      .single();

    if (depositError) {
      console.error('Error creating deposit record:', depositError);
    }

    return new Response(JSON.stringify({
      success: true,
      payment_id: paymentData.payment_id,
      pay_address: paymentData.pay_address,
      pay_amount: amount,
      pay_currency: net === 'trc20' ? 'USDT (TRC20)' : 'USDT (BEP20)',
      network: net,
      target_wallet: wallet,
      expiration_estimate_date: paymentData.expiration_estimate_date,
      payment_status: paymentData.payment_status,
      deposit_id: depositData?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create payment error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
