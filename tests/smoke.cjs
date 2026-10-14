'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

process.env.APP_PASSWORD = 'correct horse battery';
process.env.SESSION_SECRET = 'x'.repeat(48);

const pricing = require(path.join(root, 'api/_lib/pricing.js'));
const auth = require(path.join(root, 'api/_lib/auth.js'));
const fetcher = require(path.join(root, 'api/_lib/fetcher.js'));
const analyzer = require(path.join(root, 'api/_lib/analyze.js'));
const loginH = require(path.join(root, 'api/login.js'));
const logoutH = require(path.join(root, 'api/logout.js'));
const sessionH = require(path.join(root, 'api/session.js'));
const configH = require(path.join(root, 'api/config.js'));
const researchH = require(path.join(root, 'api/research.js'));
const pdfH = require(path.join(root, 'api/pdf.js'));
const pdfLib = require(path.join(root, 'api/_lib/pdf.js'));

const passed = [];
const ok = name => passed.push(name);

/* ---------- Static layout ---------- */
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const asset of ['assets/app.js', 'assets/styles.css']) { assert(html.includes(asset)); assert(fs.existsSync(path.join(root, 'public', asset))); }
assert(!html.includes('config.js'), 'public page must not load a public pricing file');
const vj = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
assert.equal(vj.outputDirectory, 'public');
assert(vj.headers.some(h => h.headers.some(x => x.key === 'Content-Security-Policy')));
function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])); }
const publicText = walk(path.join(root, 'public')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
for (const secret of ['6500', '1450', '1950', '9500', 'kelsey@oswaldmarketing.com']) assert(!publicText.includes(secret), 'public files leak ' + secret);
assert(!/onclick=|<script>[^<]/i.test(html), 'no inline scripts (CSP)');
ok('static layout, CSP header, no pricing in public files');

/* ---------- Front end logic (simulated document) ---------- */
{
  const nodes = {}, listeners = {};
  const values = { company: 'Example', website: 'https://example.com', social: '', industry: 'home', markets: '1', goal: 'growth', ready: 'yes', budget: '2500', hosting: '250', depthOverride: 'auto', packageOverride: 'auto', strength: 'Sample', hoursCount: '0' };
  const document = {
    title: '',
    getElementById(id) { return nodes[id] ??= { value: values[id] ?? '', checked: id === 'showPricing', innerHTML: '', textContent: '', style: {}, classList: { toggle() {}, add() {}, remove() {} }, dataset: {} }; },
    querySelectorAll() { return []; },
    addEventListener(type, cb) { (listeners[type] ??= []).push(cb); }
  };
  const context = vm.createContext({ document, Intl, URL, Set, Date, Number, String, Math, JSON, Array, console, setTimeout() {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/assets/app.js'), 'utf8'), context);
  context.__pricing = JSON.parse(JSON.stringify(pricing));
  const run = code => vm.runInContext(code, context);
  run(`
function check(value, expected, label){if(value!==expected)throw Error(label+': '+value+' != '+expected);}
applyConfig(__pricing); boot();
check(MEDIA_FEE_RATE,.2,'Media fee');
for(const [i,expected] of [[0,3000],[1,6200],[2,10450],[3,14600]])check(calculate(i,250,packages[i].min,new Set()).total,expected,'Package '+i);
check(calculate(2,250,7500,new Set()).total,13450,'Mid maximum');
check(calculate(3,250,10000,new Set()).total,17600,'Premium maximum');
check(calculate(1,150,2500,new Set()).total,6100,'Self-hosted');
check(calculate(1,250,2500,new Set(['email']),0,true).total,6875,'Email discount');
check(calculate(1,250,2500,new Set(['bundle']),0,true).total,7200,'Bundle not discounted');
check(calculate(1,250,2500,new Set(['video','hours']),2).project,1550,'One-time and hourly');
check(calculate(1,250,2500,new Set(['promo'])).monthlyQuoted,false,'Promo not monthly');
check(calculate(1,250,2500,new Set(['promo'])).projectQuoted,true,'Promo quoted');
check(calculate(1,250,2500,new Set(['integrated'])).monthlyQuoted,true,'Integrated capture quoted');
const store=calculate(1,250,2500,new Set(['store']));check(store.monthly,30,'Store monthly');check(store.projectQuoted,true,'Store setup');
check(calculate(1,250,2500,new Set(['video'])).monthlyFrom,false,'Video not monthly from');
const c={industry:'home',markets:1,complex:false,budget:2500,ready:'yes',goal:'growth',depthOverride:'auto',packageOverride:'auto'};
check(recommendation({...c,budget:10001},findings).custom,true,'Custom spend');
check(recommendation({...c,budget:10000},findings).custom,false,'Standard upper boundary');
check(recommendation({...c,markets:2},findings).custom,true,'Multiple markets');
check(recommendation({...c,industry:'other',packageOverride:'3'},findings).pkg,null,'No custom override price');
check(recommendation({...c,ready:'unknown',budget:null},findings).pkg,null,'Unknown readiness');
check(recommendation({...c,ready:'no',budget:null},findings).pkg,0,'No ads');
check(recommendation({...c,budget:5000},findings).pkg,2,'Mid routing');
check(recommendation({...c,budget:7500},findings).pkg,3,'Premium routing');
check(safeLink('javascript:alert(1)'),'','URL validation');
check(safeLink('example.com'),'https://example.com/','Scheme-less link');
check(esc('<script>'),'&lt;script&gt;','Escaping');
check($('report').innerHTML.includes('$6,200'),true,'Report totals');
check($('report').innerHTML.includes('FICTIONAL'),false,'Real mode has no sample label');
check($('printReport').innerHTML.includes('Confirm on the call'),false,'Internal notes excluded');
check($('printReport').innerHTML.includes('supplied pricing sheet'),false,'No internal wording in client report');
check($('printReport').innerHTML.includes('Any one-time setup fees are confirmed during scoping.'),true,'Setup not waived by default');
check($('printReport').innerHTML.includes('<td>Waived</td>'),false,'No waived row by default');
$('setupWaived').checked=true;render();
check($('printReport').innerHTML.includes('Setup fees are waived.'),true,'Setup waived footer');
check($('printReport').innerHTML.includes('<td>Setup fee</td><td>Waived</td>'),true,'Setup waived row');
check($('printReport').innerHTML.includes('Any one-time setup fees'),false,'Not-waived text gone');
check(reportModel(context(),recommendation(context(),findings)).pricing.setup[1],'Waived','Model setup row');
check(JSON.parse(JSON.stringify(getState())).setupWaived,true,'Waiver saved in state');
$('setupWaived').checked=false;render();
check($('printReport').innerHTML.includes('What is already working'),true,'Strength shown when entered');
$('strength').value='';render();
check($('report').innerHTML.includes('What is already working'),false,'Strength omitted when empty');
check($('report').innerHTML.includes('Strengths have not yet been documented'),false,'No placeholder text');
findings[0].status='gap';findings[0].priority=true;check(picked().length,0,'Evidence required');
findings[0].evidence='Observed title';check(picked().length,1,'Observed finding');
$('sample').onclick();check(sample,true,'Example mode');check(picked().length,3,'Sample findings');
check($('printReport').innerHTML.includes('FICTIONAL SAMPLE'),true,'Sample label');
$('blank').onclick();check(sample,false,'Manual mode');check(picked().length,0,'Blank evidence');
check($('report').innerHTML.includes('Pending'),true,'Pending report');
// state round trip
$('sample').onclick();selected=new Set(['video']);hoursValue=3;
$('setupWaived').checked=true;const snap=JSON.parse(JSON.stringify(getState()));
$('blank').onclick();check(picked().length,0,'Cleared');check($('setupWaived').checked,false,'Waiver reset on new assessment');
applyState(snap);check(picked().length,3,'Imported findings');check(selected.has('video'),true,'Imported add-on');check(hoursValue,3,'Imported hours');check($('setupWaived').checked,true,'Imported waiver');check(sample,true,'Imported mode');
let threw=false;try{applyState({foo:1})}catch{threw=true}check(threw,true,'Bad import rejected');
// research results are applied as drafts
$('blank').onclick();
applyResearch({reviewedAt:new Date().toISOString(),pages:[{url:'https://x.test/',title:'x'}],errors:[],socialLinks:['https://facebook.com/x'],findings:[{id:'seo',status:'gap',evidence:'On x.test: no title tag on the homepage.',source:'https://x.test/'},{id:'capture',status:'strong',evidence:'An email signup form appears.',source:''},{id:'nope',status:'gap',evidence:'ignored'}]});
check(picked().length,1,'Research gap featured');check(findings.find(f=>f.id==='capture').status,'strong','Research strong');
check($('strength').value,'An email signup form appears.','Strength prefilled');check($('social').value,'https://facebook.com/x','Social prefilled');
`);
  for (const id of ['logo', 'brand']) for (const cb of listeners.change) cb({ target: { dataset: { addon: id }, checked: true } });
  assert.equal(run('selected.has("logo")'), false);
  assert.equal(run('selected.has("brand")'), true);
  ok('pricing math, routing, report output, state import/export, research application');
}

/* ---------- Auth ---------- */
{
  const tok = auth.issue();
  assert(auth.verify(tok)); assert(!auth.verify(tok + 'x')); assert(!auth.verify('')); assert(!auth.verify(undefined));
  const [e, n, s] = tok.split('.');
  assert(!auth.verify(`${Number(e) + 999}.${n}.${s}`));
  const realNow = Date.now; Date.now = () => realNow() + 13 * 3600 * 1000; assert(!auth.verify(tok)); Date.now = realNow;
  assert(auth.passwordOk('correct horse battery')); assert(!auth.passwordOk('nope')); assert(!auth.passwordOk(''));
  ok('session tokens and password check');
}

/* ---------- Network safety ---------- */
(async () => {
  const { isBlockedIp, parseTarget, guardedLookup } = fetcher;
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.5.5', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::7f00:1', 'not-an-ip']) assert(isBlockedIp(ip), 'should block ' + ip);
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111']) assert(!isBlockedIp(ip), 'should allow ' + ip);
  assert.equal(parseTarget('example.com').href, 'https://example.com/');
  for (const bad of ['', 'ftp://example.com', 'http://user:pw@example.com', 'example.com:8080', 'localhost', 'http://127.0.0.1/', 'http://[::1]/', 'http://[::ffff:7f00:1]/', 'http://169.254.169.254/latest/meta-data', 'http://2130706433/']) assert.throws(() => parseTarget(bad), undefined, 'should reject ' + bad);
  const lookupErr = await new Promise(res => guardedLookup('localhost', { all: true }, err => res(err)));
  assert(lookupErr, 'localhost lookup must be refused');
  ok('SSRF guards: IP ranges, URL parsing, DNS lookup pinning');

  /* ---------- Analyzer ---------- */
  const good = `<html><head><title>Acme Plumbing | Drain Cleaning in Evansville</title><meta name="description" content="Fast, honest plumbing."><meta name="viewport" content="width=device-width">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Plumber","name":"Acme"}]}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script></head><body><h1>Plumbing you can trust</h1>
  <a href="tel:+18125550100">Call now</a><a href="/services/drains">Drain services</a><a href="/contact-us">Contact us</a><a href="/blog/post-1">Blog</a>
  <iframe src="https://www.youtube.com/embed/abc"></iframe>
  <form action="/join"><input type="email" name="email"><button>Join</button></form>
  <a href="https://www.facebook.com/acmeplumbing">FB</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a><img src="https://www.facebook.com/tr?id=1"></body></html>`;
  const bare = '<html><head></head><body><h1>Hi</h1><h1>Two</h1><a href="/services">Services</a><a href="https://other.com/services">x</a></body></html>';
  const pg = analyzer.parsePage(good, 'https://acme.test/');
  assert.equal(pg.social.length, 1); assert(pg.social[0].includes('facebook.com/acmeplumbing'));
  assert(pg.signup); assert(pg.phone); assert.equal(pg.videos.length, 1); assert.deepEqual(pg.schema, ['Plumber']); assert(pg.analytics.includes('Google Analytics / Tag Manager'));
  assert.deepEqual(analyzer.pickLinks(pg, 2), ['https://acme.test/services/drains', 'https://acme.test/contact-us']);
  const g = Object.fromEntries(analyzer.analyze([pg]).findings.map(f => [f.id, f]));
  assert.equal(g.seo.status, 'strong'); assert.equal(g.website.status, 'strong'); assert.equal(g.video.status, 'strong'); assert.equal(g.capture.status, 'strong');
  assert.equal(g.social.status, 'unknown'); assert.equal(g.performance.status, 'unknown'); assert(g.performance.evidence.includes('Google Analytics'));
  const bp = analyzer.parsePage(bare, 'https://bare.test/');
  assert.deepEqual(analyzer.pickLinks(bp, 2), ['https://bare.test/services']);
  const b = Object.fromEntries(analyzer.analyze([bp]).findings.map(f => [f.id, f]));
  for (const id of ['seo', 'website', 'video', 'capture', 'social']) assert.equal(b[id].status, 'gap', id);
  assert(b.seo.evidence.includes('no title tag')); assert(b.seo.evidence.includes('2 H1 headings')); assert(b.website.evidence.includes('viewport'));
  assert.equal(analyzer.analyze([pg]).findings.length, pricing.areas.length);
  ok('research analyzer: strong and gap detection, link picking, social filtering');

  /* ---------- PDF ---------- */
  const model = {
    sample: false, company: 'Acme Plumbing Ōsaka', website: 'https://acme.test', date: 'October 14, 2026', label: 'PUBLIC-RESEARCH ASSESSMENT · PRELIMINARY',
    intro: 'Intro text.', sampleNote: '', strength: 'Clear services on the homepage.',
    stats: [['3', 'Priority opportunities'], ['Growth and performance', 'Preliminary marketing depth'], ['Base Ads', 'Suggested service package']],
    findings: [1, 2, 3].map(i => ({ area: 'Area ' + i, title: 'Title ' + i, observed: 'Observed text '.repeat(30), source: 'https://acme.test/p' + i, why: 'Why it matters. '.repeat(10), next: 'Next step. '.repeat(10) })),
    depths: ['Surface', 'Twilight', 'Deep Ocean', 'Abyss'].map((n, i) => ({ name: n, desc: 'Description for ' + n, selected: i === 2 })),
    direction: { lead: 'Deep Ocean:', text: 'Growth and performance. This direction reflects the stated business goal.' }, foundationNote: '', routeReason: 'Preliminary fit.',
    pricing: { title: 'Estimated investment · Base Ads', rows: [['Hosting and care', '$250'], ['Social media management', '$1,000']], total: ['Estimated monthly total', '$6,200'], project: ['One-time projects / creative hours', '$0'], setup: ['Setup fee', 'Waived'], extras: '', note: 'Monthly reporting included.' },
    cta: { heading: 'Let’s talk through what matters most.', body: 'We’d welcome 15 minutes.' }, contact: ['a@example.com', 'b@example.com'], footer: 'Footer. Setup fees are waived.'
  };
  const pdf = await pdfLib.buildPdf(model);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert(pdf.length > 3000);
  const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  assert(pages >= 2, 'multi-page report expected, got ' + pages);
  const emptyPdf = await pdfLib.buildPdf({ company: 'X', findings: [], depths: [], stats: [], direction: {} });
  assert.equal(emptyPdf.subarray(0, 5).toString(), '%PDF-');
  const junk = await pdfLib.buildPdf({ company: { a: 1 }, findings: 'nope', pricing: { rows: 'x' }, stats: [null] });
  assert.equal(junk.subarray(0, 5).toString(), '%PDF-');
  if (process.env.WRITE_TEST_PDF) fs.writeFileSync(process.env.WRITE_TEST_PDF, pdf);
  ok('PDF builder: multi-page output, empty and malformed models, unsupported characters');

  /* ---------- API handlers ---------- */
  const mkRes = () => ({ statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b || ''; } });
  const call = async (h, { method = 'POST', body, cookie, origin = 'https://app.test', ip = '1.1.1.1' } = {}) => {
    const req = { method, headers: { host: 'app.test', origin, cookie, 'x-forwarded-for': ip }, body };
    const res = mkRes(); await h(req, res);
    return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null, headers: res.headers };
  };
  let r = await call(loginH, { body: { password: 'wrong' }, ip: '2.2.2.2' }); assert.equal(r.status, 401);
  r = await call(loginH, { body: { password: 'correct horse battery' }, origin: 'https://evil.test' }); assert.equal(r.status, 403);
  r = await call(loginH, { method: 'GET' }); assert.equal(r.status, 405);
  r = await call(loginH, { body: { password: 'correct horse battery' } });
  assert.equal(r.status, 200);
  const setCookie = r.headers['set-cookie']; assert(/HttpOnly/.test(setCookie) && /SameSite=Strict/.test(setCookie) && /Secure/.test(setCookie));
  const cookie = setCookie.split(';')[0];
  r = await call(configH, { method: 'GET' }); assert.equal(r.status, 401);
  r = await call(configH, { method: 'GET', cookie }); assert.equal(r.status, 200); assert.equal(r.json.packages.length, 4);
  r = await call(sessionH, { method: 'GET', cookie }); assert.deepEqual(r.json, { configured: true, authenticated: true });
  r = await call(sessionH, { method: 'GET' }); assert.deepEqual(r.json, { configured: true, authenticated: false });
  r = await call(logoutH, { cookie }); assert.equal(r.status, 200); assert(/Max-Age=0/.test(r.headers['set-cookie']));
  r = await call(researchH, { body: { website: 'example.com' } }); assert.equal(r.status, 401);
  r = await call(pdfH, { body: { model } }); assert.equal(r.status, 401);
  r = await call(pdfH, { cookie, body: {} }); assert.equal(r.status, 400);
  r = await call(pdfH, { cookie, body: { model }, origin: 'https://evil.test' }); assert.equal(r.status, 403);
  {
    const req = { method: 'POST', headers: { host: 'app.test', origin: 'https://app.test', cookie, 'x-forwarded-for': '3.3.3.3' }, body: { model } };
    const res = mkRes(); res.end = function (b) { this.body = b; }; await pdfH(req, res);
    assert.equal(res.statusCode, 200); assert.equal(res.headers['content-type'], 'application/pdf'); assert(/attachment/.test(res.headers['content-disposition'])); assert.equal(Buffer.from(res.body).subarray(0, 5).toString(), '%PDF-');
  }
  for (const bad of ['http://127.0.0.1/', 'localhost', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', '']) {
    r = await call(researchH, { cookie, body: { website: bad } });
    assert.equal(r.status, 400, 'research must reject ' + bad);
  }
  // login rate limit
  for (let i = 0; i < 5; i++) await call(loginH, { body: { password: 'bad' }, ip: '9.9.9.9' });
  r = await call(loginH, { body: { password: 'correct horse battery' }, ip: '9.9.9.9' }); assert.equal(r.status, 429);
  // fail closed when unconfigured
  const keep = process.env.APP_PASSWORD; delete process.env.APP_PASSWORD;
  r = await call(configH, { method: 'GET', cookie }); assert.equal(r.status, 503);
  r = await call(sessionH, { method: 'GET', cookie }); assert.equal(r.json.configured, false);
  process.env.APP_PASSWORD = keep;
  ok('API handlers: sign-in, cookies, origin check, rate limit, auth required, SSRF rejection, fail-closed');

  console.log('PASS (' + passed.length + ' groups):\n - ' + passed.join('\n - '));
  console.log('These checks use a simulated document and make no outside network calls. Review layout and print output in a real browser.');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
