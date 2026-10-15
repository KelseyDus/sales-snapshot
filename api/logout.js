'use strict';
const { json, requirePost } = require('./_lib/http');
const auth = require('./_lib/auth');

module.exports = (req, res) => {
  if (!requirePost(req, res)) return;
  res.setHeader('Set-Cookie', auth.cookieHeader(req, '', 0));
  json(res, 200, { ok: true });
};
