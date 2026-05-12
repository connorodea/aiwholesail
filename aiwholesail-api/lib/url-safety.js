/**
 * SSRF guard for user-supplied URLs (currently used by webhook endpoints).
 *
 * Two-stage validation:
 *   1. Parse + protocol check (http/https only)
 *   2. Resolve hostname → check every returned A/AAAA against a blocklist of
 *      private/loopback/link-local/CGNAT/reserved/multicast ranges
 *
 * Why not just string-match 'localhost' / '127.0.0.1'? Because that misses:
 *   - 169.254.169.254 (AWS / GCP instance metadata service — IMDS)
 *   - 10.x / 172.16-31.x / 192.168.x (RFC1918 private)
 *   - 100.64.0.0/10 (CGNAT)
 *   - ::1, fc00::/7, fe80::/10 (IPv6 loopback / private / link-local)
 *   - ::ffff:127.0.0.1 (IPv4-mapped IPv6 — easy to overlook)
 *   - 0.0.0.0/8, 224.0.0.0/4 multicast, 255.255.255.255 broadcast
 *   - DNS rebinding: hostname resolves to public IP on first lookup,
 *     private IP on second. We resolve here, then attach the SAME resolved
 *     IP to outbound fetch. (TODO: a stricter implementation would pass
 *     the resolved IP as a custom lookup; today we accept the residual
 *     rebind window but block at delivery time as well — see deliver()
 *     in lib/webhooks.js.)
 *
 * Returns null on success or a short string reason on failure.
 */

const dns = require('node:dns/promises');
const ipaddr = require('ipaddr.js');

// Named ranges from ipaddr.js that we never want webhook traffic going to.
// ipaddr.js range() returns 'unicast' for normal public IPs — only that
// and 'private' for *trusted* corporate-VPN scenarios would be safe, but
// we treat 'private' as blocked since callers run in cloud, not on-prem.
const BLOCKED_RANGES = new Set([
  'unspecified',     // 0.0.0.0 / ::
  'broadcast',       // 255.255.255.255
  'multicast',       // 224.0.0.0/4 / ff00::/8
  'linkLocal',       // 169.254.0.0/16 / fe80::/10 — INCLUDES IMDS (169.254.169.254)
  'loopback',        // 127.0.0.0/8 / ::1
  'carrierGradeNat', // 100.64.0.0/10
  'private',         // IPv4 RFC1918
  'uniqueLocal',     // IPv6 ULA fc00::/7 — ipaddr.js's name for it (NOT 'private')
  'reserved',        // 240.0.0.0/4 etc.
]);

const DNS_TIMEOUT_MS = 5_000;

function isPrivateIp(ipString) {
  let addr;
  try {
    addr = ipaddr.parse(ipString);
  } catch {
    // Unparseable — treat as unsafe rather than letting it through.
    return true;
  }
  // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1 → 127.0.0.1) so the IPv4
  // range table applies. ipaddr.js classifies the wrapped form as 'ipv4Mapped'
  // which isn't in BLOCKED_RANGES, so we'd let 127.0.0.1 through if we skipped
  // this step.
  if (addr.kind() === 'ipv6' && typeof addr.isIPv4MappedAddress === 'function' && addr.isIPv4MappedAddress()) {
    addr = addr.toIPv4Address();
  }
  return BLOCKED_RANGES.has(addr.range());
}

async function lookupWithTimeout(hostname) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('dns_timeout')), DNS_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      dns.lookup(hostname, { all: true }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function validateWebhookUrl(url, { allowHttp = false } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'invalid url';
  }
  if (!['http:', 'https:'].includes(u.protocol)) return 'url must be http or https';
  if (!allowHttp && u.protocol !== 'https:') return 'url must be https';

  // Node's URL parser returns IPv6 hostnames in their bracketed form
  // ([::1], [fe80::1]); ipaddr.js wants them naked.
  const hostname = u.hostname.replace(/^\[|\]$/g, '');

  // Literal IP — check directly, skip DNS.
  if (ipaddr.isValid(hostname)) {
    return isPrivateIp(hostname) ? 'url resolves to a private network' : null;
  }

  // Hostname → DNS resolution. Check every returned record.
  let records;
  try {
    records = await lookupWithTimeout(hostname);
  } catch (err) {
    return err.message === 'dns_timeout'
      ? 'hostname dns lookup timed out'
      : 'hostname does not resolve';
  }
  if (!Array.isArray(records) || records.length === 0) {
    return 'hostname does not resolve';
  }
  for (const r of records) {
    if (isPrivateIp(r.address)) return 'url resolves to a private network';
  }
  return null;
}

module.exports = { isPrivateIp, validateWebhookUrl };
