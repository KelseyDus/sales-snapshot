'use strict';
const { json } = require('./_lib/http');
const auth = require('./_lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed.' }); }
  json(res, 200, { configured: auth.configured(), authenticated: auth.configured() && auth.isAuthed(req) });
};
