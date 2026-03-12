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

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (profile?.role === 'admin') return json(400, { error: 'Cannot delete an admin account.' });

    await supabase.from('user_progress').delete().eq('user_id', userId);
    await supabase.from('subscriptions').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: 'Unable to delete user.', detail: err.message });
  }
};
