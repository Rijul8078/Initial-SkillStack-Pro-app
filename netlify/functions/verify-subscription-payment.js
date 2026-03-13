const crypto = require('crypto');
const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');
const { getBaseAmountPaise, getValidatedPromo } = require('./_lib/promo');

function verifySignature(orderId, paymentId, signature, secret) {
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return expected === signature;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireUser(event);
    if (auth.error) return json(401, { error: auth.error });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan = 'pro',
      promoCode = '',
    } = parseBody(event);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(400, { error: 'Missing payment verification fields.' });
    }

    const isValid = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET || ''
    );

    if (!isValid) return json(400, { error: 'Invalid payment signature.' });

    const supabase = getSupabaseService();
    const baseAmount = getBaseAmountPaise();
    const promoRes = await getValidatedPromo(supabase, promoCode);
    if (promoCode && promoRes.error) return json(400, { error: promoRes.error });
    const discountAmount = promoRes.discountPaise || 0;
    const amount = Math.max(100, baseAmount - discountAmount);
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    const { error } = await supabase.from('subscriptions').upsert({
      user_id: auth.user.id,
      status: 'active',
      plan,
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      original_amount: baseAmount,
      promo_code: promoRes.code || null,
      discount_amount: discountAmount || 0,
      currency: 'INR',
    });

    if (error) return json(500, { error: error.message });

    if (promoRes.promo) {
      await supabase
        .from('promo_codes')
        .update({ used_count: Number(promoRes.promo.used_count || 0) + 1 })
        .eq('id', promoRes.promo.id);
    }

    return json(200, {
      ok: true,
      subscription: {
        status: 'active',
        plan,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        promo_code: promoRes.code || null,
        discount_amount: discountAmount || 0,
      },
    });
  } catch (err) {
    return json(500, { error: 'Payment verification failed.', detail: err.message });
  }
};
