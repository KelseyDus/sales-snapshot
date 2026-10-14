'use strict';
const { json } = require('./_lib/http');
const auth = require('./_lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed.' }); }
  const authed = auth.configured() && auth.isAuthed(req);
  json(res, 200, { configured: auth.configured(), authenticated: authed, ai: authed && require('./_lib/ai').enabled() });
};
