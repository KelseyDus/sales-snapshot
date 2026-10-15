'use strict';
const crypto = require('crypto');
const { json } = require('./http');

const COOKIE = 'snap_session';
const TTL = 12 * 3600; // seconds

const secret = () => { const s = process.env.SESSION_SECRET; return s && s.length >= 32 ? s : null; };
const configured = () => !!(process.env.APP_PASSWORD && secret());
const sign = v => crypto.createHmac('sha256', secret()).update(v).digest('base64url');

function issue() {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const v = exp + '.' + crypto.randomBytes(8).toString('hex');
  return v + '.' + sign(v);
}

function verify(token) {
  if (!token || !secret()) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const a = Buffer.from(parts[2]), b = Buffer.from(sign(parts[0] + '.' + parts[1]));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(parts[0]) > Date.now() / 1000;
}

function passwordOk(input) {
  const h = s => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(input), h(process.env.APP_PASSWORD));
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const isAuthed = req => verify(parseCookies(req.headers.cookie)[COOKIE]);

function cookieHeader(req, value, maxAge) {
  const secure = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0] === 'https';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function requireAuth(req, res) {
  if (!configured()) { json(res, 503, { error: 'Sign-in is not configured on the server.' }); return false; }
  if (!isAuthed(req)) { json(res, 401, { error: 'Please sign in.' }); return false; }
  return true;
}

module.exports = { COOKIE, TTL, configured, issue, verify, passwordOk, isAuthed, cookieHeader, requireAuth };
