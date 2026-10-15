'use strict';
const { json, requirePost, readJson, clientIp } = require('./_lib/http');
const auth = require('./_lib/auth');
const rl = require('./_lib/ratelimit');

module.exports = async (req, res) => {
  if (!requirePost(req, res)) return;
  if (!auth.configured()) return json(res, 503, { error: 'Sign-in is not configured. Set APP_PASSWORD and SESSION_SECRET (32+ characters) in the deployment environment.' });
  const key = 'login:' + clientIp(req);
  if (rl.isLimited(key, 5)) return json(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
  const body = await readJson(req);
  if (!body || typeof body.password !== 'string' || !auth.passwordOk(body.password)) {
    rl.record(key, 15 * 60 * 1000);
    await new Promise(r => setTimeout(r, 400));
    return json(res, 401, { error: 'Incorrect password.' });
  }
  rl.clear(key);
  res.setHeader('Set-Cookie', auth.cookieHeader(req, auth.issue(), auth.TTL));
  json(res, 200, { ok: true });
};
