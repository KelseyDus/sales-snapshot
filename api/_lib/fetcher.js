'use strict';
// Guarded fetcher for public web pages. Blocks private/loopback/link-local targets (SSRF),
// validates every redirect hop, pins validation to the actual connection via a custom DNS lookup,
// and bounds time and size.
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const MAX_BYTES = 1500000, TIMEOUT_MS = 8000, MAX_REDIRECTS = 4;
const UA = 'Mozilla/5.0 (compatible; OswaldMarketingSnapshot/1.0)';
const expose = (message, code) => Object.assign(new Error(message), { expose: true, code });

const blocked = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 96], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['64:ff9b::', 96], ['100::', 64]]) blocked.addSubnet(a, p, 'ipv6');

function isBlockedIp(ip) {
  const fam = net.isIP(ip);
  if (!fam) return true;
  if (fam === 4) return blocked.check(ip, 'ipv4');
  let norm;
  try { norm = new URL('http://[' + ip + ']').hostname.slice(1, -1); } catch { return true; }
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(norm);
  if (m) {
    const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
    return blocked.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, 'ipv4');
  }
  return blocked.check(norm, 'ipv6');
}

function parseTarget(input) {
  let s = String(input || '').trim();
  if (!s) throw expose('Enter a website address.');
  if (s.length > 2000) throw expose('That address is too long.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { throw expose('That does not look like a valid web address.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw expose('Only http and https addresses can be reviewed.');
  if (u.username || u.password) throw expose('Addresses with credentials are not allowed.');
  if (u.port && !['80', '443'].includes(u.port)) throw expose('Only standard web ports are allowed.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) { if (isBlockedIp(host)) throw expose('That address is not publicly reachable.'); }
  else if (!host.includes('.')) throw expose('Enter a public domain name.');
  return u;
}

function guardedLookup(hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  dns.lookup(hostname, { all: true, verbatim: true }, (e, addrs) => {
    if (e) return cb(e);
    if (!addrs.length || addrs.some(a => isBlockedIp(a.address))) return cb(expose('That address is not publicly reachable.', 'EBLOCKED'));
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

function once(u) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, v) => { if (settled) return; settled = true; clearTimeout(timer); fn(v); };
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'GET', lookup: guardedLookup, timeout: TIMEOUT_MS,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate, br', 'accept-language': 'en-US,en;q=0.8' }
    }, res => {
      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        let next;
        try { next = new URL(res.headers.location, u).href; } catch { return done(reject, expose('The site sent an invalid redirect.')); }
        return done(resolve, { redirect: next, status });
      }
      const type = String(res.headers['content-type'] || '');
      if (status < 400 && type && !/html|xml/i.test(type)) { res.resume(); return done(reject, expose('That address did not return a web page.')); }
      let stream = res;
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      const chunks = []; let size = 0;
      const finish = () => done(resolve, { status, html: Buffer.concat(chunks).toString('utf8') });
      stream.on('data', c => {
        if (settled) return;
        size += c.length;
        if (size > MAX_BYTES) { chunks.push(c.subarray(0, c.length - (size - MAX_BYTES))); finish(); req.destroy(); return; }
        chunks.push(c);
      });
      stream.on('end', finish);
      stream.on('error', () => (chunks.length ? finish() : done(reject, expose('The page could not be read.'))));
    });
    const timer = setTimeout(() => req.destroy(expose('The site took too long to respond.')), TIMEOUT_MS + 4000);
    req.on('timeout', () => req.destroy(expose('The site took too long to respond.')));
    req.on('error', e => done(reject, e));
    req.end();
  });
}

function friendly(e) {
  if (e && e.expose) return e;
  const code = e && e.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return expose('Could not find that website. Check the address.');
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(code)) return expose('Could not connect to that website.');
  if (/CERT|SSL|TLS|self.signed/i.test(String(code) + ' ' + String(e && e.message))) return expose('The website’s security certificate could not be verified.');
  return expose('The website could not be retrieved.');
}

async function fetchPage(input) {
  let u = parseTarget(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let r;
    try { r = await once(u); } catch (e) { throw friendly(e); }
    if (r.redirect) { u = parseTarget(r.redirect); continue; }
    if (r.status >= 400) throw expose(`The site returned an error (HTTP ${r.status}).`);
    return { url: u.href, status: r.status, html: r.html };
  }
  throw expose('The site redirected too many times.');
}

module.exports = { parseTarget, isBlockedIp, guardedLookup, fetchPage };
