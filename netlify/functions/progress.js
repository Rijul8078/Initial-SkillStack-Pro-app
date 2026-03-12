const { getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');
const { requireUser } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  try {
    const auth = await requireUser(event);
    if (auth.error) return json(401, { error: auth.error });

    const supabase = getSupabaseService();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('user_progress')
        .select('completed_challenges, xp, last_active')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      return json(200, {
        completedChallenges: data?.completed_challenges || {},
        xp: data?.xp || 0,
        lastActive: data?.last_active || null,
      });
    }

    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      const completedChallenges = body.completedChallenges || {};
      const xp = Number(body.xp || 0);
      const lastActive = new Date().toISOString();

      const { error } = await supabase.from('user_progress').upsert({
        user_id: auth.user.id,
        completed_challenges: completedChallenges,
        xp,
        last_active: lastActive,
      });

      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, { error: 'Progress operation failed.', detail: err.message });
  }
};
