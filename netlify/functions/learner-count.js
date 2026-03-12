const { getSupabaseService } = require('./_lib/supabase');
const { json } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const supabase = getSupabaseService();
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) return json(500, { error: error.message });
    return json(200, { count: count || 0 });
  } catch (err) {
    return json(500, { error: 'Unable to get learner count.', detail: err.message });
  }
};
