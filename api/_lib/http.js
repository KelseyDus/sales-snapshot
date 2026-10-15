'use strict';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Browsers always send Origin on cross-origin POSTs; reject when it does not match our host.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

function clientIp(req) {
  const x = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return x || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

async function readJson(req, limit = 100000) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8')); } catch { return null; } }
    return typeof req.body === 'object' ? req.body : null;
  }
  return new Promise(resolve => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { resolve(null); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function requirePost(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); json(res, 405, { error: 'Method not allowed.' }); return false; }
  if (!sameOrigin(req)) { json(res, 403, { error: 'Cross-origin request blocked.' }); return false; }
  return true;
}

module.exports = { json, sameOrigin, clientIp, readJson, requirePost };
