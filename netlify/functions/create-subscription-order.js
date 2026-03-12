const Razorpay = require('razorpay');
const { json, parseBody } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');

function getAmountPaise() {
  const inr = Number(process.env.SUBSCRIPTION_AMOUNT_INR || 1499);
  return Math.round(inr * 100);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireUser(event);
    if (auth.error) return json(401, { error: auth.error });

    const body = parseBody(event);
    const plan = body.plan || 'pro';

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amount = getAmountPaise();

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `sub_${auth.user.id.slice(0, 12)}_${Date.now()}`,
      notes: {
        user_id: auth.user.id,
        plan,
      },
    });

    return json(200, {
      orderId: order.id,
      amount,
      currency: 'INR',
      plan,
      user: {
        name: auth.profile.full_name || auth.user.email,
        email: auth.user.email,
      },
    });
  } catch (err) {
    return json(500, { error: 'Unable to create payment order.', detail: err.message });
  }
};
