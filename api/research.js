'use strict';
const { json, requirePost, readJson, clientIp } = require('./_lib/http');
const auth = require('./_lib/auth');
const rl = require('./_lib/ratelimit');
const { parseTarget, fetchPage } = require('./_lib/fetcher');
const { parsePage, pickLinks, analyze } = require('./_lib/analyze');
const ai = require('./_lib/ai');
const pricing = require('./_lib/pricing');

// Swappable in tests.
const deps = { fetchPage, draftAudit: ai.draftAudit };

module.exports = async (req, res) => {
  if (!requirePost(req, res)) return;
  if (!auth.requireAuth(req, res)) return;
  if (!rl.consume('research:' + clientIp(req), 20, 3600000)) return json(res, 429, { error: 'Research limit reached (20 per hour). Try again later.' });
  const body = await readJson(req);
  let target;
  try { target = parseTarget(body && body.website); } catch (e) { return json(res, 400, { error: e.expose ? e.message : 'Invalid address.' }); }
  const company = typeof (body && body.company) === 'string' ? body.company.trim().slice(0, 120) : '';
  let home;
  try { home = await deps.fetchPage(target.href); } catch (e) { return json(res, 422, { error: e.expose ? e.message : 'The website could not be reviewed.' }); }
  const pages = [parsePage(home.html, home.url)];
  const extra = pickLinks(pages[0], 2);
  const results = await Promise.allSettled(extra.map(u => deps.fetchPage(u)));
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') pages.push(parsePage(r.value.html, r.value.url));
    else errors.push({ url: extra[i], message: r.reason && r.reason.expose ? r.reason.message : 'Could not be retrieved.' });
  });
  const analysis = analyze(pages);
  const out = { reviewedAt: new Date().toISOString(), ...analysis, errors, ai: { used: false } };
  if (ai.enabled()) {
    try {
      const draft = await deps.draftAudit({ company, pages, ruleFindings: analysis.findings, areas: pricing.areas });
      const merged = ai.mergeAudit(analysis.findings, draft, home.url);
      out.findings = merged.findings; out.priorities = merged.priorities; out.strength = merged.strength; out.outreach = merged.outreach;
      out.ai = { used: true, model: ai.modelName() };
    } catch (e) {
      out.ai = { used: false, error: e && e.safe ? e.message : 'AI drafting was unavailable.' };
    }
  }
  json(res, 200, out);
};
module.exports._deps = deps;
