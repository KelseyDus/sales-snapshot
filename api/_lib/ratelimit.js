'use strict';
// Best-effort, per-instance limiter. Serverless instances do not share memory, so this slows abuse
// rather than guaranteeing a hard cap.
const buckets = new Map();

function prune(now) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}

function bump(key, windowMs) {
  const now = Date.now();
  prune(now);
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return b;
}

const isLimited = (key, limit) => { const b = buckets.get(key); return !!b && b.reset > Date.now() && b.count >= limit; };
const record = (key, windowMs) => { bump(key, windowMs); };
const clear = key => { buckets.delete(key); };
const consume = (key, limit, windowMs) => bump(key, windowMs).count <= limit;

module.exports = { isLimited, record, clear, consume };
