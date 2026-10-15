'use strict';
// Builds the client report PDF from the same structured model the on-screen report uses.
// Standard PDF fonts only (Helvetica, Times), so text is real, selectable text and no browser is needed.
const PDFDocument = require('pdfkit');
// pdfkit loads its built-in fonts through dynamic requires that Vercel's file tracing cannot see.
// Requiring them explicitly here makes sure they are shipped with the function.
require('pdfkit/standard-fonts/Helvetica');
require('pdfkit/standard-fonts/HelveticaBold');
require('pdfkit/standard-fonts/HelveticaOblique');
require('pdfkit/standard-fonts/HelveticaBoldOblique');
require('pdfkit/standard-fonts/TimesRoman');
require('pdfkit/standard-fonts/TimesBold');
require('pdfkit/standard-fonts/TimesItalic');
require('pdfkit/standard-fonts/TimesBoldItalic');

const C = { navy: '#0a1628', ink: '#1b3a4b', teal: '#2e6b7c', pale: '#e8f0ef', line: '#d7e2e3', muted: '#5f737c', white: '#ffffff' };
// Standard fonts use WinAnsi: keep Latin-1 plus the common Windows-1252 punctuation, replace anything else.
const EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
const clean = (v, max = 600) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
  .split('').map(ch => { const cp = ch.codePointAt(0); return cp <= 0xff || EXTRA.has(ch) ? ch : '?'; }).join('').slice(0, max);
const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
const pair = (p, n = 120) => [clean(p && p[0], n), clean(p && p[1], n)];

function sanitize(m) {
  const s = clean;
  const pr = m.pricing && typeof m.pricing === 'object' ? m.pricing : null;
  return {
    sample: !!m.sample, company: s(m.company, 120), website: s(m.website, 200), date: s(m.date, 40), label: s(m.label, 80),
    intro: s(m.intro, 600), sampleNote: s(m.sampleNote, 200), strength: s(m.strength, 1000),
    stats: arr(m.stats, 3).map(x => pair(x, 60)),
    findings: arr(m.findings, 3).map(f => ({ area: s(f && f.area, 100), title: s(f && f.title, 200), observed: s(f && f.observed, 1000), source: s(f && f.source, 300), why: s(f && f.why, 600), next: s(f && f.next, 600) })),
    depths: arr(m.depths, 4).map(d => ({ name: s(d && d.name, 40), desc: s(d && d.desc, 100), selected: !!(d && d.selected) })),
    direction: { lead: s(m.direction && m.direction.lead, 60), text: s(m.direction && m.direction.text, 400) },
    foundationNote: s(m.foundationNote, 300), routeReason: s(m.routeReason, 500),
    pricing: pr ? {
      title: s(pr.title, 120), rows: arr(pr.rows, 14).map(r => pair(r)), total: pair(pr.total), project: pair(pr.project),
      setup: pr.setup ? pair(pr.setup) : null, extras: s(pr.extras, 600), note: s(pr.note, 900)
    } : null,
    cta: { heading: s(m.cta && m.cta.heading, 120), body: s(m.cta && m.cta.body, 300) },
    contact: arr(m.contact, 5).map(x => s(x, 100)), footer: s(m.footer, 900)
  };
}

function draw(doc, m) {
  const L = 54, W = doc.page.width - 108, BOTTOM = () => doc.page.height - 66;
  const need = h => { if (doc.y + h > BOTTOM()) doc.addPage(); };
  const eyebrow = (t, color = C.teal) => doc.font('Helvetica-Bold').fontSize(8).fillColor(color).text(t.toUpperCase(), L, doc.y, { characterSpacing: 1.5, width: W });
  const para = (t, o = {}) => doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 10.5).fillColor(o.color || C.ink).text(t, L, doc.y, { width: W, lineGap: 2 });
  const labeled = (label, text) => {
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text(label + ' ', L, doc.y, { width: W, lineGap: 2, continued: true });
    doc.font('Helvetica').text(text, { lineGap: 2 });
  };
  const hOf = (t, size = 10.5, font = 'Helvetica', width = W) => { doc.font(font).fontSize(size); return doc.heightOfString(t, { width, lineGap: 2 }); };
  const h2 = t => { need(70); doc.moveDown(0.5); doc.font('Times-Bold').fontSize(20).fillColor(C.ink).text(t, L, doc.y, { width: W }); doc.moveDown(0.4); };
  const h3 = t => { need(40); doc.font('Times-Bold').fontSize(13).fillColor(C.ink).text(t, L, doc.y, { width: W }); doc.moveDown(0.3); };

  // Masthead
  const top = 54;
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(m.date, L + W - 260, top, { width: 260, align: 'right' });
  doc.text(m.label, L + W - 260, doc.y, { width: 260, align: 'right' });
  const yR = doc.y;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.ink).text('OSWALD MARKETING', L, top, { characterSpacing: 3, width: 260 });
  eyebrow('Complimentary Marketing Snapshot');
  const yRule = Math.max(yR, doc.y) + 10;
  doc.moveTo(L, yRule).lineTo(L + W, yRule).lineWidth(1.5).strokeColor(C.ink).stroke();
  doc.y = yRule + 18;

  eyebrow('Prepared for ' + m.company);
  doc.moveDown(0.5);
  doc.font('Times-Bold').fontSize(28).fillColor(C.ink).text('A few opportunities\nworth a conversation.', L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.6);
  if (m.website) { doc.font('Helvetica').fontSize(10.5).fillColor(C.teal).text(m.website, L, doc.y, { width: W }); doc.moveDown(0.5); }
  para(m.intro); doc.moveDown(0.6);
  if (m.sampleNote) {
    const t = 'Sample report: ' + m.sampleNote, h = hOf(t, 10, 'Helvetica', W - 24) + 20, y = doc.y;
    need(h); doc.rect(L, doc.y, W, h).fill(C.pale); doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(t, L + 12, y + 10, { width: W - 24 }); doc.y = y + h + 12;
  }
  if (m.strength) { h3('What is already working'); para(m.strength); doc.moveDown(0.6); }

  need(80);
  const bw = (W - 24) / 3, sy = doc.y;
  m.stats.forEach(([val, label], i) => {
    const x = L + i * (bw + 12);
    doc.roundedRect(x, sy, bw, 60, 5).lineWidth(0.8).strokeColor(C.line).stroke();
    let fs = 16; doc.font('Helvetica-Bold');
    while (fs > 8 && doc.fontSize(fs).widthOfString(val) > bw - 20) fs -= 0.5;
    doc.fontSize(fs).fillColor(C.teal).text(val, x + 10, sy + 11 + (16 - fs) / 2, { width: bw - 20, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.ink).text(label, x + 10, sy + 36, { width: bw - 20, lineBreak: false });
  });
  doc.y = sy + 74;

  // Opportunities
  h2('Opportunities to explore');
  if (!m.findings.length) {
    const t = 'No evidenced priority findings yet.', y = doc.y; need(44);
    doc.roundedRect(L, doc.y, W, 36, 5).dash(3, { space: 3 }).lineWidth(0.8).strokeColor(C.line).stroke().undash();
    doc.font('Helvetica').fontSize(10).fillColor(C.muted).text(t, L + 12, y + 12, { width: W - 24 }); doc.y = y + 48;
  }
  m.findings.forEach((f, i) => {
    const h = 24 + hOf(f.title, 13, 'Times-Bold') + hOf('What we observed: ' + f.observed) + (f.source ? 16 : 0) + hOf('Why it matters: ' + f.why) + hOf('Practical next step: ' + f.next) + 30;
    need(h);
    eyebrow(`Opportunity ${String(i + 1).padStart(2, '0')} · ${f.area}`); doc.moveDown(0.3);
    h3(f.title);
    labeled('What we observed:', f.observed); doc.moveDown(0.25);
    if (f.source) { doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text('Source: ' + f.source, L, doc.y, { width: W }); doc.moveDown(0.25); }
    labeled('Why it matters:', f.why); doc.moveDown(0.25);
    labeled('Practical next step:', f.next); doc.moveDown(0.5);
    if (i < m.findings.length - 1) { doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke(); doc.moveDown(0.8); }
  });

  // Direction
  doc.moveDown(0.6);
  h2('A practical starting direction');
  need(80);
  const dw = (W - 24) / 4, dy = doc.y;
  m.depths.forEach((d, i) => {
    const x = L + i * (dw + 8);
    if (d.selected) doc.roundedRect(x, dy, dw, 66, 4).fill(C.ink); else doc.roundedRect(x, dy, dw, 66, 4).lineWidth(0.8).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(d.selected ? C.white : C.ink).text(d.name, x + 8, dy + 8, { width: dw - 16 });
    doc.font('Helvetica').fontSize(8).fillColor(d.selected ? C.white : C.ink).text(d.desc, x + 8, doc.y + 2, { width: dw - 16 });
  });
  doc.y = dy + 80;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink);
  if (m.direction.lead) { doc.text(m.direction.lead + ' ', L, doc.y, { width: W, lineGap: 2, continued: true }); doc.font('Helvetica').text(m.direction.text, { lineGap: 2 }); }
  else para(m.direction.text);
  doc.moveDown(0.5);
  if (m.foundationNote) { para(m.foundationNote); doc.moveDown(0.5); }
  para(m.routeReason); doc.moveDown(0.6);

  // Pricing
  if (m.pricing) {
    const p = m.pricing, rowsN = p.rows.length + 3 + (p.setup ? 1 : 0);
    need(40 + rowsN * 20);
    h3(p.title);
    const row = (a, b, o = {}) => {
      const y = doc.y;
      if (o.fill) doc.rect(L, y, W, 20).fill(o.fill);
      doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(C.ink);
      doc.text(a, L + 8, y + 5.5, { width: W - 218, lineBreak: false });
      doc.text(b, L + W - 208, y + 5.5, { width: 200, align: 'right', lineBreak: false });
      doc.moveTo(L, y + 20).lineTo(L + W, y + 20).lineWidth(0.5).strokeColor(C.line).stroke();
      doc.y = y + 20;
    };
    row('Monthly component', 'Estimate', { fill: C.pale, bold: true });
    p.rows.forEach(r => row(r[0], r[1]));
    row(p.total[0], p.total[1], { fill: C.pale, bold: true });
    row(p.project[0], p.project[1]);
    if (p.setup) row(p.setup[0], p.setup[1]);
    doc.moveDown(0.6);
    if (p.extras) { doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(p.extras, L, doc.y, { width: W, lineGap: 1.5 }); doc.moveDown(0.3); }
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(p.note, L, doc.y, { width: W, lineGap: 1.5 });
    doc.moveDown(1);
  }

  // Call to action
  need(110);
  const cy = doc.y;
  doc.rect(L, cy, W, 82).fill(C.pale);
  doc.font('Times-Bold').fontSize(14).fillColor(C.ink).text(m.cta.heading, L + 14, cy + 12, { width: W - 28 });
  doc.font('Helvetica').fontSize(10).text(m.cta.body, L + 14, doc.y + 4, { width: W - 28 });
  doc.font('Helvetica-Bold').text(m.contact.join('  ·  '), L + 14, doc.y + 6, { width: W - 28 });
  doc.y = cy + 98;

  // Footer note
  need(hOf(m.footer, 8.5) + 16);
  doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(m.footer, L, doc.y + 8, { width: W, lineGap: 1.5 });

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`Oswald Marketing · Marketing Snapshot · Page ${i + 1} of ${range.count}`, L, doc.page.height - 40, { width: W, align: 'center', lineBreak: false });
  }
}

// ---------- Report card ----------
function sanitizeCard(m) {
  const s = clean;
  const labels = arr(m.labels, 5).map(x => s(x, 24));
  while (labels.length < 5) labels.push('');
  return {
    kind: 'card', sample: !!m.sample, company: s(m.company, 120), website: s(m.website, 200), date: s(m.date, 40), label: s(m.label, 80),
    intro: s(m.intro, 600), sampleNote: s(m.sampleNote, 200), strength: s(m.strength, 1000), labels,
    summary: arr(m.summary, 3).map(x => pair(x, 80)),
    areas: arr(m.areas, 10).map(a => ({
      name: s(a && a.name, 100), score: Math.max(0, Math.min(5, Math.round(Number(a && a.score) || 0))), label: s(a && a.label, 24),
      evidence: s(a && a.evidence, 700), source: s(a && a.source, 300), next: s(a && a.next, 500)
    })),
    unassessed: arr(m.unassessed, 10).map(x => s(x, 100)),
    checklist: arr(m.checklist, 6).map(g => ({ name: s(g && g.name, 80), checked: Math.max(0, Math.round(Number(g && g.checked) || 0)), inPlace: arr(g && g.inPlace, 15).map(x => s(x, 400)), partial: arr(g && g.partial, 15).map(x => s(x, 400)), missing: arr(g && g.missing, 15).map(x => s(x, 400)) })),
    cta: { heading: s(m.cta && m.cta.heading, 120), body: s(m.cta && m.cta.body, 300) },
    contact: arr(m.contact, 5).map(x => s(x, 100)), footer: s(m.footer, 900)
  };
}

function drawCard(doc, m) {
  const L = 54, W = doc.page.width - 108, BOTTOM = () => doc.page.height - 66;
  const need = h => { if (doc.y + h > BOTTOM()) doc.addPage(); };
  const hOf = (t, size = 10.5, font = 'Helvetica', width = W) => { doc.font(font).fontSize(size); return doc.heightOfString(t, { width, lineGap: 2 }); };
  const eyebrow = (t, color = C.teal) => doc.font('Helvetica-Bold').fontSize(8).fillColor(color).text(t.toUpperCase(), L, doc.y, { characterSpacing: 1.5, width: W });
  const top = 54;
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(m.date, L + W - 260, top, { width: 260, align: 'right' });
  doc.text(m.label, L + W - 260, doc.y, { width: 260, align: 'right' });
  const yR = doc.y;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.ink).text('OSWALD MARKETING', L, top, { characterSpacing: 3, width: 260 });
  eyebrow('Marketing Report Card');
  const yRule = Math.max(yR, doc.y) + 10;
  doc.moveTo(L, yRule).lineTo(L + W, yRule).lineWidth(1.5).strokeColor(C.ink).stroke();
  doc.y = yRule + 18;
  eyebrow('Prepared for ' + m.company); doc.moveDown(0.5);
  doc.font('Times-Bold').fontSize(28).fillColor(C.ink).text('Your marketing\nreport card.', L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.6);
  if (m.website) { doc.font('Helvetica').fontSize(10.5).fillColor(C.teal).text(m.website, L, doc.y, { width: W }); doc.moveDown(0.5); }
  doc.font('Helvetica').fontSize(10.5).fillColor(C.ink).text(m.intro, L, doc.y, { width: W, lineGap: 2 }); doc.moveDown(0.6);
  if (m.sampleNote) {
    const t = 'Sample report: ' + m.sampleNote, h = hOf(t, 10, 'Helvetica', W - 24) + 20, y = doc.y;
    need(h); doc.rect(L, doc.y, W, h).fill(C.pale); doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(t, L + 12, y + 10, { width: W - 24 }); doc.y = y + h + 12;
  }
  if (m.summary.length) {
    need(80);
    const bw = (W - 24) / 3, sy = doc.y;
    m.summary.forEach(([val, label], i) => {
      const x = L + i * (bw + 12);
      doc.roundedRect(x, sy, bw, 60, 5).lineWidth(0.8).strokeColor(C.line).stroke();
      let fs = 14; doc.font('Helvetica-Bold');
      while (fs > 7 && doc.fontSize(fs).widthOfString(val) > bw - 20) fs -= 0.5;
      doc.fontSize(fs).fillColor(C.teal).text(val, x + 10, sy + 12 + (14 - fs) / 2, { width: bw - 20, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(C.ink).text(label, x + 10, sy + 38, { width: bw - 20, lineBreak: false });
    });
    doc.y = sy + 76;
  }
  if (m.strength) {
    const h = hOf(m.strength) + 34; need(h); const y = doc.y;
    doc.rect(L, y, W, h).fill(C.pale);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.teal).text('ALREADY WORKING WELL', L + 12, y + 10, { characterSpacing: 1.5, width: W - 24 });
    doc.font('Helvetica').fontSize(10.5).fillColor(C.ink).text(m.strength, L + 12, y + 22, { width: W - 24, lineGap: 2 });
    doc.y = y + h + 14;
  }
  doc.font('Times-Bold').fontSize(20).fillColor(C.ink).text('How each area looks', L, doc.y, { width: W }); doc.moveDown(0.5);
  m.areas.forEach(a => {
    const h = 30 + hOf(a.evidence, 10) + (a.next ? hOf('What would help: ' + a.next, 10) + 4 : 0) + (a.source ? 14 : 0) + 18;
    need(h);
    const y = doc.y;
    doc.font('Times-Bold').fontSize(13).fillColor(C.ink).text(a.name, L, y, { width: W - 200, lineBreak: false });
    // five-segment meter + label, right aligned
    const sw = 22, gap = 3, mx = L + W - (5 * sw + 4 * gap);
    for (let i = 0; i < 5; i++) doc.rect(mx + i * (sw + gap), y + 3, sw, 8).fill(i < a.score ? C.teal : C.line);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.teal).text(a.label, mx - 90, y + 3, { width: 82, align: 'right', lineBreak: false });
    doc.y = y + 22;
    doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(a.evidence, L, doc.y, { width: W, lineGap: 2 });
    if (a.source) { doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text('Source: ' + a.source, L, doc.y + 2, { width: W }); }
    if (a.next) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text('What would help: ', L, doc.y + 4, { width: W, lineGap: 2, continued: true });
      doc.font('Helvetica').text(a.next, { lineGap: 2 });
    }
    doc.moveDown(0.5);
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke(); doc.moveDown(0.7);
  });
  if (m.unassessed.length) {
    const t = 'Not yet assessed: ' + m.unassessed.join(', ') + '. We would cover these together, because public information alone is not enough to rate them fairly.';
    need(hOf(t, 10) + 10); doc.font('Helvetica').fontSize(10).fillColor(C.muted).text(t, L, doc.y, { width: W, lineGap: 2 }); doc.moveDown(0.8);
  }
  if (m.checklist.length) {
    need(70); doc.font('Times-Bold').fontSize(20).fillColor(C.ink).text('What we looked at', L, doc.y, { width: W }); doc.moveDown(0.5);
    m.checklist.forEach(g => {
      need(50);
      doc.font('Times-Bold').fontSize(13).fillColor(C.ink).text(g.name, L, doc.y, { width: W, continued: true });
      doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`   ${g.inPlace.length} of ${g.checked} checks in place${g.partial.length ? ', ' + g.partial.length + ' partly' : ''}`, { lineGap: 2 });
      doc.moveDown(0.25);
      [['In place', g.inPlace], ['Partly in place', g.partial], ['Worth adding', g.missing]].forEach(([title, items]) => {
        if (!items.length) return;
        need(30); doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.teal).text(title, L, doc.y, { width: W }); doc.moveDown(0.15);
        items.forEach(t => { need(hOf('•  ' + t, 10, 'Helvetica', W - 10) + 4); doc.font('Helvetica').fontSize(10).fillColor(C.ink).text('•  ' + t, L + 6, doc.y, { width: W - 10, lineGap: 2 }); });
        doc.moveDown(0.3);
      });
      doc.moveDown(0.4);
    });
  }
  need(110);
  const cy = doc.y;
  doc.rect(L, cy, W, 82).fill(C.pale);
  doc.font('Times-Bold').fontSize(14).fillColor(C.ink).text(m.cta.heading, L + 14, cy + 12, { width: W - 28 });
  doc.font('Helvetica').fontSize(10).text(m.cta.body, L + 14, doc.y + 4, { width: W - 28 });
  doc.font('Helvetica-Bold').text(m.contact.join('  ·  '), L + 14, doc.y + 6, { width: W - 28 });
  doc.y = cy + 98;
  need(hOf(m.footer, 8.5) + 16);
  doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(m.footer, L, doc.y + 8, { width: W, lineGap: 1.5 });
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`Oswald Marketing · Marketing Report Card · Page ${i + 1} of ${range.count}`, L, doc.page.height - 40, { width: W, align: 'center', lineBreak: false });
  }
}

// ---------- Quote ----------
function sanitizeQuote(m) {
  const s = clean, rows = (a, n) => arr(a, n).map(x => pair(x, 140));
  const tot = x => (Array.isArray(x) ? pair(x, 140) : null);
  return {
    kind: 'quote', sample: !!m.sample, company: s(m.company, 120), website: s(m.website, 200), date: s(m.date, 40),
    validDays: Math.max(1, Math.min(365, Math.round(Number(m.validDays) || 30))), packageName: s(m.packageName, 60), intro: s(m.intro, 400),
    monthly: rows(m.monthly, 20), monthlyTotal: tot(m.monthlyTotal) || ['Estimated monthly total', ''],
    oneTime: rows(m.oneTime, 20), oneTimeTotal: tot(m.oneTimeTotal),
    tbq: arr(m.tbq, 12).map(x => s(x, 200)), setup: s(m.setup, 80), perk: s(m.perk, 200), terms: s(m.terms, 900),
    contact: arr(m.contact, 5).map(x => s(x, 100)), sampleNote: s(m.sampleNote, 200)
  };
}

function drawQuote(doc, m) {
  const L = 54, W = doc.page.width - 108, BOTTOM = () => doc.page.height - 66;
  const need = h => { if (doc.y + h > BOTTOM()) doc.addPage(); };
  const hOf = (t, size = 10.5, font = 'Helvetica', width = W) => { doc.font(font).fontSize(size); return doc.heightOfString(t, { width, lineGap: 2 }); };
  const eyebrow = (t, color = C.teal) => doc.font('Helvetica-Bold').fontSize(8).fillColor(color).text(t.toUpperCase(), L, doc.y, { characterSpacing: 1.5, width: W });
  const top = 54;
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(m.date, L + W - 260, top, { width: 260, align: 'right' });
  doc.text(`Valid for ${m.validDays} days`, L + W - 260, doc.y, { width: 260, align: 'right' });
  const yR = doc.y;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.ink).text('OSWALD MARKETING', L, top, { characterSpacing: 3, width: 260 });
  eyebrow('Quote');
  const yRule = Math.max(yR, doc.y) + 10;
  doc.moveTo(L, yRule).lineTo(L + W, yRule).lineWidth(1.5).strokeColor(C.ink).stroke();
  doc.y = yRule + 18;
  eyebrow('Prepared for ' + m.company); doc.moveDown(0.5);
  doc.font('Times-Bold').fontSize(26).fillColor(C.ink).text(m.packageName + ' package', L, doc.y, { width: W }); doc.moveDown(0.4);
  if (m.website) { doc.font('Helvetica').fontSize(10.5).fillColor(C.teal).text(m.website, L, doc.y, { width: W }); doc.moveDown(0.4); }
  doc.font('Helvetica').fontSize(10.5).fillColor(C.ink).text(m.intro, L, doc.y, { width: W, lineGap: 2 }); doc.moveDown(0.8);
  if (m.sampleNote) {
    const h = hOf(m.sampleNote, 10, 'Helvetica', W - 24) + 20, y = doc.y; need(h);
    doc.rect(L, y, W, h).fill(C.pale); doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(m.sampleNote, L + 12, y + 10, { width: W - 24 }); doc.y = y + h + 12;
  }
  const table = (title, rows, total) => {
    need(60 + rows.length * 22);
    const row = (a, b, o = {}) => {
      const h = Math.max(20, hOf(a, 9.5, o.bold ? 'Helvetica-Bold' : 'Helvetica', W - 168) + 10), y = doc.y;
      need(h); const yy = doc.y;
      if (o.fill) doc.rect(L, yy, W, h).fill(o.fill);
      doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(C.ink);
      doc.text(a, L + 8, yy + 5, { width: W - 168, lineGap: 2 });
      doc.text(b, L + W - 150, yy + 5, { width: 142, align: 'right', lineBreak: false });
      doc.moveTo(L, yy + h).lineTo(L + W, yy + h).lineWidth(0.5).strokeColor(C.line).stroke();
      doc.y = yy + h;
    };
    row(title, 'Amount', { fill: C.pale, bold: true });
    rows.forEach(r => row(r[0], r[1]));
    if (total) row(total[0], total[1], { fill: C.pale, bold: true });
    doc.moveDown(0.7);
  };
  table('Monthly', m.monthly, m.monthlyTotal);
  if (m.oneTime.length) table('One-time', m.oneTime, m.oneTimeTotal);
  if (m.tbq.length) {
    need(30 + m.tbq.length * 14);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text('To be quoted', L, doc.y, { width: W }); doc.moveDown(0.3);
    m.tbq.forEach(t => doc.font('Helvetica').fontSize(10).text('•  ' + t, L + 6, doc.y, { width: W - 6, lineGap: 2 }));
    doc.moveDown(0.8);
  }
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text('Setup fee: ', L, doc.y, { width: W, continued: true });
  doc.font('Helvetica').text(m.setup + (m.perk ? '.  ' + m.perk : '.')); doc.moveDown(0.8);
  if (m.terms) { need(hOf(m.terms, 8.5) + 10); doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(m.terms, L, doc.y, { width: W, lineGap: 1.5 }); doc.moveDown(1); }
  // Acceptance
  need(100);
  const y = doc.y;
  doc.font('Times-Bold').fontSize(14).fillColor(C.ink).text('Acceptance', L, y, { width: W });
  const ly = y + 46;
  doc.moveTo(L, ly).lineTo(L + 250, ly).lineWidth(0.8).strokeColor(C.ink).stroke();
  doc.moveTo(L + 290, ly).lineTo(L + W, ly).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text('Authorized signature', L, ly + 4, { width: 250, lineBreak: false });
  doc.text('Date', L + 290, ly + 4, { width: 150, lineBreak: false });
  doc.y = ly + 24;
  if (m.contact.length) doc.font('Helvetica').fontSize(9.5).fillColor(C.ink).text('Questions? ' + m.contact.join('  ·  '), L, doc.y + 6, { width: W });
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i); doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`Oswald Marketing · Quote · Page ${i + 1} of ${range.count}`, L, doc.page.height - 40, { width: W, align: 'center', lineBreak: false });
  }
}

function buildPdf(raw) {
  const kind = raw && raw.kind === 'card' ? 'card' : raw && raw.kind === 'quote' ? 'quote' : 'report';
  const isCard = kind === 'card';
  const m = kind === 'card' ? sanitizeCard(raw) : kind === 'quote' ? sanitizeQuote(raw) : sanitize(raw || {});
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 60, left: 54, right: 54 }, bufferPages: true, info: { Title: `${{ card: 'Marketing Report Card', quote: 'Quote', report: 'Marketing Snapshot' }[kind]} - ${m.company}`, Author: 'Oswald Marketing' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try { ({ card: drawCard, quote: drawQuote, report: draw }[kind])(doc, m); doc.end(); } catch (e) { reject(e); }
  });
}

module.exports = { buildPdf, sanitize };
