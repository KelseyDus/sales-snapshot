// Marketing Snapshot: rendering, recommendation logic, research, drafts, exports.
// Pricing and review categories arrive from /api/config after sign-in; none are shipped in this file.
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const ask = m => (typeof confirm === 'function' ? confirm(m) : true);
const DRAFT_KEY = 'oswald-snapshot-draft-v2';

let packages = [], depths = [], descriptions = [], catalog = [], areas = [], hostingOptions = [], sampleFindings = {};
let CONTACT_EMAILS = [], SETUP_NOTE = '', CUSTOM_SPEND = 10000, SCORE_LABELS = ['Poor', 'Average', 'Good', 'Better', 'Best'], QUOTE_DAYS = 30, QUOTE_TERMS = '', CHECKLIST = [], SAMPLE_CHECKLIST = {}, checks = {};
const CHECK_LABELS = { yes: 'In place', partial: 'Partly in place', no: 'Not in place' };
let sample = false, active = 'report', selected = new Set(), findings = [], hoursValue = 0, discountValue = false, researchMeta = null, aiEnabled = false;
const researchHint = () => aiEnabled
  ? 'Reviews up to three public pages, then drafts the findings, priorities and outreach email for you. You review and edit everything before it reaches the client report.'
  : 'Reviews up to three public pages and drafts evidence-based findings. You review them before anything reaches the client report.';

function applyConfig(c) {
  packages = c.packages; depths = c.depths; descriptions = c.descriptions; catalog = c.catalog; areas = c.areas;
  hostingOptions = c.hostingOptions; sampleFindings = c.sampleFindings || {}; CONTACT_EMAILS = c.contactEmails || [];
  SETUP_NOTE = c.setupNote || ''; CUSTOM_SPEND = c.customSpendThreshold;
  CHECKLIST = Array.isArray(c.checklist) ? c.checklist : []; SAMPLE_CHECKLIST = c.sampleChecklist || {};
  QUOTE_DAYS = Number(c.quoteValidDays) || 30; QUOTE_TERMS = c.quoteTerms || '';
  if (Array.isArray(c.scoreLabels) && c.scoreLabels.length === 5) SCORE_LABELS = c.scoreLabels.map(String);
}
// Report card ratings: 0 = not assessed, 1..5 = SCORE_LABELS. Defaults follow the finding status.
const defaultScore = status => ({ gap: 2, improve: 3, strong: 4 }[status] || 0);
const blankFindings = () => areas.map(a => ({ ...a, status: 'unknown', score: 0, priority: false, evidence: '', source: '', impact: a.why, action: a.next }));
const exampleFindings = () => areas.map(a => {
  const s = sampleFindings[a.id] || {}, status = s.status || 'unknown';
  return { ...a, status, score: defaultScore(status), priority: status === 'gap', evidence: s.evidence || '', source: '', impact: a.why, action: a.next };
});

function safeLink(s) {
  try {
    s = String(s || '').trim();
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}
function link(s) { const u = safeLink(s); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>` : esc(s || 'Not supplied'); }

function context() {
  const raw = $('budget').value;
  return {
    company: $('company').value.trim() || 'Prospective business', website: $('website').value.trim(),
    social: $('social').value.split('\n').map(s => s.trim()).filter(Boolean),
    industry: $('industry').value, markets: Math.max(1, Number($('markets').value) || 1), goal: $('goal').value, ready: $('ready').value,
    budget: raw === '' ? null : Math.max(0, Number(raw) || 0), hosting: Number($('hosting').value) || 0, complex: $('complex').checked,
    depthOverride: $('depthOverride').value, packageOverride: $('packageOverride').value, showPricing: $('showPricing').checked
  };
}

function recommendation(c, fs) {
  const observed = fs.filter(isOpportunity);
  const foundational = observed.filter(f => f.depth === 0).length;
  let depth = foundational >= 2 ? 0 : observed.some(f => f.depth === 1) ? 1 : observed.some(f => f.depth === 0) ? 0 : null;
  const goals = { foundation: 0, trust: 1, growth: 2, leadership: 3 };
  if (c.goal in goals) depth = goals[c.goal];
  if (c.depthOverride !== 'auto') depth = depths.indexOf(c.depthOverride);
  const custom = c.industry !== 'home' || c.markets > 1 || c.complex || (c.budget !== null && c.budget > CUSTOM_SPEND);
  let pkg = null;
  if (!custom) {
    if (c.ready === 'no') pkg = 0;
    else if (c.ready === 'yes' && c.budget !== null) pkg = c.budget >= packages[3].min ? 3 : c.budget >= packages[2].min ? 2 : c.budget >= packages[1].min ? 1 : 0;
    if (c.packageOverride !== 'auto') pkg = Number(c.packageOverride);
  }
  return { depth, pkg, custom, foundation: foundational > 0, needsBudget: c.ready === 'unknown' || c.budget === null, observed };
}

function calculate(pkg, host, spend, ids, hours = 0, discount = false) {
  const p = packages[pkg];
  const ad = pkg === 0 ? 0 : Math.max(p.min, spend ?? p.min);
  const services = host + p.social + p.seo + p.retainer;
  let monthly = 0, project = 0, unquoted = false, from = false, monthlyQuoted = false, projectQuoted = false, monthlyFrom = false, projectFrom = false;
  for (const a of catalog.filter(a => ids.has(a.id))) {
    if (a.price === null) { unquoted = true; if (a.type === 'monthly') monthlyQuoted = true; else projectQuoted = true; }
    if (a.quote) { unquoted = true; projectQuoted = true; }
    if (a.base) { from = true; if (a.type === 'monthly') monthlyFrom = true; else projectFrom = true; }
    let cost = a.price ?? 0;
    if (a.id === 'email' && discount) cost *= 0.9;
    if (a.type === 'monthly') monthly += cost; else if (a.type === 'project') project += cost; else project += cost * Math.max(0, hours);
  }
  return { services, ad, monthly, project, total: services + ad + monthly, unquoted, from, monthlyQuoted, projectQuoted, monthlyFrom, projectFrom };
}

// An opportunity is an area that needs work (a gap or an improvement) and has observed evidence behind it.
const isOpportunity = f => (f.status === 'gap' || f.status === 'improve') && !!f.evidence.trim();
const picked = () => findings.filter(f => f.priority && isOpportunity(f)).sort((a, b) => (a.status === b.status ? 0 : a.status === 'gap' ? -1 : 1)).slice(0, 3);
const totals = (c, r) => (r.pkg === null ? null : calculate(r.pkg, c.hosting, c.budget, selected, hoursValue, discountValue));

function evidenceHTML(f, i) {
  return `<div class="finding"><div class="eyebrow">Opportunity ${String(i + 1).padStart(2, '0')} · ${esc(f.area)}</div><h3>${esc(f.title)}</h3><p><strong>What we observed:</strong> ${esc(f.observed)}</p>${f.source ? `<p class="small">Source: ${link(f.source)}</p>` : ''}<p><strong>Why it matters:</strong> ${esc(f.why)}</p><p><strong>Practical next step:</strong> ${esc(f.next)}</p></div>`;
}

function routeReason(c, r) {
  if (r.custom) return 'Your business calls for a scoping conversation. These standard packages cover single-market, owner-operated home services businesses.';
  if (r.pkg === null) return 'Package selection is pending confirmation of advertising readiness and budget. Public pages alone cannot establish an appropriate advertising investment.';
  if (c.packageOverride !== 'auto') return 'Sales-selected package for review. Confirm the service scope and investment with the prospect.';
  if (r.pkg === 0) return c.ready === 'no' ? 'A foundation-focused starting point without paid advertising.' : 'The confirmed advertising budget is below the Base Ads minimum. Begin with service priorities and discuss advertising separately.';
  return `Based on the confirmed monthly advertising budget and readiness, ${packages[r.pkg].name} is a preliminary fit. Validate channel needs and growth goals on the call.`;
}

const setupLine = () => ($('setupWaived').checked ? (SETUP_NOTE || 'Setup fees are waived.') : 'Any one-time setup fees are confirmed during scoping.');

// The report is built as a plain data model so the on-screen report and the downloadable PDF stay identical.
function priceModel(c, r, t) {
  const p = packages[r.pkg];
  const rows = [['Hosting and care', money(c.hosting)], ['Social media management', money(p.social)], ['SEO / AEO / GEO', money(p.seo)], ['Strategy, creative, account management', money(p.retainer)], ['Monthly advertising investment (management included)', money(t.ad)]];
  if (selected.size) rows.push(['Selected monthly add-ons', money(t.monthly)]);
  const discountNote = discountValue && selected.has('email') ? ' A 10% ServiceTitan discount is applied to the standalone email marketing line.' : '';
  return {
    title: `Estimated investment · ${p.name}`, rows,
    total: [`${t.monthlyFrom ? 'Starting estimated' : 'Estimated'} monthly total`, money(t.total) + (t.monthlyQuoted ? ' + quoted monthly items' : '')],
    project: ['One-time projects / creative hours', (t.projectFrom ? 'From ' : '') + money(t.project) + (t.projectQuoted ? ' + quoted one-time items' : '')],
    setup: $('setupWaived').checked ? ['Setup fee', 'Waived'] : null,
    extras: selected.size ? `Selected extras: ${catalog.filter(a => selected.has(a.id)).map(a => a.name).join('; ')}.` : '',
    note: `Monthly reporting included. No Ads excludes paid media. ${r.pkg > 0 && c.budget !== null && c.budget < p.min ? `The selected package requires at least ${money(p.min)} in ad spend, above the entered budget. ` : ''}${p.perk ? p.perk + ' ' : ''}Base prices, quoted items, and company-store setup are confirmed during scoping.${discountNote}`
  };
}

function priceHTML(m) {
  const row = (a, b) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`;
  return `<h3 class="section">${esc(m.title)}</h3><table><thead><tr><th>Monthly component</th><th>Estimate</th></tr></thead><tbody>${m.rows.map(x => row(x[0], x[1])).join('')}<tr class="total"><td>${esc(m.total[0])}</td><td>${esc(m.total[1])}</td></tr>${row(m.project[0], m.project[1])}${m.setup ? row(m.setup[0], m.setup[1]) : ''}</tbody></table>${m.extras ? `<p class="small">${esc(m.extras)}</p>` : ''}<p class="small">${esc(m.note)}</p>`;
}

function reportModel(c, r) {
  const fs = picked(), t = totals(c, r);
  return {
    sample, company: c.company, website: c.website,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    label: sample ? 'FICTIONAL SAMPLE · NO LIVE AUDIT' : 'PUBLIC-RESEARCH ASSESSMENT · PRELIMINARY',
    intro: 'This snapshot highlights practical ways to strengthen your marketing presence. Recommendations reflect the observations recorded for this review and need confirmation against your business goals.',
    sampleNote: sample ? 'All findings below are fictional examples for training.' : '',
    strength: $('strength').value.trim(),
    glance: findings.filter(f => f.score > 0 && f.status !== 'unknown' && f.evidence.trim()).map(f => [f.name, SCORE_LABELS[f.score - 1]]),
    stats: [[String(fs.length), 'Priority opportunities'], [r.depth === null ? 'Pending' : depths[r.depth], 'Preliminary marketing depth'], [r.custom ? 'Custom scope' : r.pkg === null ? 'Pending' : packages[r.pkg].name, 'Suggested service package']],
    findings: fs.map(f => ({ area: f.name, title: f.title, observed: f.evidence, source: f.source, why: f.impact, next: f.action })),
    depths: depths.map((d, i) => ({ name: d, desc: descriptions[i], selected: r.depth === i })),
    direction: r.depth === null
      ? { lead: '', text: 'Confirm the business goals and document findings before choosing a marketing depth.' }
      : { lead: depths[r.depth] + ':', text: `${descriptions[r.depth]}. ${c.goal !== 'unknown' ? 'This direction reflects the stated business goal.' : 'This direction reflects the documented gaps.'}` },
    foundationNote: r.foundation && r.depth > 0 ? 'Address the documented website or brand foundation gaps as part of the starting plan.' : '',
    routeReason: routeReason(c, r),
    pricing: c.showPricing && t ? priceModel(c, r, t) : null,
    cta: { heading: 'Let’s talk through what matters most.', body: 'We’d welcome 15 minutes to discuss these opportunities and the priorities behind them.' },
    contact: CONTACT_EMAILS.slice(),
    footer: `${sample ? 'Fictional sample for training. ' : ''}This is a preliminary review of public observations, not an account-performance audit. Social, advertising, email, and analytics performance require confirmation. Pricing is an estimate, subject to scope and territory availability. ${setupLine()}`
  };
}

function reportHTML(m, print = false) {
  const intro = `<div class="report-head"><div><div class="wordmark">OSWALD MARKETING</div><div class="eyebrow">Complimentary Marketing Snapshot</div></div><div class="small">${esc(m.date)}<br>${esc(m.label)}</div></div><div class="eyebrow">Prepared for ${esc(m.company)}</div><h1 class="report-title">A few opportunities<br>worth a conversation.</h1>${m.website ? `<p>${link(m.website)}</p>` : ''}<p>${esc(m.intro)}</p>${m.sampleNote ? `<div class="note"><strong>Sample report:</strong> ${esc(m.sampleNote)}</div>` : ''}${m.strength ? `<h3 class="section">What is already working</h3><p>${esc(m.strength)}</p>` : ''}<div class="stats">${m.stats.map(s => `<div class="stat"><strong>${esc(s[0])}</strong>${esc(s[1])}</div>`).join('')}</div>${m.glance && m.glance.length ? `<h3 class="section">At a glance</h3><table><thead><tr><th>Area reviewed</th><th>Today</th></tr></thead><tbody>${m.glance.map(g => `<tr><td>${esc(g[0])}</td><td>${esc(g[1])}</td></tr>`).join('')}</tbody></table>` : ''}`;
  const opportunities = `<h2>Opportunities to explore</h2>${m.findings.length ? m.findings.map(evidenceHTML).join('') : '<div class="empty">No evidenced priority findings yet. Add your observations in the findings editor.</div>'}`;
  const next = `<h2 class="section">A practical starting direction</h2><div class="depths">${m.depths.map(d => `<div class="depth ${d.selected ? 'selected' : ''}"><strong>${esc(d.name)}</strong>${esc(d.desc)}</div>`).join('')}</div><p>${m.direction.lead ? `<strong>${esc(m.direction.lead)}</strong> ` : ''}${esc(m.direction.text)}</p>${m.foundationNote ? `<p>${esc(m.foundationNote)}</p>` : ''}<p>${esc(m.routeReason)}</p>${m.pricing ? priceHTML(m.pricing) : ''}<div class="note"><h3>${esc(m.cta.heading)}</h3><p>${esc(m.cta.body)}</p><p><strong>${m.contact.map(esc).join(' · ')}</strong></p></div><div class="footer">${esc(m.footer)}</div>`;
  return print ? `<div class="page">${intro}</div><div class="page">${opportunities}</div><div class="page">${next}</div>` : intro + opportunities + next;
}

/* ---------- Report card ---------- */
// Ratings need observed evidence; anything without it is shown as "not assessed".
function checklistSummary() {
  return CHECKLIST.map(sec => {
    const ans = sec.items.filter(it => checks[it.id] && checks[it.id].v);
    const withNote = it => it.q + ((checks[it.id].note || '').trim() ? ' (' + checks[it.id].note.trim() + ')' : '');
    const pick = v => ans.filter(it => checks[it.id].v === v).map(withNote);
    return { name: sec.name, checked: ans.length, inPlace: pick('yes'), partial: pick('partial'), missing: pick('no') };
  }).filter(g => g.checked > 0);
}
function cardModel(c) {
  const rated = findings.filter(f => f.score > 0 && f.status !== 'unknown' && f.evidence.trim());
  const rest = findings.filter(f => !rated.includes(f));
  const best = rated.length ? rated.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const worst = rated.length ? rated.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  return {
    kind: 'card', sample, company: c.company, website: c.website,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    label: sample ? 'FICTIONAL SAMPLE · NO LIVE AUDIT' : 'PUBLIC-RESEARCH REVIEW · PRELIMINARY',
    intro: 'A quick look at how your website and brand are doing today, based on what we could see publicly. Each area is rated from ' + SCORE_LABELS[0] + ' to ' + SCORE_LABELS[4] + '.',
    sampleNote: sample ? 'All ratings below are fictional examples for training.' : '',
    strength: $('strength').value.trim(), labels: SCORE_LABELS.slice(),
    summary: [[`${rated.length} of ${findings.length}`, 'Areas rated'], [best ? best.name : 'Pending', 'Strongest area'], [worst && worst.score < (best ? best.score : 6) ? worst.name : rated.length ? 'None stands out' : 'Pending', 'Biggest opportunity']],
    areas: rated.map(f => ({ name: f.name, score: f.score, label: SCORE_LABELS[f.score - 1], evidence: f.evidence.trim(), source: f.source, next: f.score <= 3 ? f.action : '' })),
    unassessed: rest.map(f => f.name),
    checklist: checklistSummary(),
    cta: { heading: 'Want to talk it through?', body: 'We would be glad to walk through this with you in a 15-minute call. No obligation.' },
    contact: CONTACT_EMAILS.slice(),
    footer: `${sample ? 'Fictional sample for training. ' : ''}This report card reflects public observations on the date shown. It is not an audit of analytics, advertising, email or sales performance, and ratings are a starting point for conversation.`
  };
}
function cardHTML(m, print = false) {
  const meter = n => `<span class="meter" role="img" aria-label="${n} of 5">${[1, 2, 3, 4, 5].map(i => `<span class="seg ${i <= n ? 'on' : ''}"></span>`).join('')}</span>`;
  const head = `<div class="report-head"><div><div class="wordmark">OSWALD MARKETING</div><div class="eyebrow">Marketing Report Card</div></div><div class="small">${esc(m.date)}<br>${esc(m.label)}</div></div><div class="eyebrow">Prepared for ${esc(m.company)}</div><h1 class="report-title">Your marketing<br>report card.</h1>${m.website ? `<p>${link(m.website)}</p>` : ''}<p>${esc(m.intro)}</p>${m.sampleNote ? `<div class="note"><strong>Sample report:</strong> ${esc(m.sampleNote)}</div>` : ''}<div class="stats">${m.summary.map(s => `<div class="stat"><strong>${esc(s[0])}</strong>${esc(s[1])}</div>`).join('')}</div>${m.strength ? `<div class="note"><strong>Already working well:</strong> ${esc(m.strength)}</div>` : ''}`;
  const areasHTML = `<h2>How each area looks</h2>${m.areas.length ? m.areas.map(a => `<div class="finding"><div class="cardrow"><h3>${esc(a.name)}</h3><div class="rating">${meter(a.score)}<strong>${esc(a.label)}</strong></div></div><p>${esc(a.evidence)}</p>${a.source ? `<p class="small">Source: ${link(a.source)}</p>` : ''}${a.next ? `<p><strong>What would help:</strong> ${esc(a.next)}</p>` : ''}</div>`).join('') : '<div class="empty">No rated areas yet. Add observed evidence and a rating in the findings editor.</div>'}${m.unassessed.length ? `<p class="small">Not yet assessed: ${esc(m.unassessed.join(', '))}. We would cover these together, because public information alone is not enough to rate them fairly.</p>` : ''}`;
  const list = (title, items) => items.length ? `<p class="ckhead"><strong>${title}</strong></p><ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const checklistHTML = m.checklist && m.checklist.length ? `<h2 class="section">What we looked at</h2>${m.checklist.map(g => `<div class="finding"><h3>${esc(g.name)} <span class="small">· ${g.inPlace.length} of ${g.checked} checks in place${g.partial.length ? ', ' + g.partial.length + ' partly' : ''}</span></h3>${list('In place', g.inPlace)}${list('Partly in place', g.partial)}${list('Worth adding', g.missing)}</div>`).join('')}` : '';
  const cta = `<div class="note"><h3>${esc(m.cta.heading)}</h3><p>${esc(m.cta.body)}</p><p><strong>${m.contact.map(esc).join(' · ')}</strong></p></div><div class="footer">${esc(m.footer)}</div>`;
  return print ? `<div class="page">${head}</div><div class="page">${areasHTML}</div>${checklistHTML ? `<div class="page">${checklistHTML}</div>` : ''}<div class="page">${cta}</div>` : head + areasHTML + checklistHTML + cta;
}

function renderChecklist() {
  $('checklist').innerHTML = `<div class="eyebrow">What to look for</div><h2>Audit checklist</h2><p>Work through each section while you review the website, social profiles and listings. Only items you answer appear on the report card; leave the rest blank. Use the note field for specifics such as the rating or the date of the last post. Notes are shown to the client.</p>${CHECKLIST.map(sec => {
    const done = sec.items.filter(it => checks[it.id] && checks[it.id].v).length;
    return `<div class="review"><h3>${esc(sec.name)} <span class="small">· ${done} of ${sec.items.length} checked</span></h3>${sec.items.map(it => { const m = checks[it.id] || { v: '', note: '' }; return `<div class="ck"><div class="ckq"><strong>${esc(it.q)}</strong><div class="small">${esc(it.look)}</div></div><select aria-label="${esc(it.q)}" data-ck="${esc(it.id)}"><option value="">Not checked</option>${Object.entries(CHECK_LABELS).map(([k, l]) => `<option value="${k}" ${m.v === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><input aria-label="Note for ${esc(it.q)}" data-ckn="${esc(it.id)}" maxlength="300" placeholder="Note (optional)" value="${esc(m.note)}"></div>`; }).join('')}</div>`;
  }).join('')}<div class="actions"><button id="clearChecks" type="button">Clear checklist</button></div>`;
}
function renderEditor() {
  renderChecklist();
  $('reviews').innerHTML = findings.map((f, i) => `<div class="review"><h3>${esc(f.name)}</h3><div class="row"><div><label for="status${i}">Status</label><select id="status${i}" data-field="status" data-index="${i}"><option value="unknown" ${f.status === 'unknown' ? 'selected' : ''}>Unknown</option><option value="strong" ${f.status === 'strong' ? 'selected' : ''}>Strong</option><option value="improve" ${f.status === 'improve' ? 'selected' : ''}>Needs improvement</option><option value="gap" ${f.status === 'gap' ? 'selected' : ''}>Priority gap</option></select></div><div><label for="title${i}">Client-facing opportunity title</label><input id="title${i}" data-index="${i}" data-field="title" value="${esc(f.title)}"></div></div><label for="score${i}">Report card rating</label><select id="score${i}" data-field="score" data-index="${i}">${['Not assessed', ...SCORE_LABELS].map((l, n) => `<option value="${n}" ${f.score === n ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><label for="ev${i}">Observed evidence</label><textarea id="ev${i}" data-index="${i}" data-field="evidence" placeholder="Describe what you actually observed">${esc(f.evidence)}</textarea><label for="source${i}">Evidence URL</label><input id="source${i}" data-index="${i}" data-field="source" value="${esc(f.source)}"><label for="impact${i}">Why it matters</label><textarea id="impact${i}" data-index="${i}" data-field="impact">${esc(f.impact)}</textarea><label for="action${i}">Practical next step</label><textarea id="action${i}" data-index="${i}" data-field="action">${esc(f.action)}</textarea><label><input type="checkbox" data-index="${i}" data-field="priority" ${f.priority ? 'checked' : ''}> Feature in the three-opportunity report</label></div>`).join('');
}

function researchNoteHTML() {
  if (!researchMeta) return '';
  const when = researchMeta.reviewedAt ? new Date(researchMeta.reviewedAt).toLocaleString('en-US') : '';
  const pages = (researchMeta.pages || []).map(p => `<li>${link(p.url)}</li>`).join('');
  const errs = (researchMeta.errors || []).map(e => `<li>${esc(e.url)}: ${esc(e.message)}</li>`).join('');
  const ai = researchMeta.ai || {};
  const how = ai.used ? 'Findings below were drafted by AI from the page content of these pages' : 'Findings below were drafted by rules from the page source of these pages';
  const aiErr = !ai.used && ai.error ? `<p class="small">AI drafting was skipped: ${esc(ai.error)} Rule-based findings are shown instead.</p>` : '';
  return `<div class="note"><strong>Website research${when ? ' · ' + esc(when) : ''}.</strong> ${how}. Review and edit every finding before sharing the client report.${aiErr}<ul>${pages}</ul>${errs ? `<p class="small">Not retrieved:</p><ul>${errs}</ul>` : ''}</div>`;
}

/* ---------- Quote ---------- */
// Itemized quote built from the package, advertising figure, add-ons, hours and discount chosen on the Packages tab.
function quoteModel(c, r, t) {
  if (!t || r.pkg === null) return null;
  const p = packages[r.pkg], host = hostingOptions.find(o => Number(o.value) === c.hosting);
  const monthly = [
    [`Website hosting and care${host ? ' (' + host.label.split(' · ')[0].toLowerCase() + ')' : ''}`, money(c.hosting)],
    ['Social media management', money(p.social)], ['SEO / AEO / GEO', money(p.seo)],
    ['Strategy, creative and account management', money(p.retainer)], ['Monthly reporting', 'Included']
  ];
  if (r.pkg > 0) monthly.push(['Advertising investment (platform spend and management)', money(t.ad)]);
  const oneTime = [], tbq = [];
  for (const a of catalog.filter(x => selected.has(x.id))) {
    if (a.type === 'monthly') {
      if (a.price === null) tbq.push(`${a.name}: monthly price to be quoted`);
      else monthly.push([a.name + (a.id === 'email' && discountValue ? ' (10% ServiceTitan discount)' : ''), (a.base ? 'From ' : '') + money(a.id === 'email' && discountValue ? a.price * 0.9 : a.price)]);
      if (a.quote) tbq.push(`${a.name}: one-time setup to be quoted`);
    } else if (a.type === 'hourly') {
      if (hoursValue > 0) oneTime.push([`${a.name} (${hoursValue} hr × ${money(a.price)})`, money(a.price * hoursValue)]);
      else tbq.push(`${a.name}: ${money(a.price)}/hr, hours to be confirmed`);
    } else if (a.price === null) tbq.push(`${a.name}: to be quoted`);
    else oneTime.push([a.name, (a.base ? 'From ' : '') + money(a.price)]);
  }
  const mt = (t.monthlyFrom || t.monthlyQuoted ? 'Starting at ' : '') + money(t.total) + ' / month';
  return {
    kind: 'quote', sample, company: c.company, website: c.website,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    validDays: QUOTE_DAYS, packageName: p.name,
    intro: `Proposed monthly package: ${p.name}.${r.pkg > 0 ? ` Advertising is set at ${money(t.ad)} per month.` : ' This package does not include paid advertising.'}`,
    monthly, monthlyTotal: ['Estimated monthly total', mt],
    oneTime, oneTimeTotal: oneTime.length || t.projectFrom ? ['One-time total', (t.projectFrom ? 'From ' : '') + money(t.project)] : null,
    tbq, setup: $('setupWaived').checked ? 'Waived' : 'Confirmed during scoping', perk: p.perk || '',
    terms: QUOTE_TERMS, contact: CONTACT_EMAILS.slice(),
    sampleNote: sample ? 'Fictional sample for training. Not a real quote.' : ''
  };
}
function quoteHTML(m, print = false) {
  const rows = rs => rs.map(x => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join('');
  return `<h3 class="section">Quote preview · ${esc(m.packageName)}</h3><div class="quote"><table><thead><tr><th>Monthly</th><th>Amount</th></tr></thead><tbody>${rows(m.monthly)}<tr class="total"><td>${esc(m.monthlyTotal[0])}</td><td>${esc(m.monthlyTotal[1])}</td></tr></tbody></table>${m.oneTime.length ? `<table><thead><tr><th>One-time</th><th>Amount</th></tr></thead><tbody>${rows(m.oneTime)}${m.oneTimeTotal ? `<tr class="total"><td>${esc(m.oneTimeTotal[0])}</td><td>${esc(m.oneTimeTotal[1])}</td></tr>` : ''}</tbody></table>` : ''}${m.tbq.length ? `<p><strong>To be quoted:</strong></p><ul>${m.tbq.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p>Setup fee: <strong>${esc(m.setup)}</strong>.${m.perk ? ' ' + esc(m.perk) : ''}</p><p class="small">${esc(m.terms)} Valid for ${m.validDays} days from ${esc(m.date)}.</p></div>`;
}

const quotePreview = (c, r, t) => { const q = quoteModel(c, r, t); return q ? quoteHTML(q) : `<div class="note">${r.custom ? 'This prospect needs a scoping conversation, so no standard quote is built.' : 'Choose a package above to build the quote.'}</div>`; };
function renderPricing(c, r) {
  const t = totals(c, r);
  $('pricing').innerHTML = `<div class="eyebrow">Package fit and transparent pricing</div><h2>Choose the right starting scope.</h2><p>${esc(routeReason(c, r))}</p><div class="builder"><div class="row"><div><label for="qpkg">Package for the quote</label><select id="qpkg"><option value="auto">Suggest from context</option>${packages.map((p, i) => `<option value="${i}" ${c.packageOverride === String(i) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div><div><label for="qhost">Hosting and care</label><select id="qhost">${hostingOptions.map(o => `<option value="${esc(o.value)}" ${Number(o.value) === c.hosting ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div></div><div class="row"><div><label for="qspend">Monthly advertising investment</label><input id="qspend" type="number" min="0" step="100" value="${c.budget === null ? '' : c.budget}" placeholder="Tier minimum"></div><div><label>&nbsp;</label><button id="quotePdf" class="primary" type="button">Download quote PDF</button></div></div><p class="small">Pick a package and the quote below, and the PDF, update as you choose add-ons. Ad spend below a package minimum is raised to the minimum.</p></div><div class="note">Pricing uses the configured home services components, with advertising billed as one gross monthly figure (platform spend and management are not itemized). Totals are calculated from the components, not copied from older summaries.</div><div class="compare"><table><thead><tr><th>Package</th><th>Ad spend</th><th>Monthly total*</th></tr></thead><tbody>${packages.map((p, i) => { const low = calculate(i, c.hosting, p.min, new Set()).total, high = calculate(i, c.hosting, p.max, new Set()).total; return `<tr><td>${esc(p.name)}${r.pkg === i ? ' · Suggested' : ''}</td><td>${i === 0 ? 'None' : money(p.min) + (p.max > p.min ? '–' + money(p.max) : '')}</td><td>${money(low)}${high > low ? '–' + money(high) : ''}</td></tr>`; }).join('')}</tbody></table></div><p class="small">*Before add-ons. At ${money(c.hosting)}/month hosting and care. Ad spend above ${money(CUSTOM_SPEND)}/month requires custom scoping. All packages include reporting. Setup fee: ${$('setupWaived').checked ? 'waived' : 'not waived'} for this quote (sidebar checkbox).</p><h3 class="section">Possible add-ons</h3><p>Choose only the extras supported by the findings. Social management and SEO are already included in these packages.</p>${r.custom ? '<p class="small">For custom scope, add-on selections are discussion items. A standard-package total is not quoted.</p>' : ''}<div id="addons">${catalog.map(a => { const f = picked(); const suggested = (a.id === 'video' && f.some(x => x.id === 'video')) || (a.id === 'pages' && f.some(x => x.id === 'seo')) || (a.id === 'email' && f.some(x => x.id === 'capture')); return `<div class="addon"><input id="add-${a.id}" type="checkbox" data-addon="${a.id}" ${selected.has(a.id) ? 'checked' : ''}><label for="add-${a.id}"><strong>${esc(a.name)}${suggested ? ' · Consider based on findings' : ''}</strong><span class="price">${a.price === null ? 'Quoted separately' : (a.base ? 'From ' : '') + money(a.price) + (a.type === 'monthly' ? '/month' : a.type === 'hourly' ? '/hour' : ' one-time')}</span>${a.note ? `<div class="small">${esc(a.note)}</div>` : ''}</label></div>`; }).join('')}</div><div class="row"><div><label for="hoursCount">Creative hours</label><input id="hoursCount" type="number" min="0" step=".5" value="${hoursValue}"></div><div><label><input id="discount" type="checkbox" ${discountValue ? 'checked' : ''}> Confirmed ServiceTitan email discount</label><p class="small">10% off standalone email only. Bundle eligibility needs confirmation.</p></div></div><div id="pricingTotal">${quotePreview(c, r, t)}</div>`;
}

function outreach(c) {
  if (researchMeta && researchMeta.outreach) return researchMeta.outreach.replace(/\[Company\]/g, c.company);
  const fs = picked();
  const mentions = fs.slice(0, 2).map(f => f.name.toLowerCase()).join(' and ');
  return `Hi [Name],\n\nWe took a quick look at ${c.company}’s website${c.social.length ? ' and public social channels' : ''} using our marketing review process. ${mentions ? 'We noticed a few opportunities around ' + mentions + ' that might be useful to your team.' : 'We’d like to learn more about your marketing priorities.'}\n\nWould you have 15 minutes for us to walk you through ${mentions ? 'the findings' : 'your goals'}? We can send over a short Marketing Snapshot, too.\n\n[Salesperson]\nOswald Marketing`;
}

function renderSales(c, r) {
  const fs = picked(), unknown = findings.filter(f => f.status === 'unknown');
  $('sales').innerHTML = `<div class="eyebrow">Internal only · Never included in client printout</div><h2>Open with something useful.</h2>${sample ? '<div class="note">Training example: this outreach references fictional findings. Replace them with researched evidence before using it.</div>' : ''}<h3>${esc(c.company)}</h3>${c.website ? `<p>${link(c.website)}</p>` : ''}${c.social.length ? `<p>Social sources: ${c.social.map(link).join('<br>')}</p>` : ''}<p><strong>Depth:</strong> ${r.depth === null ? 'Pending' : esc(depths[r.depth])} · <strong>Package:</strong> ${r.custom ? 'Custom scope' : r.pkg === null ? 'Pending' : esc(packages[r.pkg].name)}</p><p>${esc(routeReason(c, r))}</p><h3 class="section">Conversation starters</h3>${fs.length ? '<ul>' + fs.map(f => `<li>${esc(f.title)} — ${esc(f.evidence)}</li>`).join('') + '</ul>' : '<p>Document at least one specific observation before drafting findings-based outreach.</p>'}<h3 class="section">Confirm on the call</h3><ul><li>Which services and markets are the highest growth priorities?</li><li>What are the current marketing budget, channels, and commitments?</li><li>Can the business handle additional inquiries and follow up promptly?</li><li>Who owns approvals, creative assets, and measurement?</li>${unknown.map(f => `<li>Confirm ${esc(f.name.toLowerCase())}; public evidence has not established it.</li>`).join('')}<li>Check one-client-per-trade territory availability internally.</li></ul><h3 class="section">Outreach draft</h3><div class="email">${esc(outreach(c))}</div><h3 class="section">Research coverage</h3><p>${findings.filter(f => f.status !== 'unknown').length} of ${findings.length} areas rated. ${findings.filter(f => f.status === 'gap' && !f.evidence.trim()).length} priority gaps lack evidence and are omitted. ${findings.filter(f => f.priority && isOpportunity(f)).length > 3 ? 'Only the first three selected evidenced opportunities appear (gaps before improvements); deselect others to change the order.' : ''}</p><p class="small">Website research reads the HTML of up to three public pages. It does not log in, view account data, estimate traffic, check rankings, play video, or read social content. Social, advertising, email, and CRM performance must be confirmed with the prospect.</p>`;
}

/* ---------- State: drafts, import, export ---------- */
function getState() {
  return {
    version: 2, mode: sample ? 'sample' : 'manual', context: context(),
    findings: findings.map(({ id, status, score, title, evidence, source, impact, action, priority }) => ({ id, status, score, title, evidence, source, impact, action, priority })),
    strength: $('strength').value, addons: [...selected], creativeHours: hoursValue, serviceTitanEmailDiscount: discountValue, setupWaived: $('setupWaived').checked, checklist: checks, research: researchMeta
  };
}
function setVal(id, v) { $(id).value = v === undefined || v === null ? '' : String(v); }
function setSelect(id, v) { const el = $(id), s = String(v ?? ''); if (!el.options || [...el.options].some(o => o.value === s)) el.value = s; }
function applyState(s) {
  if (!s || typeof s !== 'object' || !s.context || typeof s.context !== 'object' || !Array.isArray(s.findings)) throw new Error('This file is not a Marketing Snapshot assessment.');
  const c = s.context, str = (v, d) => (typeof v === 'string' ? v.slice(0, 2000) : d);
  sample = s.mode === 'sample' || s.mode === 'fictional sample';
  findings = blankFindings().map(base => {
    const m = s.findings.find(x => x && x.id === base.id);
    if (!m) return base;
    const status = ['unknown', 'strong', 'improve', 'gap'].includes(m.status) ? m.status : 'unknown';
    return { ...base, status, score: Number.isInteger(m.score) && m.score >= 0 && m.score <= 5 ? m.score : defaultScore(status), title: str(m.title, base.title), evidence: str(m.evidence, ''), source: str(m.source, ''), impact: str(m.impact, base.impact), action: str(m.action, base.action), priority: !!m.priority };
  });
  setVal('company', c.company === 'Prospective business' ? '' : str(c.company, ''));
  setVal('website', str(c.website, ''));
  $('social').value = Array.isArray(c.social) ? c.social.filter(x => typeof x === 'string').join('\n') : '';
  setSelect('industry', c.industry); setVal('markets', Math.max(1, Number(c.markets) || 1)); setSelect('goal', c.goal); setSelect('ready', c.ready);
  setVal('budget', c.budget === null || c.budget === undefined ? '' : Math.max(0, Number(c.budget) || 0));
  setSelect('hosting', c.hosting); $('complex').checked = !!c.complex;
  setSelect('depthOverride', c.depthOverride || 'auto'); setSelect('packageOverride', c.packageOverride === undefined ? 'auto' : c.packageOverride);
  $('showPricing').checked = c.showPricing !== false;
  $('setupWaived').checked = !!s.setupWaived;
  $('strength').value = str(s.strength, '');
  selected = new Set((Array.isArray(s.addons) ? s.addons : []).filter(id => catalog.some(a => a.id === id)));
  hoursValue = Math.max(0, Number(s.creativeHours) || 0); discountValue = !!s.serviceTitanEmailDiscount;
  researchMeta = s.research && typeof s.research === 'object' ? s.research : null;
  checks = {};
  if (s.checklist && typeof s.checklist === 'object') {
    for (const sec of CHECKLIST) for (const it of sec.items) {
      const m = s.checklist[it.id];
      if (m && typeof m === 'object' && ['yes', 'partial', 'no'].includes(m.v)) checks[it.id] = { v: m.v, note: typeof m.note === 'string' ? m.note.slice(0, 300) : '' };
    }
  }
}
function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(getState())); } catch { /* storage unavailable */ } }
function restoreDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return false; applyState(JSON.parse(raw)); return true; }
  catch { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } return false; }
}
const fileSlug = n => String(n || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'assessment';
const hasData = () => !!($('company').value.trim() || $('website').value.trim() || findings.some(f => f.evidence.trim()) || Object.values(checks).some(x => x.v));

function resetForm() {
  selected = new Set(); hoursValue = 0; discountValue = false; researchMeta = null; checks = {};
  for (const id of ['company', 'website', 'social', 'budget', 'strength']) $(id).value = '';
  $('industry').value = 'home'; $('goal').value = 'unknown'; $('ready').value = 'unknown'; $('depthOverride').value = 'auto'; $('packageOverride').value = 'auto';
  $('markets').value = 1; $('complex').checked = false; $('showPricing').checked = true; $('setupWaived').checked = false;
  $('researchStatus').textContent = researchHint();
}

/* ---------- Rendering ---------- */
function render() {
  const c = context(), r = recommendation(c, findings);
  $('banner').textContent = sample
    ? 'Training example: findings are fictional. Start a new assessment for a real prospect.'
    : 'Findings come from website research and manual entry. Review every finding and confirm goals, budget, and scope before sharing.';
  renderPricing(c, r);
  const m = reportModel(c, r);
  $('report').innerHTML = reportHTML(m);
  renderSales(c, r);
  $('card').innerHTML = cardHTML(cardModel(c));
  const qm = active === 'pricing' ? quoteModel(c, r, totals(c, r)) : null;
  $('printReport').innerHTML = active === 'card' ? cardHTML(cardModel(c), true) : qm ? `<div class="page"><div class="report-head"><div><div class="wordmark">OSWALD MARKETING</div><div class="eyebrow">Quote</div></div><div class="small">${esc(qm.date)}</div></div><div class="eyebrow">Prepared for ${esc(qm.company)}</div><p>${esc(qm.intro)}</p>${quoteHTML(qm)}<p class="section">Accepted by: ______________________ &nbsp; Date: ____________</p></div>` : reportHTML(m, true);
  $('researchNote').innerHTML = researchNoteHTML();
  saveDraft();
}
function toast(t) { $('toast').textContent = t; $('toast').style.display = 'block'; setTimeout(() => { $('toast').style.display = 'none'; }, 3000); }
function showTab(t) {
  active = t;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  for (const id of ['report', 'card', 'research', 'checklist', 'pricing', 'sales']) $(id).classList.toggle('hide', id !== t);
  $('pdf').textContent = t === 'pricing' ? 'Download quote PDF' : t === 'card' ? 'Download report card PDF' : 'Download PDF';
  render();
}

/* ---------- Boot and sign-in ---------- */
function showApp() { $('loading').classList.toggle('hide', true); $('login').classList.toggle('hide', true); $('app').classList.toggle('hide', false); $('logout').classList.toggle('hide', false); }
function showLogin(msg) {
  $('loading').classList.toggle('hide', true); $('app').classList.toggle('hide', true); $('logout').classList.toggle('hide', true); $('login').classList.toggle('hide', false);
  $('loginError').textContent = msg || '';
}
function boot() {
  $('hosting').innerHTML = hostingOptions.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  $('hosting').value = String(hostingOptions[0].value);
  findings = blankFindings();
  restoreDraft();
  renderEditor(); render(); showApp();
}
async function start() {
  const r = await fetch('/api/config', { credentials: 'same-origin' });
  if (r.status === 401) return showLogin('');
  if (!r.ok) throw new Error('config');
  applyConfig(await r.json());
  boot();
  $('researchStatus').textContent = researchHint();
}
async function init() {
  try {
    const s = await (await fetch('/api/session', { credentials: 'same-origin' })).json();
    if (!s.configured) return showLogin('Sign-in is not configured on the server yet. See the README for the required environment variables.');
    if (s.authenticated) { aiEnabled = !!s.ai; await start(); } else showLogin('');
  } catch { showLogin('Could not reach the server. Check your connection and reload.'); }
}

/* ---------- Research ---------- */
function applyResearch(data) {
  sample = false;
  const prios = Array.isArray(data.priorities) ? data.priorities : [];
  const ai = data.ai && typeof data.ai === 'object' ? data.ai : { used: false };
  for (const r of data.findings || []) {
    const f = findings.find(x => x.id === r.id);
    if (!f || !['unknown', 'strong', 'improve', 'gap'].includes(r.status)) continue;
    const base = blankFindings().find(x => x.id === r.id) || f;
    f.status = r.status; f.evidence = String(r.evidence || '').slice(0, 1000); f.source = String(r.source || '');
    f.score = Number.isInteger(r.score) && r.score >= 0 && r.score <= 5 ? r.score : defaultScore(r.status);
    f.title = typeof r.title === 'string' && r.title ? r.title.slice(0, 200) : base.title;
    f.impact = typeof r.impact === 'string' && r.impact ? r.impact.slice(0, 600) : base.impact;
    f.action = typeof r.action === 'string' && r.action ? r.action.slice(0, 600) : base.action;
    f.priority = false;
  }
  // Feature the AI's top priorities when they are valid; otherwise the first three gaps, then improvements.
  const ranked = findings.filter(isOpportunity).sort((a, b) => (a.status === b.status ? 0 : a.status === 'gap' ? -1 : 1));
  const chosen = prios.map(id => ranked.find(f => f.id === id)).filter(Boolean);
  for (const f of (chosen.length ? chosen : ranked).slice(0, 3)) f.priority = true;
  researchMeta = {
    reviewedAt: data.reviewedAt, pages: data.pages || [], errors: data.errors || [],
    ai: { used: !!ai.used, model: ai.model ? String(ai.model) : undefined, error: ai.error ? String(ai.error) : undefined },
    outreach: ai.used && typeof data.outreach === 'string' ? data.outreach.slice(0, 1500) : undefined
  };
  if (!$('social').value.trim() && data.socialLinks && data.socialLinks.length) $('social').value = data.socialLinks.join('\n');
  if (!$('strength').value.trim()) {
    const strong = (data.findings || []).find(x => x.status === 'strong');
    const text = typeof data.strength === 'string' && data.strength ? data.strength : strong ? strong.evidence : '';
    if (text) $('strength').value = text;
  }
}
async function runResearch() {
  const site = $('website').value.trim();
  if (!site) { toast('Enter the prospect’s website first.'); return; }
  if (findings.some(f => f.evidence.trim() || f.status !== 'unknown') && !ask('Research will replace the findings entered so far. Continue?')) return;
  const btn = $('runResearch'); btn.disabled = true;
  $('researchStatus').textContent = 'Reviewing public pages… this can take up to a minute.';
  try {
    const resp = await fetch('/api/research', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website: site, company: $('company').value.trim() }) });
    if (resp.status === 401) { showLogin('Your session expired. Sign in again; your work is saved in this browser.'); return; }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || (resp.status === 504 || resp.status === 502 ? 'The research took too long and was stopped (HTTP ' + resp.status + '). Try again; if it keeps happening, turn off AI drafting by removing the API key, or ask for help.' : `Research failed (HTTP ${resp.status}). Check the function logs in Vercel.`));
    applyResearch(data);
    renderEditor(); render(); showTab('research');
    $('researchStatus').textContent = `Reviewed ${data.pages.length} page${data.pages.length === 1 ? '' : 's'}. ${data.ai && data.ai.used ? 'Findings and outreach drafted by AI. ' : data.ai && data.ai.error ? 'AI drafting was unavailable, so rule-based findings are shown. ' : ''}Check each finding before sharing the report.`;
  } catch (e) { $('researchStatus').textContent = e instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : e.message || 'Research failed.'; }
  finally { btn.disabled = false; }
}

/* ---------- Events ---------- */
function setCheck(el) {
  const id = el.dataset.ck || el.dataset.ckn, cur = checks[id] || { v: '', note: '' };
  if (el.dataset.ck) cur.v = ['yes', 'partial', 'no'].includes(el.value) ? el.value : '';
  else cur.note = el.value.slice(0, 300);
  if (cur.v || cur.note) checks[id] = cur; else delete checks[id];
}
function setField(el) {
  const f = findings[Number(el.dataset.index)];
  if (el.dataset.field === 'score') f.score = Math.max(0, Math.min(5, Number(el.value) || 0));
  else { f[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.field === 'status') f.score = defaultScore(f.status); }
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field) setField(el);
  if (el.dataset.ck || el.dataset.ckn) { setCheck(el); if (el.dataset.ckn) { render(); } return; }
  if (el.id === 'hoursCount') {
    hoursValue = Math.max(0, Number(el.value) || 0);
    const c = context(), r = recommendation(c, findings), t = totals(c, r);
    $('pricingTotal').innerHTML = quotePreview(c, r, t);
    const m = reportModel(c, r);
    $('report').innerHTML = reportHTML(m); $('printReport').innerHTML = reportHTML(m, true); saveDraft();
    return;
  }
  if (el.closest('aside') || el.dataset.field || el.id === 'strength') render();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.addon) {
    const a = catalog.find(x => x.id === el.dataset.addon);
    if (el.checked) { if (a.group) for (const o of catalog.filter(x => x.group === a.group)) selected.delete(o.id); selected.add(a.id); } else selected.delete(a.id);
    render();
  }
  if (el.dataset.ck) { setCheck(el); renderChecklist(); render(); }
  if (el.id === 'qpkg') { $('packageOverride').value = el.value; render(); }
  if (el.id === 'qhost') { $('hosting').value = el.value; render(); }
  if (el.id === 'qspend') { $('budget').value = el.value; render(); }
  if (el.id === 'discount') { discountValue = el.checked; render(); }
  if (el.dataset.field) { setField(el); if (el.dataset.field === 'status') renderEditor(); render(); }
});
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'quotePdf') downloadPdf();
  if (e.target && e.target.id === 'clearChecks' && ask('Clear every checklist answer?')) { checks = {}; renderChecklist(); render(); }
});
document.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

$('generate').onclick = () => { render(); toast('All outputs updated'); };
$('runResearch').onclick = runResearch;
async function downloadPdf() {
  render();
  const c = context(), r = recommendation(c, findings), btn = $('pdf');
  btn.disabled = true;
  try {
    const card = active === 'card', quote = active === 'pricing';
    let model;
    if (quote) { const t = totals(c, r); model = quoteModel(c, r, t); if (!model) { toast(r.custom ? 'Custom scope: no standard quote.' : 'Choose a package first.'); return; } }
    else model = card ? cardModel(c) : reportModel(c, r);
    const resp = await fetch('/api/pdf', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) });
    if (resp.status === 401) { showLogin('Your session expired. Sign in again; your work is saved in this browser.'); return; }
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.error || 'The PDF could not be created.'); }
    const url = URL.createObjectURL(await resp.blob());
    const a = document.createElement('a'); a.href = url; a.download = `${quote ? 'Quote' : card ? 'Marketing-Report-Card' : 'Marketing-Snapshot'}-${fileSlug(c.company)}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('PDF downloaded');
  } catch (e) { toast(e.message || 'The PDF could not be created.'); }
  finally { btn.disabled = false; }
}
$('pdf').onclick = downloadPdf;
$('print').onclick = () => {
  render();
  const prev = document.title;
  document.title = `Marketing Snapshot - ${context().company}`;
  window.addEventListener('afterprint', () => { document.title = prev; }, { once: true });
  try { window.print(); } catch { toast('Use your browser’s print command to save a PDF.'); }
};
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(outreach(context())); toast('Outreach copied'); } catch { toast('Copy the draft from the Sales brief tab.'); } };
$('download').onclick = () => {
  const c = context(), r = recommendation(c, findings);
  const data = { ...getState(), generatedAt: new Date().toISOString(), recommendation: r, pricing: totals(c, r), outreach: outreach(c) };
  const name = fileSlug(c.company);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `Oswald-Snapshot-${name}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async () => {
  const input = $('importFile'), file = input.files && input.files[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw new Error('That file is too large to be an assessment.');
    if (hasData() && !ask('Importing replaces the current assessment. Continue?')) return;
    applyState(JSON.parse(await file.text()));
    renderEditor(); render(); toast('Assessment imported');
  } catch (e) { toast(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message || 'Import failed.'); }
  finally { input.value = ''; }
};
$('blank').onclick = () => {
  if (hasData() && !ask('Start a new assessment? The current one will be cleared. Export it first if you need it.')) return;
  sample = false; resetForm(); findings = blankFindings(); renderEditor(); render(); showTab('report'); toast('New assessment ready');
};
$('sample').onclick = () => {
  if (hasData() && !ask('Load the training example? The current assessment will be replaced.')) return;
  sample = true; resetForm(); findings = exampleFindings(); checks = JSON.parse(JSON.stringify(SAMPLE_CHECKLIST));
  $('company').value = 'Example Home Services'; $('website').value = 'https://example.com'; $('budget').value = 2500; $('goal').value = 'growth'; $('ready').value = 'yes';
  $('strength').value = 'The example business presents its core services clearly on the homepage.';
  renderEditor(); render();
};
$('loginForm').onsubmit = async e => {
  e.preventDefault();
  $('loginError').textContent = '';
  try {
    const r = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: $('password').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $('loginError').textContent = d.error || 'Sign-in failed.'; return; }
    $('password').value = '';
    await start();
  } catch { $('loginError').textContent = 'Could not reach the server.'; }
};
$('logout').onclick = async () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* ignore */ }
  location.reload();
};

if (typeof window !== 'undefined') init();
