const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireAdmin } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(event);
    if (auth.error) return json(403, { error: auth.error });

    const { userId, status, plan = 'pro', months = 12 } = parseBody(event);
    if (!userId || !status) return json(400, { error: 'userId and status are required.' });
    if (!['free', 'active', 'cancelled', 'expired'].includes(status)) return json(400, { error: 'Invalid status.' });

    const supabase = getSupabaseService();

    const now = new Date();
    let endsAt = null;
    let startedAt = null;

    if (status === 'active') {
      startedAt = now.toISOString();
      const end = new Date(now);
      end.setMonth(end.getMonth() + Number(months || 12));
      endsAt = end.toISOString();
    }

    const payload = {
      user_id: userId,
      status,
      plan: status === 'free' ? 'free' : plan,
      started_at: startedAt,
      ends_at: endsAt,
      amount: status === 'active' ? Math.round(Number(process.env.SUBSCRIPTION_AMOUNT_INR || 1499) * 100) : null,
      currency: 'INR',
    };

    const { error } = await supabase.from('subscriptions').upsert(payload, { onConflict: 'user_id' });
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: 'Unable to update subscription.', detail: err.message });
  }
};
