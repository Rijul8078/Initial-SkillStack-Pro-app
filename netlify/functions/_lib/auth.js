const { getSupabaseService } = require('./supabase');
const { getBearerToken } = require('./http');

async function requireUser(event) {
  const token = getBearerToken(event);
  if (!token) return { error: 'Missing bearer token.' };

  const supabase = getSupabaseService();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) {
    return { error: 'Invalid or expired session token.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_suspended')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profile?.is_suspended) {
    return { error: 'Your account is suspended. Contact admin.' };
  }

  return {
    user: data.user,
    profile: profile || { id: data.user.id, full_name: data.user.user_metadata?.full_name || '', role: 'user', is_suspended: false },
    token,
  };
}

async function requireAdmin(event) {
  const res = await requireUser(event);
  if (res.error) return res;
  if (res.profile.role !== 'admin') return { error: 'Admin access required.' };
  return res;
}

module.exports = {
  requireUser,
  requireAdmin,
};
