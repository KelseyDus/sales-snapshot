'use strict';
// Deterministic extraction of observable facts from public HTML. Nothing here is inferred by a model:
// every finding carries an evidence sentence describing what was seen (or not seen) in the page source.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”' };
const decode = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  }
  return ENT[e.toLowerCase()] ?? m;
});
const strip = s => decode(String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const clip = (s, n = 120) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
function attr(tag, name) {
  const m = new RegExp('(?:^|[\\s"\'/])' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : '';
}
function collectTypes(n, acc, d = 0) {
  if (!n || d > 6) return;
  if (Array.isArray(n)) return n.forEach(x => collectTypes(x, acc, d + 1));
  if (typeof n !== 'object') return;
  if (n['@type']) [].concat(n['@type']).forEach(x => typeof x === 'string' && acc.push(x));
  if (n['@graph']) collectTypes(n['@graph'], acc, d + 1);
}

const TAGS = [
  ['Google Analytics / Tag Manager', /googletagmanager\.com|google-analytics\.com|gtag\(/i],
  ['Meta Pixel', /connect\.facebook\.net\/[^"']*fbevents|fbq\(/i],
  ['Google Ads tag', /googleadservices\.com|\bAW-\d{6,}/i],
  ['Microsoft Clarity', /clarity\.ms/i],
  ['Hotjar', /hotjar\.com/i],
  ['LinkedIn Insight Tag', /snap\.licdn\.com/i],
  ['HubSpot tracking', /js\.hs-scripts\.com|js\.hs-analytics\.net/i],
  ['CallRail', /callrail\.com|calltrk/i]
];
const CTA = /\b(get (?:a |your )?(?:free )?(?:quote|estimate)|free (?:quote|estimate)|request (?:a |an )?(?:free )?(?:quote|estimate|service|appointment|callback)|schedule|book (?:now|online|an? appointment|service)|contact us|call (?:us|now|today))\b/i;

function sameSite(a, b) { return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, ''); }

function parsePage(html, url) {
  const base = new URL(url);
  const out = { url, title: '', description: '', h1s: [], viewport: false, videos: [], signup: false, contactForm: false, phone: false, mailto: false, cta: [], social: [], schema: [], analytics: [], links: [] };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (t) out.title = strip(t[1]);
  for (const m of html.match(/<meta\b[^>]*>/gi) || []) {
    const n = attr(m, 'name').toLowerCase();
    if (n === 'description') out.description = attr(m, 'content').trim();
    if (n === 'viewport') out.viewport = true;
  }
  for (const m of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) { const x = strip(m[1]); if (x) out.h1s.push(x); }
  for (const m of html.match(/<iframe\b[^>]*>/gi) || []) {
    const s = attr(m, 'src') || attr(m, 'data-src');
    if (/youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com|wistia\.(?:com|net)|loom\.com\/embed/i.test(s)) out.videos.push(clip(s, 80));
  }
  if (/<video\b/i.test(html)) out.videos.push('HTML5 video element');
  for (const m of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) {
    const f = m[0];
    const inputs = (f.match(/<input\b[^>]*>/gi) || []).filter(i => !/type\s*=\s*["']?(hidden|submit|button|checkbox)/i.test(i));
    const hasEmail = inputs.some(i => /type\s*=\s*["']?email/i.test(i) || /name\s*=\s*["'][^"']*email/i.test(i));
    const hasText = /<textarea/i.test(f);
    if (hasEmail && !hasText && (inputs.length <= 2 || /newsletter|subscribe/i.test(f))) out.signup = true;
    else if (hasText || inputs.length >= 3) out.contactForm = true;
  }
  out.phone = /href\s*=\s*["']?tel:/i.test(html);
  out.mailto = /href\s*=\s*["']?mailto:/i.test(html);
  const seen = new Set();
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const txt = strip(m[3]);
    if (txt && txt.length < 60 && CTA.test(txt) && !seen.has(txt.toLowerCase())) { seen.add(txt.toLowerCase()); if (out.cta.length < 3) out.cta.push(txt); }
    if (m[1].toLowerCase() === 'a') {
      const href = attr(m[2], 'href').trim();
      if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
      try {
        const u = new URL(href, base);
        if (!['http:', 'https:'].includes(u.protocol) || !sameSite(u, base)) continue;
        if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4)$/i.test(u.pathname)) continue;
        u.hash = ''; u.search = '';
        out.links.push(u.href);
      } catch { /* ignore malformed links */ }
    }
  }
  const soc = new Map();
  for (const m of html.matchAll(/https?:\/\/(?:www\.|m\.)?(facebook|instagram|linkedin|youtube|tiktok|twitter|x)\.com\/([^"'\s<>)\\]+)/gi)) {
    const plat = m[1].toLowerCase();
    if (/^(sharer|share|intent|dialog|plugins|tr\b|embed|watch|oauth|login|hashtag|policy|legal)/i.test(m[2])) continue;
    const clean = m[2].split(/[?#]/)[0].replace(/\/$/, '');
    if (!clean) continue;
    const key = plat + '/' + clean.toLowerCase();
    if (!soc.has(key)) soc.set(key, `https://${plat}.com/${clean}`);
  }
  out.social = [...soc.values()].slice(0, 8);
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectTypes(JSON.parse(m[1].trim()), out.schema); } catch { /* ignore invalid JSON-LD */ }
  }
  out.schema = [...new Set(out.schema)];
  for (const [n, re] of TAGS) if (re.test(html)) out.analytics.push(n);
  out.links = [...new Set(out.links)];
  return out;
}

function pickLinks(page, n = 2) {
  const score = u => {
    const p = new URL(u).pathname.toLowerCase();
    if (/service|repair|install|what-we-do/.test(p)) return 3;
    if (/contact|quote|estimate/.test(p)) return 2;
    if (/about/.test(p)) return 1;
    return 0;
  };
  const seen = new Set([new URL(page.url).pathname.replace(/\/$/, '')]);
  const out = [];
  for (const u of [...page.links].sort((a, b) => score(b) - score(a))) {
    if (score(u) === 0) break;
    const key = new URL(u).pathname.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key); out.push(u);
    if (out.length >= n) break;
  }
  return out;
}

const label = u => { try { const p = new URL(u).pathname; return p === '/' || p === '' ? 'the homepage' : `the ${p} page`; } catch { return 'a page'; } };
const list = (a, n = 4) => a.slice(0, n).join('; ');

function analyze(pages) {
  const home = pages[0];
  const host = new URL(home.url).hostname;
  const f = [];
  const add = (id, status, evidence, source = home.url) => f.push({ id, status, evidence, source: evidence ? source : '', evidenceType: 'observed' });

  // SEO
  const seo = [];
  for (const p of pages) {
    const w = label(p.url);
    if (!p.title) seo.push(`no title tag on ${w}`);
    else if (p.title.length > 65) seo.push(`${w}’s title is ${p.title.length} characters and may be cut off in search results`);
    else if (p.title.length < 15) seo.push(`${w}’s title is only ${p.title.length} characters`);
    if (!p.description) seo.push(`no meta description on ${w}`);
    if (p.h1s.length === 0) seo.push(`no H1 heading on ${w}`);
    else if (p.h1s.length > 1) seo.push(`${p.h1s.length} H1 headings on ${w}`);
  }
  const titles = pages.map(p => p.title).filter(Boolean);
  if (new Set(titles).size < titles.length) seo.push('two inspected pages share the same title');
  if (!home.schema.length) seo.push('no structured data (schema.org) on the homepage');
  const scope = pages.length > 1 ? ` (${pages.length} pages inspected)` : '';
  if (seo.length) add('seo', 'gap', `On ${host}: ${list(seo)}${scope}.`);
  else add('seo', 'strong', `The homepage has a title, meta description, a single H1 heading, and structured data (${home.schema.slice(0, 3).join(', ')}).`);

  // Brand: needs human judgement; surface the headline only.
  const headline = home.h1s[0] || home.title;
  add('brand', 'unknown', headline ? `Homepage headline observed: “${clip(headline, 140)}”. Messaging quality needs human review.` : '');

  // Website / contact
  const web = [];
  if (new URL(home.url).protocol !== 'https:') web.push('the site loads over HTTP rather than HTTPS');
  if (!home.viewport) web.push('the homepage has no mobile viewport tag');
  const phone = pages.some(p => p.phone), form = pages.some(p => p.contactForm), mail = pages.some(p => p.mailto), cta = pages.flatMap(p => p.cta);
  if (!phone && !form && !mail && !cta.length) web.push('no click-to-call link, email link, contact form, or quote/booking button was found in the inspected pages');
  if (web.length) add('website', 'gap', `Observed: ${list(web)}.`);
  else add('website', 'strong', `Inquiry paths found: ${[phone && 'click-to-call phone link', form && 'contact form', mail && 'email link', cta.length && `call to action (“${cta[0]}”)`].filter(Boolean).join(', ')}.`);

  // Video
  const videos = pages.flatMap(p => p.videos);
  const paths = pages.map(p => label(p.url).replace(/^the /, '')).join(', ');
  if (videos.length) add('video', 'strong', `Video found in the page source: ${videos[0]}.`);
  else add('video', 'gap', `No video embed or video element appears in the HTML source of the ${pages.length} inspected page${pages.length > 1 ? 's' : ''} (${paths}). Videos loaded by scripts after the page opens would not be visible to this review.`);

  // Social
  const social = [...new Set(pages.flatMap(p => p.social))].slice(0, 8);
  if (social.length) add('social', 'unknown', `Social profiles linked from the website: ${social.map(s => s.replace(/^https:\/\//, '')).join(', ')}. Content quality and posting frequency were not assessed.`);
  else add('social', 'gap', 'No links to Facebook, Instagram, LinkedIn, YouTube, TikTok, or X profiles were found in the inspected pages.');

  // Lead capture
  if (pages.some(p => p.signup)) add('capture', 'strong', 'An email signup form appears in the inspected pages.');
  else add('capture', 'gap', `No email signup form was found in the HTML of the inspected pages (${paths}).`);

  // Measurement
  const tags = [...new Set(pages.flatMap(p => p.analytics))];
  add('performance', 'unknown', tags.length
    ? `Tracking tags found in the page source: ${tags.join(', ')}. Whether they are configured and reviewed needs confirmation.`
    : 'No analytics or advertising tags were found in the page source. Server-side or consent-gated tags would not appear here.');

  return {
    pages: pages.map(p => ({ url: p.url, title: p.title })),
    socialLinks: social,
    findings: f
  };
}

module.exports = { parsePage, pickLinks, analyze };
