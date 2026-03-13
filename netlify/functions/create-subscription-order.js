const Razorpay = require('razorpay');
const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');
const { getBaseAmountPaise, getValidatedPromo } = require('./_lib/promo');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireUser(event);
    if (auth.error) return json(401, { error: auth.error });

    const body = parseBody(event);
    const plan = body.plan || 'pro';
    const promoCode = body.promoCode || '';

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const supabase = getSupabaseService();
    const baseAmount = getBaseAmountPaise();
    const promoRes = await getValidatedPromo(supabase, promoCode);
    if (promoCode && promoRes.error) return json(400, { error: promoRes.error });
    const discountAmount = promoRes.discountPaise || 0;
    const amount = Math.max(100, baseAmount - discountAmount);

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `sub_${auth.user.id.slice(0, 12)}_${Date.now()}`,
      notes: {
        user_id: auth.user.id,
        plan,
        promo_code: promoRes.code || '',
      },
    });

    return json(200, {
      orderId: order.id,
      amount,
      originalAmount: baseAmount,
      discountAmount,
      currency: 'INR',
      plan,
      promoCodeApplied: promoRes.code || '',
      user: {
        name: auth.profile.full_name || auth.user.email,
        email: auth.user.email,
      },
    });
  } catch (err) {
    return json(500, { error: 'Unable to create payment order.', detail: err.message });
  }
};
