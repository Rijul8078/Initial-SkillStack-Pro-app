function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function getBaseAmountPaise() {
  const inr = Number(process.env.SUBSCRIPTION_AMOUNT_INR || 1499);
  return Math.round(inr * 100);
}

function computeDiscountPaise(baseAmountPaise, promoRow) {
  if (!promoRow) return 0;
  const baseInr = Math.round(baseAmountPaise / 100);
  let discountInr = 0;

  if (promoRow.discount_type === 'percent') {
    discountInr = Math.round((baseInr * Number(promoRow.discount_value || 0)) / 100);
    if (promoRow.max_discount_inr && discountInr > Number(promoRow.max_discount_inr)) {
      discountInr = Number(promoRow.max_discount_inr);
    }
  } else {
    discountInr = Number(promoRow.discount_value || 0);
  }

  if (!Number.isFinite(discountInr) || discountInr < 0) discountInr = 0;
  if (discountInr > baseInr) discountInr = baseInr;
  return Math.round(discountInr * 100);
}

function validatePromoRow(promoRow) {
  if (!promoRow) return { ok: false, error: 'Invalid promo code.' };
  if (!promoRow.is_active) return { ok: false, error: 'Promo code is inactive.' };

  const now = Date.now();
  if (promoRow.starts_at && new Date(promoRow.starts_at).getTime() > now) {
    return { ok: false, error: 'Promo code is not active yet.' };
  }
  if (promoRow.ends_at && new Date(promoRow.ends_at).getTime() < now) {
    return { ok: false, error: 'Promo code has expired.' };
  }
  if (promoRow.max_uses && Number(promoRow.used_count || 0) >= Number(promoRow.max_uses)) {
    return { ok: false, error: 'Promo usage limit reached.' };
  }
  return { ok: true };
}

async function getValidatedPromo(supabase, promoCodeRaw) {
  const code = normalizePromoCode(promoCodeRaw);
  if (!code) return { code: '', promo: null, discountPaise: 0, error: null };

  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) return { code, promo: null, discountPaise: 0, error: error.message };

  const valid = validatePromoRow(promo);
  if (!valid.ok) return { code, promo: null, discountPaise: 0, error: valid.error };

  const discountPaise = computeDiscountPaise(getBaseAmountPaise(), promo);
  return { code, promo, discountPaise, error: null };
}

module.exports = {
  normalizePromoCode,
  getBaseAmountPaise,
  computeDiscountPaise,
  validatePromoRow,
  getValidatedPromo,
};

