const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireAdmin } = require('./_lib/auth');
const { normalizePromoCode } = require('./_lib/promo');

function toInt(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(event);
    if (auth.error) return json(403, { error: auth.error });

    const body = parseBody(event);
    const action = body.action;
    const supabase = getSupabaseService();

    if (action === 'list_promos') {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('id, code, description, discount_type, discount_value, max_discount_inr, is_active, starts_at, ends_at, max_uses, used_count, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) return json(500, { error: error.message });
      return json(200, { promos: data || [] });
    }

    if (action === 'create_promo') {
      const code = normalizePromoCode(body.code);
      const description = String(body.description || '').trim() || null;
      const discountType = body.discountType === 'percent' ? 'percent' : 'flat';
      const discountValue = toInt(body.discountValue, 0);
      const maxDiscountInr = toInt(body.maxDiscountInr, null);
      const maxUses = toInt(body.maxUses, null);
      const startsAt = body.startsAt || null;
      const endsAt = body.endsAt || null;

      if (!code) return json(400, { error: 'Promo code is required.' });
      if (discountValue <= 0) return json(400, { error: 'Discount value must be greater than 0.' });
      if (discountType === 'percent' && discountValue > 90) return json(400, { error: 'Percent discount cannot exceed 90.' });

      const { error } = await supabase.from('promo_codes').insert({
        code,
        description,
        discount_type: discountType,
        discount_value: discountValue,
        max_discount_inr: maxDiscountInr,
        is_active: true,
        starts_at: startsAt,
        ends_at: endsAt,
        max_uses: maxUses,
        used_count: 0,
        created_by: auth.user.id,
      });
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    if (action === 'update_promo') {
      const promoId = body.promoId;
      if (!promoId) return json(400, { error: 'promoId is required.' });

      const patch = {};
      if (typeof body.description !== 'undefined') patch.description = String(body.description || '').trim() || null;
      if (typeof body.discountType !== 'undefined') patch.discount_type = body.discountType === 'percent' ? 'percent' : 'flat';
      if (typeof body.discountValue !== 'undefined') patch.discount_value = toInt(body.discountValue, 0);
      if (typeof body.maxDiscountInr !== 'undefined') patch.max_discount_inr = toInt(body.maxDiscountInr, null);
      if (typeof body.maxUses !== 'undefined') patch.max_uses = toInt(body.maxUses, null);
      if (typeof body.startsAt !== 'undefined') patch.starts_at = body.startsAt || null;
      if (typeof body.endsAt !== 'undefined') patch.ends_at = body.endsAt || null;
      if (typeof body.isActive !== 'undefined') patch.is_active = !!body.isActive;

      if (Object.prototype.hasOwnProperty.call(patch, 'discount_value') && patch.discount_value <= 0) {
        return json(400, { error: 'Discount value must be greater than 0.' });
      }

      const { error } = await supabase.from('promo_codes').update(patch).eq('id', promoId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return json(400, { error: 'Invalid promo action.' });
  } catch (err) {
    return json(500, { error: 'Unable to process promo action.', detail: err.message });
  }
};

