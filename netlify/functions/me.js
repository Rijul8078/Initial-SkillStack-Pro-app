const { getSupabaseService } = require('./_lib/supabase');
const { json } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireUser(event);
    if (auth.error) return json(401, { error: auth.error });

    const supabase = getSupabaseService();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, plan, started_at, ends_at, amount, currency')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    return json(200, {
      user: {
        id: auth.user.id,
        name: auth.profile.full_name || auth.user.user_metadata?.full_name || auth.user.email,
        email: auth.user.email,
        role: auth.profile.role || 'user',
        joinedAt: auth.user.created_at,
      },
      subscription: subscription || { status: 'free', plan: 'free' },
    });
  } catch (err) {
    return json(500, { error: 'Unable to fetch profile.', detail: err.message });
  }
};
