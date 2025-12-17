import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nowpayments-sig',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ipnSecret) {
      console.error('NOWPAYMENTS_IPN_KEY not configured');
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the signature from headers - MANDATORY
    const signature = req.headers.get('x-nowpayments-sig');
    
    // Signature is REQUIRED - reject requests without signature
    if (!signature) {
      console.error('Missing webhook signature - rejecting request');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    
    console.log('Received webhook payload');
    console.log('Has signature:', !!signature);

    // Verify signature
    const payload = JSON.parse(body);
    // Sort keys alphabetically for signature verification
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((acc: Record<string, unknown>, key) => {
        acc[key] = payload[key];
        return acc;
      }, {});
    
    const hmac = createHmac('sha512', ipnSecret);
    hmac.update(JSON.stringify(sortedPayload));
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid signature - rejecting request');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Signature verified successfully');
    console.log('NOWPayments webhook payload:', JSON.stringify(payload, null, 2));

    const {
      payment_id,
      payment_status,
      pay_amount,
      actually_paid,
      order_id,
      order_description,
      price_amount,
      price_currency,
      pay_currency,
      outcome_amount,
      outcome_currency,
    } = payload;

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if payment is confirmed/finished
    const confirmedStatuses = ['finished', 'confirmed', 'sending', 'partially_paid'];
    
    if (confirmedStatuses.includes(payment_status)) {
      console.log(`Payment ${payment_id} is ${payment_status}, processing...`);
      
      // Find the deposit by payment_id stored in transaction_hash
      const { data: deposit, error: fetchError } = await supabase
        .from('deposits')
        .select('*')
        .eq('transaction_hash', payment_id.toString())
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching deposit:', fetchError);
        return new Response(JSON.stringify({ error: 'Processing error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!deposit) {
        console.log('No deposit found for payment_id:', payment_id);
        // Create a new deposit record if order_id contains user_id
        if (order_id && order_id.includes('_')) {
          const userId = order_id.split('_')[0];
          const actualAmount = actually_paid || price_amount;
          
          console.log('Creating new deposit for user:', userId, 'amount:', actualAmount);
          
          const { error: insertError } = await supabase
            .from('deposits')
            .insert({
              user_id: userId,
              amount: parseFloat(actualAmount),
              transaction_hash: payment_id.toString(),
              status: 'approved',
              admin_notes: `Auto-confirmed via NOWPayments. Status: ${payment_status}. Paid: ${actually_paid} ${pay_currency}`,
              approved_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error creating deposit:', insertError);
            return new Response(JSON.stringify({ error: 'Processing error' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Update user's wallet balance
          const { error: balanceError } = await supabase.rpc('update_wallet_balance', {
            p_user_id: userId,
            p_amount: parseFloat(actualAmount)
          });

          if (balanceError) {
            console.error('Error updating balance via RPC:', balanceError);
            // Fallback: direct update
            const { data: profile } = await supabase
              .from('profiles')
              .select('wallet_balance')
              .eq('user_id', userId)
              .single();
            
            if (profile) {
              await supabase
                .from('profiles')
                .update({ wallet_balance: (profile.wallet_balance || 0) + parseFloat(actualAmount) })
                .eq('user_id', userId);
            }
          }

          console.log('Deposit created and wallet updated successfully');
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Deposit exists, update status if not already approved
      if (deposit.status !== 'approved') {
        const actualAmount = actually_paid || deposit.amount;
        
        console.log('Updating deposit:', deposit.id, 'to approved');
        
        const { error: updateError } = await supabase
          .from('deposits')
          .update({
            status: 'approved',
            amount: parseFloat(actualAmount),
            admin_notes: `Auto-confirmed via NOWPayments. Status: ${payment_status}. Paid: ${actually_paid} ${pay_currency}`,
            approved_at: new Date().toISOString(),
          })
          .eq('id', deposit.id);

        if (updateError) {
          console.error('Error updating deposit:', updateError);
          return new Response(JSON.stringify({ error: 'Processing error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Deposit approved successfully');
      }
    } else {
      console.log(`Payment ${payment_id} status: ${payment_status} - not processing`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Processing error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});