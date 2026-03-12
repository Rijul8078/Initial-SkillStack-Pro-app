const { getSupabaseAnon, getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { email, password } = parseBody(event);
    if (!email || !password) return json(400, { error: 'email and password are required.' });

    const supabaseAnon = getSupabaseAnon();
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: String(email).toLowerCase().trim(),
      password: String(password),
    });

    if (error || !data.session || !data.user) {
      return json(401, { error: error?.message || 'Invalid email or password.' });
    }

    const supabaseService = getSupabaseService();

    const { data: profile } = await supabaseService
      .from('profiles')
      .select('full_name, role, created_at, is_suspended')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.is_suspended) {
      return json(403, { error: 'Your account is suspended. Contact admin.' });
    }

    const { data: subscription } = await supabaseService
      .from('subscriptions')
      .select('status, plan, started_at, ends_at')
      .eq('user_id', data.user.id)
      .maybeSingle();

    return json(200, {
      session: data.session,
      user: {
        id: data.user.id,
        name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email,
        email: data.user.email,
        role: profile?.role || 'user',
        joinedAt: profile?.created_at || data.user.created_at,
      },
      subscription: subscription || { status: 'free', plan: 'free' },
    });
  } catch (err) {
    return json(500, { error: 'Login failed.', detail: err.message });
  }
};
