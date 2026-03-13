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

    const { promoCode } = parseBody(event);
    const supabase = getSupabaseService();
    const baseAmount = getBaseAmountPaise();
    const promoRes = await getValidatedPromo(supabase, promoCode);

    if (promoCode && promoRes.error) return json(400, { error: promoRes.error });

    const discountAmount = promoRes.discountPaise || 0;
    const finalAmount = Math.max(100, baseAmount - discountAmount);

    return json(200, {
      ok: true,
      promoCodeApplied: promoRes.code || '',
      originalAmount: baseAmount,
      discountAmount,
      finalAmount,
      currency: 'INR',
    });
  } catch (err) {
    return json(500, { error: 'Unable to validate promo code.', detail: err.message });
  }
};

