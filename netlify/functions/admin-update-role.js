const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireAdmin } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(event);
    if (auth.error) return json(403, { error: auth.error });

    const { userId, role } = parseBody(event);
    if (!userId || !role) return json(400, { error: 'userId and role are required.' });
    if (!['user', 'admin'].includes(role)) return json(400, { error: 'Invalid role.' });

    const supabase = getSupabaseService();

    if (auth.user.id === userId && role !== 'admin') {
      return json(400, { error: 'You cannot remove your own admin role.' });
    }

    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: 'Unable to update role.', detail: err.message });
  }
};
