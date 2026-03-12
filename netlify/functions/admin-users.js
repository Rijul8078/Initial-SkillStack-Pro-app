const { getSupabaseService } = require('./_lib/supabase');
const { json } = require('./_lib/http');
const { requireAdmin } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const auth = await requireAdmin(event);
    if (auth.error) return json(403, { error: auth.error });

    const supabase = getSupabaseService();

    const profileRes = await supabase
      .from('profiles')
      .select('id, full_name, role, is_suspended, created_at')
      .order('created_at', { ascending: false });

    const profiles = profileRes?.data || [];
    const profileByUser = Object.fromEntries(profiles.map((p) => [p.id, p]));
    let authUsers = [];
    let authListFailed = false;
    try {
      const authUserRes = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authUsers = authUserRes?.data?.users || [];
      if (authUserRes?.error) authListFailed = true;
    } catch (_e) {
      authListFailed = true;
    }

    const userIds = authUsers.length
      ? authUsers.map((u) => u.id)
      : profiles.map((p) => p.id);

    if (userIds.length === 0) return json(200, { users: [] });

    const [{ data: progressRows }, { data: subscriptionRows }] = await Promise.all([
      supabase.from('user_progress').select('user_id, xp, completed_challenges, last_active').in('user_id', userIds),
      supabase.from('subscriptions').select('user_id, status, plan, started_at, ends_at').in('user_id', userIds),
    ]);

    const progressByUser = Object.fromEntries((progressRows || []).map((r) => [r.user_id, r]));
    const subByUser = Object.fromEntries((subscriptionRows || []).map((r) => [r.user_id, r]));

    const users = authUsers.length
      ? authUsers.map((u) => {
          const p = profileByUser[u.id] || {};
          const pg = progressByUser[u.id] || {};
          const sub = subByUser[u.id] || { status: 'free', plan: 'free' };
          return {
            id: u.id,
            name: p.full_name || u.user_metadata?.full_name || u.email || 'User',
            email: u.email || '',
            role: p.role || 'user',
            isSuspended: !!p.is_suspended,
            joinedAt: p.created_at || u.created_at,
            xp: pg.xp || 0,
            challengeCount: Object.keys(pg.completed_challenges || {}).length,
            lastActive: pg.last_active || p.created_at || u.created_at,
            subscriptionStatus: sub.status,
            subscriptionPlan: sub.plan || 'free',
            subscriptionEndsAt: sub.ends_at || null,
          };
        })
      : profiles.map((p) => {
          const pg = progressByUser[p.id] || {};
          const sub = subByUser[p.id] || { status: 'free', plan: 'free' };
          return {
            id: p.id,
            name: p.full_name || 'User',
            email: '',
            role: p.role || 'user',
            isSuspended: !!p.is_suspended,
            joinedAt: p.created_at,
            xp: pg.xp || 0,
            challengeCount: Object.keys(pg.completed_challenges || {}).length,
            lastActive: pg.last_active || p.created_at,
            subscriptionStatus: sub.status,
            subscriptionPlan: sub.plan || 'free',
            subscriptionEndsAt: sub.ends_at || null,
          };
        });

    users.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));

    return json(200, { users, authListFailed });
  } catch (err) {
    return json(500, { error: 'Unable to fetch users.', detail: err.message });
  }
};
