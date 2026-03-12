const { json, getBearerToken } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const token = getBearerToken(event);
    if (!token) return json(200, { ok: true });

    await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    return json(200, { ok: true });
  } catch (_err) {
    return json(200, { ok: true });
  }
};
