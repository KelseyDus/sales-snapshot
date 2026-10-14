// Marketing Snapshot: rendering, recommendation logic, research, drafts, exports.
// Pricing and review categories arrive from /api/config after sign-in; none are shipped in this file.
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const ask = m => (typeof confirm === 'function' ? confirm(m) : true);
const DRAFT_KEY = 'oswald-snapshot-draft-v2';

let packages = [], depths = [], descriptions = [], catalog = [], areas = [], hostingOptions = [], sampleFindings = {};
let CONTACT_EMAILS = [], SETUP_NOTE = '', MEDIA_FEE_RATE = 0.2, CUSTOM_SPEND = 10000;
let sample = false, active = 'report', selected = new Set(), findings = [], hoursValue = 0, discountValue = false, researchMeta = null;

function applyConfig(c) {
  packages = c.packages; depths = c.depths; descriptions = c.descriptions; catalog = c.catalog; areas = c.areas;
  hostingOptions = c.hostingOptions; sampleFindings = c.sampleFindings || {}; CONTACT_EMAILS = c.contactEmails || [];
  SETUP_NOTE = c.setupNote || ''; MEDIA_FEE_RATE = c.mediaFeeRate; CUSTOM_SPEND = c.customSpendThreshold;
}
const blankFindings = () => areas.map(a => ({ ...a, status: 'unknown', priority: false, evidence: '', source: '', impact: a.why, action: a.next }));
const exampleFindings = () => areas.map(a => {
  const s = sampleFindings[a.id] || {}, status = s.status || 'unknown';
  return { ...a, status, priority: status === 'gap', evidence: s.evidence || '', source: '', impact: a.why, action: a.next };
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
  const observed = fs.filter(f => f.status === 'gap' && f.evidence.trim());
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
  const fee = ad * MEDIA_FEE_RATE;
  let monthly = 0, project = 0, unquoted = false, from = false, monthlyQuoted = false, projectQuoted = false, monthlyFrom = false, projectFrom = false;
  for (const a of catalog.filter(a => ids.has(a.id))) {
    if (a.price === null) { unquoted = true; if (a.type === 'monthly') monthlyQuoted = true; else projectQuoted = true; }
    if (a.quote) { unquoted = true; projectQuoted = true; }
    if (a.base) { from = true; if (a.type === 'monthly') monthlyFrom = true; else projectFrom = true; }
    let cost = a.price ?? 0;
    if (a.id === 'email' && discount) cost *= 0.9;
    if (a.type === 'monthly') monthly += cost; else if (a.type === 'project') project += cost; else project += cost * Math.max(0, hours);
  }
  return { services, ad, fee, monthly, project, total: services + ad + fee + monthly, unquoted, from, monthlyQuoted, projectQuoted, monthlyFrom, projectFrom };
}

const picked = () => findings.filter(f => f.priority && f.status === 'gap' && f.evidence.trim()).slice(0, 3);
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
  const p = packages[r.pkg], feePct = Math.round(MEDIA_FEE_RATE * 100);
  const rows = [['Hosting and care', money(c.hosting)], ['Social media management', money(p.social)], ['SEO / AEO / GEO', money(p.seo)], ['Strategy, creative, account management', money(p.retainer)], ['Advertising spend paid to platforms', money(t.ad)], [`Media management · ${feePct}%`, money(t.fee)]];
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
  const intro = `<div class="report-head"><div><div class="wordmark">OSWALD MARKETING</div><div class="eyebrow">Complimentary Marketing Snapshot</div></div><div class="small">${esc(m.date)}<br>${esc(m.label)}</div></div><div class="eyebrow">Prepared for ${esc(m.company)}</div><h1 class="report-title">A few opportunities<br>worth a conversation.</h1>${m.website ? `<p>${link(m.website)}</p>` : ''}<p>${esc(m.intro)}</p>${m.sampleNote ? `<div class="note"><strong>Sample report:</strong> ${esc(m.sampleNote)}</div>` : ''}${m.strength ? `<h3 class="section">What is already working</h3><p>${esc(m.strength)}</p>` : ''}<div class="stats">${m.stats.map(s => `<div class="stat"><strong>${esc(s[0])}</strong>${esc(s[1])}</div>`).join('')}</div>`;
  const opportunities = `<h2>Opportunities to explore</h2>${m.findings.length ? m.findings.map(evidenceHTML).join('') : '<div class="empty">No evidenced priority findings yet. Add your observations in the findings editor.</div>'}`;
  const next = `<h2 class="section">A practical starting direction</h2><div class="depths">${m.depths.map(d => `<div class="depth ${d.selected ? 'selected' : ''}"><strong>${esc(d.name)}</strong>${esc(d.desc)}</div>`).join('')}</div><p>${m.direction.lead ? `<strong>${esc(m.direction.lead)}</strong> ` : ''}${esc(m.direction.text)}</p>${m.foundationNote ? `<p>${esc(m.foundationNote)}</p>` : ''}<p>${esc(m.routeReason)}</p>${m.pricing ? priceHTML(m.pricing) : ''}<div class="note"><h3>${esc(m.cta.heading)}</h3><p>${esc(m.cta.body)}</p><p><strong>${m.contact.map(esc).join(' · ')}</strong></p></div><div class="footer">${esc(m.footer)}</div>`;
  return print ? `<div class="page">${intro}</div><div class="page">${opportunities}</div><div class="page">${next}</div>` : intro + opportunities + next;
}

function renderEditor() {
  $('reviews').innerHTML = findings.map((f, i) => `<div class="review"><h3>${esc(f.name)}</h3><div class="row"><div><label for="status${i}">Status</label><select id="status${i}" data-field="status" data-index="${i}"><option value="unknown" ${f.status === 'unknown' ? 'selected' : ''}>Unknown</option><option value="strong" ${f.status === 'strong' ? 'selected' : ''}>Strong</option><option value="improve" ${f.status === 'improve' ? 'selected' : ''}>Needs improvement</option><option value="gap" ${f.status === 'gap' ? 'selected' : ''}>Priority gap</option></select></div><div><label for="title${i}">Client-facing opportunity title</label><input id="title${i}" data-index="${i}" data-field="title" value="${esc(f.title)}"></div></div><label for="ev${i}">Observed evidence</label><textarea id="ev${i}" data-index="${i}" data-field="evidence" placeholder="Describe what you actually observed">${esc(f.evidence)}</textarea><label for="source${i}">Evidence URL</label><input id="source${i}" data-index="${i}" data-field="source" value="${esc(f.source)}"><label for="impact${i}">Why it matters</label><textarea id="impact${i}" data-index="${i}" data-field="impact">${esc(f.impact)}</textarea><label for="action${i}">Practical next step</label><textarea id="action${i}" data-index="${i}" data-field="action">${esc(f.action)}</textarea><label><input type="checkbox" data-index="${i}" data-field="priority" ${f.priority ? 'checked' : ''}> Feature in the three-opportunity report</label></div>`).join('');
}

function researchNoteHTML() {
  if (!researchMeta) return '';
  const when = researchMeta.reviewedAt ? new Date(researchMeta.reviewedAt).toLocaleString('en-US') : '';
  const pages = (researchMeta.pages || []).map(p => `<li>${link(p.url)}</li>`).join('');
  const errs = (researchMeta.errors || []).map(e => `<li>${esc(e.url)}: ${esc(e.message)}</li>`).join('');
  return `<div class="note"><strong>Website research${when ? ' · ' + esc(when) : ''}.</strong> Findings below were drafted from the page source of these pages. Review and edit every finding before sharing the client report.<ul>${pages}</ul>${errs ? `<p class="small">Not retrieved:</p><ul>${errs}</ul>` : ''}</div>`;
}

function renderPricing(c, r) {
  const t = totals(c, r), feePct = Math.round(MEDIA_FEE_RATE * 100);
  $('pricing').innerHTML = `<div class="eyebrow">Package fit and transparent pricing</div><h2>Choose the right starting scope.</h2><p>${esc(routeReason(c, r))}</p><div class="note">Pricing uses the configured home services components, with a fixed ${feePct}% media fee. Totals are calculated from the components, not copied from older summaries.</div><div class="compare"><table><thead><tr><th>Package</th><th>Ad spend</th><th>Monthly total*</th></tr></thead><tbody>${packages.map((p, i) => { const low = calculate(i, c.hosting, p.min, new Set()).total, high = calculate(i, c.hosting, p.max, new Set()).total; return `<tr><td>${esc(p.name)}${r.pkg === i ? ' · Suggested' : ''}</td><td>${i === 0 ? 'None' : money(p.min) + (p.max > p.min ? '–' + money(p.max) : '')}</td><td>${money(low)}${high > low ? '–' + money(high) : ''}</td></tr>`; }).join('')}</tbody></table></div><p class="small">*Before add-ons. At ${money(c.hosting)}/month hosting and care. Ad spend above ${money(CUSTOM_SPEND)}/month requires custom scoping. All packages include reporting. Setup fee: ${$('setupWaived').checked ? 'waived' : 'not waived'} for this quote (sidebar checkbox).</p><h3 class="section">Possible add-ons</h3><p>Choose only the extras supported by the findings. Social management and SEO are already included in these packages.</p>${r.custom ? '<p class="small">For custom scope, add-on selections are discussion items. A standard-package total is not quoted.</p>' : ''}<div id="addons">${catalog.map(a => { const f = picked(); const suggested = (a.id === 'video' && f.some(x => x.id === 'video')) || (a.id === 'pages' && f.some(x => x.id === 'seo')) || (a.id === 'email' && f.some(x => x.id === 'capture')); return `<div class="addon"><input id="add-${a.id}" type="checkbox" data-addon="${a.id}" ${selected.has(a.id) ? 'checked' : ''}><label for="add-${a.id}"><strong>${esc(a.name)}${suggested ? ' · Consider based on findings' : ''}</strong><span class="price">${a.price === null ? 'Quoted separately' : (a.base ? 'From ' : '') + money(a.price) + (a.type === 'monthly' ? '/month' : a.type === 'hourly' ? '/hour' : ' one-time')}</span>${a.note ? `<div class="small">${esc(a.note)}</div>` : ''}</label></div>`; }).join('')}</div><div class="row"><div><label for="hoursCount">Creative hours</label><input id="hoursCount" type="number" min="0" step=".5" value="${hoursValue}"></div><div><label><input id="discount" type="checkbox" ${discountValue ? 'checked' : ''}> Confirmed ServiceTitan email discount</label><p class="small">10% off standalone email only. Bundle eligibility needs confirmation.</p></div></div><div id="pricingTotal">${t ? priceHTML(priceModel(c, r, t)) : '<div class="note">Confirm context or choose a package to calculate a total. Custom prospects require separate scoping.</div>'}</div>`;
}

function outreach(c) {
  const fs = picked();
  const mentions = fs.slice(0, 2).map(f => f.name.toLowerCase()).join(' and ');
  return `Hi [Name],\n\nWe took a quick look at ${c.company}’s website${c.social.length ? ' and public social channels' : ''} using our marketing review process. ${mentions ? 'We noticed a few opportunities around ' + mentions + ' that might be useful to your team.' : 'We’d like to learn more about your marketing priorities.'}\n\nWould you have 15 minutes for us to walk you through ${mentions ? 'the findings' : 'your goals'}? We can send over a short Marketing Snapshot, too.\n\n[Salesperson]\nOswald Marketing`;
}

function renderSales(c, r) {
  const fs = picked(), unknown = findings.filter(f => f.status === 'unknown');
  $('sales').innerHTML = `<div class="eyebrow">Internal only · Never included in client printout</div><h2>Open with something useful.</h2>${sample ? '<div class="note">Training example: this outreach references fictional findings. Replace them with researched evidence before using it.</div>' : ''}<h3>${esc(c.company)}</h3>${c.website ? `<p>${link(c.website)}</p>` : ''}${c.social.length ? `<p>Social sources: ${c.social.map(link).join('<br>')}</p>` : ''}<p><strong>Depth:</strong> ${r.depth === null ? 'Pending' : esc(depths[r.depth])} · <strong>Package:</strong> ${r.custom ? 'Custom scope' : r.pkg === null ? 'Pending' : esc(packages[r.pkg].name)}</p><p>${esc(routeReason(c, r))}</p><h3 class="section">Conversation starters</h3>${fs.length ? '<ul>' + fs.map(f => `<li>${esc(f.title)} — ${esc(f.evidence)}</li>`).join('') + '</ul>' : '<p>Document at least one specific observation before drafting findings-based outreach.</p>'}<h3 class="section">Confirm on the call</h3><ul><li>Which services and markets are the highest growth priorities?</li><li>What are the current marketing budget, channels, and commitments?</li><li>Can the business handle additional inquiries and follow up promptly?</li><li>Who owns approvals, creative assets, and measurement?</li>${unknown.map(f => `<li>Confirm ${esc(f.name.toLowerCase())}; public evidence has not established it.</li>`).join('')}<li>Check one-client-per-trade territory availability internally.</li></ul><h3 class="section">Outreach draft</h3><div class="email">${esc(outreach(c))}</div><h3 class="section">Research coverage</h3><p>${findings.filter(f => f.status !== 'unknown').length} of ${findings.length} areas rated. ${findings.filter(f => f.status === 'gap' && !f.evidence.trim()).length} priority gaps lack evidence and are omitted. ${findings.filter(f => f.priority && f.status === 'gap' && f.evidence.trim()).length > 3 ? 'Only the first three selected evidenced gaps appear; deselect others to change the order.' : ''}</p><p class="small">Website research reads the HTML of up to three public pages. It does not log in, view account data, estimate traffic, check rankings, play video, or read social content. Social, advertising, email, and CRM performance must be confirmed with the prospect.</p>`;
}

/* ---------- State: drafts, import, export ---------- */
function getState() {
  return {
    version: 2, mode: sample ? 'sample' : 'manual', context: context(),
    findings: findings.map(({ id, status, title, evidence, source, impact, action, priority }) => ({ id, status, title, evidence, source, impact, action, priority })),
    strength: $('strength').value, addons: [...selected], creativeHours: hoursValue, serviceTitanEmailDiscount: discountValue, setupWaived: $('setupWaived').checked, research: researchMeta
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
    return { ...base, status: ['unknown', 'strong', 'improve', 'gap'].includes(m.status) ? m.status : 'unknown', title: str(m.title, base.title), evidence: str(m.evidence, ''), source: str(m.source, ''), impact: str(m.impact, base.impact), action: str(m.action, base.action), priority: !!m.priority };
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
}
function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(getState())); } catch { /* storage unavailable */ } }
function restoreDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return false; applyState(JSON.parse(raw)); return true; }
  catch { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } return false; }
}
const fileSlug = n => String(n || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'assessment';
const hasData = () => !!($('company').value.trim() || $('website').value.trim() || findings.some(f => f.evidence.trim()));

function resetForm() {
  selected = new Set(); hoursValue = 0; discountValue = false; researchMeta = null;
  for (const id of ['company', 'website', 'social', 'budget', 'strength']) $(id).value = '';
  $('industry').value = 'home'; $('goal').value = 'unknown'; $('ready').value = 'unknown'; $('depthOverride').value = 'auto'; $('packageOverride').value = 'auto';
  $('markets').value = 1; $('complex').checked = false; $('showPricing').checked = true; $('setupWaived').checked = false;
  $('researchStatus').textContent = 'Reviews up to three public pages and drafts evidence-based findings. You review them before anything reaches the client report.';
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
  $('printReport').innerHTML = reportHTML(m, true);
  $('researchNote').innerHTML = researchNoteHTML();
  saveDraft();
}
function toast(t) { $('toast').textContent = t; $('toast').style.display = 'block'; setTimeout(() => { $('toast').style.display = 'none'; }, 3000); }
function showTab(t) {
  active = t;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  for (const id of ['report', 'research', 'pricing', 'sales']) $(id).classList.toggle('hide', id !== t);
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
}
async function init() {
  try {
    const s = await (await fetch('/api/session', { credentials: 'same-origin' })).json();
    if (!s.configured) return showLogin('Sign-in is not configured on the server yet. See the README for the required environment variables.');
    if (s.authenticated) await start(); else showLogin('');
  } catch { showLogin('Could not reach the server. Check your connection and reload.'); }
}

/* ---------- Research ---------- */
function applyResearch(data) {
  sample = false;
  for (const r of data.findings || []) {
    const f = findings.find(x => x.id === r.id);
    if (!f || !['unknown', 'strong', 'improve', 'gap'].includes(r.status)) continue;
    f.status = r.status; f.evidence = String(r.evidence || '').slice(0, 1000); f.source = String(r.source || '');
    f.priority = f.status === 'gap' && !!f.evidence;
  }
  researchMeta = { reviewedAt: data.reviewedAt, pages: data.pages || [], errors: data.errors || [] };
  if (!$('social').value.trim() && data.socialLinks && data.socialLinks.length) $('social').value = data.socialLinks.join('\n');
  const strong = (data.findings || []).find(x => x.status === 'strong');
  if (strong && !$('strength').value.trim()) $('strength').value = strong.evidence;
}
async function runResearch() {
  const site = $('website').value.trim();
  if (!site) { toast('Enter the prospect’s website first.'); return; }
  if (findings.some(f => f.evidence.trim() || f.status !== 'unknown') && !ask('Research will replace the findings entered so far. Continue?')) return;
  const btn = $('runResearch'); btn.disabled = true;
  $('researchStatus').textContent = 'Reviewing public pages… this can take up to 30 seconds.';
  try {
    const resp = await fetch('/api/research', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website: site }) });
    if (resp.status === 401) { showLogin('Your session expired. Sign in again; your work is saved in this browser.'); return; }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Research failed.');
    applyResearch(data);
    renderEditor(); render(); showTab('research');
    $('researchStatus').textContent = `Reviewed ${data.pages.length} page${data.pages.length === 1 ? '' : 's'}. Check each finding before sharing the report.`;
  } catch (e) { $('researchStatus').textContent = e.message || 'Research failed.'; }
  finally { btn.disabled = false; }
}

/* ---------- Events ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field) { findings[Number(el.dataset.index)][el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value; }
  if (el.id === 'hoursCount') {
    hoursValue = Math.max(0, Number(el.value) || 0);
    const c = context(), r = recommendation(c, findings), t = totals(c, r);
    $('pricingTotal').innerHTML = t ? priceHTML(priceModel(c, r, t)) : '';
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
  if (el.id === 'discount') { discountValue = el.checked; render(); }
  if (el.dataset.field) { findings[Number(el.dataset.index)][el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value; render(); }
});
document.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

$('generate').onclick = () => { render(); toast('All outputs updated'); };
$('runResearch').onclick = runResearch;
async function downloadPdf() {
  render();
  const c = context(), r = recommendation(c, findings), btn = $('pdf');
  btn.disabled = true;
  try {
    const resp = await fetch('/api/pdf', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: reportModel(c, r) }) });
    if (resp.status === 401) { showLogin('Your session expired. Sign in again; your work is saved in this browser.'); return; }
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.error || 'The PDF could not be created.'); }
    const url = URL.createObjectURL(await resp.blob());
    const a = document.createElement('a'); a.href = url; a.download = `Marketing-Snapshot-${fileSlug(c.company)}.pdf`; a.click();
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
  sample = true; resetForm(); findings = exampleFindings();
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
