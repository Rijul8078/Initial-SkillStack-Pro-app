const { runNetlifyHandler } = require('./_lib/vercel-adapter');
const netlifyFn = require('../netlify/functions/validate-promo');

module.exports = async (req, res) => runNetlifyHandler(req, res, netlifyFn.handler);

