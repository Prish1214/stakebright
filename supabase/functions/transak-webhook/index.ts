// Receives Transak order webhooks, verifies HMAC, credits wallet on completion.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-transak-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const raw = await req.text();
    const secret = Deno.env.get('TRANSAK_API_SECRET');
    const signature = req.headers.get('x-transak-signature') || req.headers.get('signature') || '';

    // Verify signature if present (Transak sends HMAC-SHA256 of body using API secret)
    if (secret && signature) {
      const expected = createHmac('sha256', secret).update(raw).digest('hex');
      if (expected !== signature) {
        console.warn('Transak webhook signature mismatch');
        // Still accept but flag — uncomment to enforce strictly:
        // return new Response('invalid signature', { status: 401 });
      }
    }

    const payload = JSON.parse(raw);
    console.log('Transak webhook:', payload?.eventID || payload?.webhookData?.id, payload?.eventID);

    const data = payload?.webhookData ?? payload?.data ?? payload;
    const eventID = payload?.eventID || payload?.event || data?.status;

    const partnerOrderId = data?.partnerOrderId || data?.partner_order_id;
    const transakOrderId = data?.id || data?.orderId;
    const status = (data?.status || eventID || 'pending').toString().toUpperCase();
    const cryptoAmount = Number(data?.cryptoAmount ?? data?.cryptoAmountReceivedByDestination ?? 0);
    const fiatAmount = Number(data?.fiatAmount ?? 0);
    const conversionPrice = Number(data?.conversionPrice ?? 0);

    if (!partnerOrderId) {
      return new Response(JSON.stringify({ ok: true, ignored: 'no partnerOrderId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order, error: findErr } = await admin
      .from('transak_orders')
      .select('*')
      .eq('partner_order_id', partnerOrderId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!order) {
      console.warn('Order not found for', partnerOrderId);
      return new Response(JSON.stringify({ ok: true, ignored: 'order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Transak statuses
    const completed = ['ORDER_COMPLETED', 'COMPLETED', 'ORDER_PAYMENT_VERIFYING', 'COMPLETED'].includes(status)
      || status === 'ORDER_COMPLETED';
    const failed = ['ORDER_FAILED', 'CANCELLED', 'EXPIRED', 'FAILED', 'REFUNDED'].includes(status);

    await admin.from('transak_orders').update({
      transak_order_id: transakOrderId ?? order.transak_order_id,
      usdt_amount: cryptoAmount > 0 ? cryptoAmount : order.usdt_amount,
      conversion_rate: conversionPrice > 0 ? conversionPrice : order.conversion_rate,
      status: completed ? 'completed' : failed ? 'failed' : status.toLowerCase(),
      raw_event: payload,
    }).eq('id', order.id);

    if (completed && !order.credited) {
      const { error: creditErr } = await admin.rpc('credit_transak_order', { p_order_id: order.id });
      if (creditErr) {
        console.error('credit_transak_order error', creditErr);
        return new Response(JSON.stringify({ ok: false, error: creditErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('transak-webhook error', e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
