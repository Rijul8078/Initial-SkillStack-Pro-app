function toEvent(req) {
  return {
    httpMethod: req.method,
    headers: req.headers || {},
    body: req.method === 'GET' || req.method === 'HEAD' ? null : JSON.stringify(req.body || {}),
    rawUrl: req.url,
    path: req.url,
    queryStringParameters: req.query || {},
  };
}

function applyHeaders(res, headers) {
  if (!headers) return;
  Object.entries(headers).forEach(([k, v]) => {
    if (typeof v !== 'undefined') res.setHeader(k, v);
  });
}

async function runNetlifyHandler(req, res, handler) {
  const event = toEvent(req);
  const out = await handler(event, {});

  const statusCode = out?.statusCode || 200;
  applyHeaders(res, out?.headers);

  if (typeof out?.body === 'string') {
    res.status(statusCode).send(out.body);
    return;
  }

  if (out && typeof out === 'object' && 'body' in out) {
    res.status(statusCode).json(out.body);
    return;
  }

  res.status(statusCode).json(out || { ok: true });
}

module.exports = {
  runNetlifyHandler,
};
