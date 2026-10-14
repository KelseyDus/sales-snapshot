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

function buildPdf(raw) {
  const m = sanitize(raw || {});
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 60, left: 54, right: 54 }, bufferPages: true, info: { Title: `Marketing Snapshot - ${m.company}`, Author: 'Oswald Marketing' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try { draw(doc, m); doc.end(); } catch (e) { reject(e); }
  });
}

module.exports = { buildPdf, sanitize };
