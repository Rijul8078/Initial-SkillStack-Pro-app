const { getSupabaseAnon, getSupabaseService } = require('./_lib/supabase');
const { json, parseBody } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { name, email, password } = parseBody(event);
    if (!name || !email || !password) {
      return json(400, { error: 'name, email and password are required.' });
    }
    if (String(password).length < 6) {
      return json(400, { error: 'Password must be at least 6 characters.' });
    }

    const supabaseAnon = getSupabaseAnon();
    const { data, error } = await supabaseAnon.auth.signUp({
      email: String(email).toLowerCase().trim(),
      password: String(password),
      options: {
        data: { full_name: String(name).trim() },
      },
    });

    if (error) return json(400, { error: error.message });
    if (!data.user) return json(400, { error: 'Unable to create account.' });

    const supabaseService = getSupabaseService();
    await supabaseService.from('profiles').upsert({
      id: data.user.id,
      full_name: String(name).trim(),
      role: 'user',
      is_suspended: false,
    });

    return json(200, {
      user: {
        id: data.user.id,
        name: String(name).trim(),
        email: data.user.email,
        role: 'user',
        joinedAt: data.user.created_at,
      },
      session: data.session || null,
      emailConfirmationRequired: !data.session,
    });
  } catch (err) {
    return json(500, { error: 'Registration failed.', detail: err.message });
  }
};
