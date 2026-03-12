const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireAdmin } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(event);
    if (auth.error) return json(403, { error: auth.error });

    const { userId } = parseBody(event);
    if (!userId) return json(400, { error: 'userId is required.' });

    const supabase = getSupabaseService();
    const { error } = await supabase.from('user_progress').upsert({
      user_id: userId,
      completed_challenges: {},
      xp: 0,
      last_active: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: 'Unable to reset progress.', detail: err.message });
  }
};
