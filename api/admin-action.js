const { runNetlifyHandler } = require('./_lib/vercel-adapter');

const handlers = {
  delete_user: require('../netlify/functions/admin-delete-user').handler,
  update_role: require('../netlify/functions/admin-update-role').handler,
  set_suspension: require('../netlify/functions/admin-set-suspension').handler,
  update_subscription: require('../netlify/functions/admin-update-subscription').handler,
  reset_progress: require('../netlify/functions/admin-reset-progress').handler,
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const action = req.body?.action;
  const handler = handlers[action];

  if (!handler) {
    res.status(400).json({ error: 'Invalid admin action.' });
    return;
  }

  return runNetlifyHandler(req, res, handler);
};
