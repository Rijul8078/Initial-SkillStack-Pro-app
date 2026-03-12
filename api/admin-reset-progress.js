const { runNetlifyHandler } = require('./_lib/vercel-adapter');
const netlifyFn = require('../netlify/functions/admin-reset-progress');

module.exports = async (req, res) => {
  return runNetlifyHandler(req, res, netlifyFn.handler);
};
