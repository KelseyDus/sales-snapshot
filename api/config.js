'use strict';
const { json } = require('./_lib/http');
const auth = require('./_lib/auth');
const pricing = require('./_lib/pricing');

// Pricing and rules are served only to signed-in users, so they are not readable in public source.
module.exports = (req, res) => {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed.' }); }
  if (!auth.requireAuth(req, res)) return;
  json(res, 200, pricing);
};
