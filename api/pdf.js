'use strict';
const { json, requirePost, readJson, clientIp } = require('./_lib/http');
const auth = require('./_lib/auth');
const rl = require('./_lib/ratelimit');
const { buildPdf } = require('./_lib/pdf');

module.exports = async (req, res) => {
  if (!requirePost(req, res)) return;
  if (!auth.requireAuth(req, res)) return;
  if (!rl.consume('pdf:' + clientIp(req), 60, 3600000)) return json(res, 429, { error: 'PDF limit reached (60 per hour). Try again later.' });
  const body = await readJson(req, 400000);
  if (!body || typeof body.model !== 'object' || !body.model) return json(res, 400, { error: 'Missing report data.' });
  let pdf;
  try { pdf = await buildPdf(body.model); } catch (e) { console.error('pdf build failed:', e && e.stack || e); return json(res, 500, { error: 'The PDF could not be created.' }); }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Marketing-Snapshot.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  res.end(pdf);
};
