const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireAdmin } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(event);
    if (auth.error) return json(403, { error: auth.error });

    const { userId, isSuspended } = parseBody(event);
    if (!userId || typeof isSuspended !== 'boolean') {
      return json(400, { error: 'userId and boolean isSuspended are required.' });
    }

    if (auth.user.id === userId && isSuspended) {
      return json(400, { error: 'You cannot suspend your own account.' });
    }

    const supabase = getSupabaseService();
    const { error } = await supabase.from('profiles').update({ is_suspended: isSuspended }).eq('id', userId);
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: 'Unable to update suspension.', detail: err.message });
  }
};
