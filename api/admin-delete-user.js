const { runNetlifyHandler } = require('./_lib/vercel-adapter');
const netlifyFn = require('../netlify/functions/admin-delete-user');

module.exports = async (req, res) => {
  return runNetlifyHandler(req, res, netlifyFn.handler);
};
