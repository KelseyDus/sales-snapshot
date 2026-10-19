'use strict';
const { json, requirePost, readJson, clientIp } = require('./_lib/http');
const auth = require('./_lib/auth');
const rl = require('./_lib/ratelimit');
const { parseTarget, fetchPage } = require('./_lib/fetcher');
const { parsePage, pickLinks, analyze } = require('./_lib/analyze');
const ai = require('./_lib/ai');
const pricing = require('./_lib/pricing');

// Swappable in tests.
const deps = { fetchPage, draftAudit: ai.draftAudit, scoutWeb: ai.scoutWeb };

// Vercel stops the function at 60 seconds. Stay well inside that so a slow AI step never turns into a timeout.
const BUDGET_MS = 50000;

module.exports = async (req, res) => {
  const started = Date.now();
  try { await handle(req, res, started); }
  catch (e) {
    console.error('research failed:', e && e.stack || e);
    if (!res.headersSent) json(res, 500, { error: 'The research hit an unexpected error. Try again, or check the function logs in Vercel.' });
  }
};

async function handle(req, res, started) {
  if (!requirePost(req, res)) return;
  if (!auth.requireAuth(req, res)) return;
  if (!rl.consume('research:' + clientIp(req), 20, 3600000)) return json(res, 429, { error: 'Research limit reached (20 per hour). Try again later.' });
  const body = await readJson(req);
  let target;
  try { target = parseTarget(body && body.website); } catch (e) { return json(res, 400, { error: e.expose ? e.message : 'Invalid address.' }); }
  const company = typeof (body && body.company) === 'string' ? body.company.trim().slice(0, 120) : '';
  // Social/review scouting runs alongside page fetching.
  const scoutP = ai.enabled() ? Promise.resolve().then(() => deps.scoutWeb({ company, website: target.href }, { timeoutMs: 15000 })).catch(() => '') : Promise.resolve('');
  let home;
  try { home = await deps.fetchPage(target.href); } catch (e) { console.error('homepage fetch failed:', target.href, e && e.message); return json(res, 422, { error: e.expose ? e.message : 'The website could not be reviewed.' }); }
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
  const remaining = () => BUDGET_MS - (Date.now() - started);
  if (ai.enabled() && remaining() < 12000) {
    out.ai = { used: false, error: 'The AI step was skipped because reviewing the site took too long.' };
  } else if (ai.enabled()) {
    try {
      let timer; const cap = new Promise(r => { timer = setTimeout(() => r(''), Math.max(0, remaining() - 20000)); });
      const scout = await Promise.race([scoutP, cap]); clearTimeout(timer);
      const draft = await deps.draftAudit({ company, pages, ruleFindings: analysis.findings, areas: pricing.areas, scout, checklist: pricing.checklist.flatMap(sec => sec.items) }, { timeoutMs: Math.max(5000, Math.min(30000, remaining() - 4000)) });
      const merged = ai.mergeAudit(analysis.findings, draft, home.url, { scouted: !!scout });
      out.checkSuggestions = ai.cleanSuggestions(draft, pricing.checklist.flatMap(sec => sec.items), { scouted: !!scout });
      out.findings = merged.findings; out.priorities = merged.priorities; out.strength = merged.strength; out.outreach = merged.outreach;
      out.ai = { used: true, model: ai.modelName(), scouted: !!scout };
    } catch (e) {
      console.error('AI drafting failed:', e && e.message);
      out.ai = { used: false, error: e && e.safe ? e.message : 'AI drafting was unavailable.' };
    }
  }
  out.findings = out.findings.map(f => ({ ...f, by: f.by || 'rules', score: ai.fitScore(f.status, f.score) || (f.evidence && f.status !== 'unknown' ? ai.defaultScore(f.status) : 0) }));
  json(res, 200, out);
}
module.exports._deps = deps;
