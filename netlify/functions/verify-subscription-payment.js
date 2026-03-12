const crypto = require('crypto');
const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');

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

    const amount = Math.round(Number(process.env.SUBSCRIPTION_AMOUNT_INR || 1499) * 100);
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    const supabase = getSupabaseService();
    const { error } = await supabase.from('subscriptions').upsert({
      user_id: auth.user.id,
      status: 'active',
      plan,
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      currency: 'INR',
    });

    if (error) return json(500, { error: error.message });

    return json(200, {
      ok: true,
      subscription: {
        status: 'active',
        plan,
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      },
    });
  } catch (err) {
    return json(500, { error: 'Payment verification failed.', detail: err.message });
  }
};
