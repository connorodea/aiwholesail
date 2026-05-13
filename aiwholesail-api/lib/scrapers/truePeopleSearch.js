/**
 * Self-hosted skip tracing, backed by TruePeopleSearch via scrape.do.
 *
 * Replaces the RapidAPI `skip-tracing-working-api` for the byaddress /
 * bynameaddress search-types. Returns a payload in the same shape the
 * routes/skipTrace.js handler already produces — extractPeoIds() and
 * countResults() must keep working without branching on provider, so we
 * synthesize a `peo_id` field from the result-page URL (it's the canonical
 * detail-page slug TPS uses as a stable identifier).
 *
 * URL contract (verified from www.truepeoplesearch.com, May 2026):
 *   /results?name=First+Last&citystatezip=Austin%2C+TX        bynameaddress
 *   /results?streetaddress=123+Main+St&citystatezip=...       byaddress
 *   /find/person/<slug>                                       per-person details
 *
 * Failure semantics mirror zillowScrapeDo: if the parsed HTML doesn't
 * contain at least the result-list container, we throw a TpsScrapeError
 * and let the caller fall back to RapidAPI. Never partial results.
 */

const { JSDOM } = require('jsdom');
const { scrape, ScrapeDoError } = require('./scrapeDoClient');

const TPS_BASE = 'https://www.truepeoplesearch.com';
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

class TpsScrapeError extends Error {
  constructor(message, { status = 0, reason } = {}) {
    super(message);
    this.name = 'TpsScrapeError';
    this.status = status;
    this.reason = reason;
  }
}

function buildSearchUrl(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  }
  return `${TPS_BASE}/results?${sp.toString()}`;
}

function text(el) {
  return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Pull a peo_id from a TPS detail-page URL. We use the slug (last path
 * segment) as the stable identifier — TPS persists it across reloads.
 *   /find/person/abc123xyz → "abc123xyz"
 */
function peoIdFromHref(href) {
  if (!href) return null;
  const clean = href.split('?')[0].replace(/\/$/, '');
  const segs = clean.split('/');
  const last = segs[segs.length - 1];
  return last && /^[A-Za-z0-9_-]{4,}$/.test(last) ? last : null;
}

/**
 * Parse a TPS /results page into { people: [...] }.
 * Each person carries enough surface info to render a list + a peo_id the
 * caller can pass to detailsByPeoId for the deep record.
 */
function parseSearchResults(html) {
  if (typeof html !== 'string' || html.length < 200) {
    throw new TpsScrapeError('TPS returned empty/short body', { reason: 'empty_html' });
  }
  let dom;
  try {
    dom = new JSDOM(html);
  } catch (err) {
    throw new TpsScrapeError(`jsdom parse failed: ${err.message}`, { reason: 'jsdom_failed' });
  }
  const doc = dom.window.document;

  // TPS wraps each result in a <div class="card card-block shadow-form ..."> that
  // contains a primary link to /find/person/<slug>. We anchor on the link and
  // walk up to the card to extract age, location, and prior addresses.
  const cards = Array.from(doc.querySelectorAll('div.card.card-block')).filter((c) =>
    c.querySelector('a[href^="/find/person/"]')
  );

  if (cards.length === 0) {
    // Real "no match" pages still contain the search form + a results container.
    // Only throw if the page also doesn't contain the expected layout — which
    // means we got captcha'd or rate-limited.
    const hasResultsLayout = doc.querySelector('div#personList, div.content-center, h1');
    if (!hasResultsLayout) {
      throw new TpsScrapeError('TPS results page missing layout (likely block)', {
        reason: 'no_layout',
      });
    }
    return { people: [], totalResultCount: 0 };
  }

  const people = cards.map((card) => {
    const link = card.querySelector('a[href^="/find/person/"]');
    const href = link?.getAttribute('href') || '';
    const peoId = peoIdFromHref(href);
    const name = text(link);

    // Age is rendered as "Age 53" inside a span — search the card text.
    const ageMatch = card.textContent.match(/Age\s+(\d{1,3})/i);
    const age = ageMatch ? Number(ageMatch[1]) : null;

    // Current city/state is the first <span> after the name link inside a div
    // with class containing "content-value". We're tolerant of layout drift.
    const cityState =
      text(card.querySelector('.content-value, .h5')) ||
      (card.textContent.match(/Lives in\s+([^\n]+)/i) || [])[1] ||
      null;

    // Previous addresses + relatives are bulleted under "Previous Address" /
    // "Possible Relatives" labels. We collect the immediate sibling text.
    const prevAddresses = collectAfterLabel(card, /previous address/i);
    const relatives = collectAfterLabel(card, /relatives?/i);

    return {
      peo_id: peoId,
      name,
      age,
      cityState: cityState ? String(cityState).trim() : null,
      previousAddresses: prevAddresses,
      relatives,
      detailUrl: href ? `${TPS_BASE}${href}` : null,
    };
  });

  return { people, totalResultCount: people.length };
}

function collectAfterLabel(card, labelRe) {
  const out = [];
  // Find spans/divs whose own text matches the label, then walk forward
  // siblings collecting up to 5 strings.
  const candidates = card.querySelectorAll('span, div, h6, h5, b, strong');
  for (const el of candidates) {
    if (labelRe.test(el.textContent || '')) {
      let sib = el.nextElementSibling;
      let i = 0;
      while (sib && i < 5) {
        const t = text(sib);
        if (t && t.length < 200) out.push(t);
        sib = sib.nextElementSibling;
        i += 1;
      }
      if (out.length > 0) break;
    }
  }
  return out;
}

/**
 * Parse a TPS person-detail page into a normalized record.
 * Surfaces the fields downstream skip-trace consumers actually use:
 * phones, emails, address history, relatives, age, names/aliases.
 */
function parsePersonDetails(html) {
  if (typeof html !== 'string' || html.length < 200) {
    throw new TpsScrapeError('TPS detail returned empty/short body', {
      reason: 'empty_html',
    });
  }
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const name = text(doc.querySelector('h1'));
  const ageMatch = doc.body.textContent.match(/Age\s+(\d{1,3})/i);
  const age = ageMatch ? Number(ageMatch[1]) : null;

  // Phones are rendered as <a href="tel:..."> or as <span itemprop="telephone">.
  const phones = uniq(
    [
      ...Array.from(doc.querySelectorAll('a[href^="tel:"]')).map((a) =>
        a.getAttribute('href').replace(/^tel:/, '').trim()
      ),
      ...Array.from(doc.querySelectorAll('[itemprop="telephone"]')).map((n) => text(n)),
      ...Array.from(doc.querySelectorAll('span.phone-number')).map((n) => text(n)),
    ]
      .map(normalizePhone)
      .filter(Boolean)
  );

  // Emails: <a href="mailto:..."> and bare email regex sweep over body text.
  const emails = uniq(
    [
      ...Array.from(doc.querySelectorAll('a[href^="mailto:"]')).map((a) =>
        a.getAttribute('href').replace(/^mailto:/, '').trim()
      ),
      ...(doc.body.textContent.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []),
    ].map((e) => e.toLowerCase())
  );

  // JSDOM 23 has flaky behaviour with comma-separated selector lists when
  // only one side matches, so query each candidate individually.
  const currentAddress =
    text(doc.querySelector('[itemprop="address"]')) ||
    text(doc.querySelector('.current-address')) ||
    '';
  const previousAddresses = collectByHeading(doc, /previous addresses?/i);
  const relatives = collectByHeading(doc, /possible relatives|relatives/i);
  const associates = collectByHeading(doc, /associates|known associates/i);
  const aliases = collectByHeading(doc, /aliases|also known as|aka/i);

  return {
    name: name || undefined,
    age: age ?? undefined,
    phones,
    emails,
    addresses: [currentAddress, ...previousAddresses].filter(Boolean),
    relatives,
    associates,
    aliases,
  };
}

function collectByHeading(doc, headingRe) {
  const out = [];
  const headings = doc.querySelectorAll('h2, h3, h4, h5, h6, .section-header');
  for (const h of headings) {
    if (!headingRe.test(h.textContent || '')) continue;
    // Walk forward until we hit another heading or run out of siblings.
    let sib = h.nextElementSibling;
    let i = 0;
    while (sib && i < 30) {
      if (/^H[2-6]$/.test(sib.tagName)) break;
      const txt = text(sib);
      if (txt && txt.length < 200) out.push(txt);
      sib = sib.nextElementSibling;
      i += 1;
    }
    if (out.length > 0) break;
  }
  return uniq(out);
}

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.trim();
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

// ──────────────────────────────── Actions ───────────────────────────────────

/**
 * V1-equivalent: /search/byaddress
 * Maps {street, citystatezip} → TPS /results?streetaddress&citystatezip.
 */
async function byaddress({ street, citystatezip }) {
  if (!street || !citystatezip) {
    throw new TpsScrapeError('byaddress requires street + citystatezip', { reason: 'bad_args' });
  }
  return runSearch({ streetaddress: street, citystatezip });
}

/**
 * V1-equivalent: /search/bynameaddress
 * Maps {name, citystatezip} → TPS /results?name&citystatezip.
 */
async function bynameaddress({ name, citystatezip }) {
  if (!name || !citystatezip) {
    throw new TpsScrapeError('bynameaddress requires name + citystatezip', { reason: 'bad_args' });
  }
  return runSearch({ name, citystatezip });
}

/**
 * V1-equivalent: /search/detailsbyID
 * Resolves a TPS peo_id (the /find/person/<slug>) into a full record.
 */
async function detailsByPeoId(peoId) {
  if (!peoId || typeof peoId !== 'string') {
    throw new TpsScrapeError('detailsByPeoId requires a peoId', { reason: 'bad_args' });
  }
  const url = `${TPS_BASE}/find/person/${encodeURIComponent(peoId)}`;
  const resp = await safeScrape(url);
  const details = parsePersonDetails(resp.data);
  return { peo_id: peoId, ...details };
}

async function runSearch(params) {
  const url = buildSearchUrl(params);
  const resp = await safeScrape(url);
  return parseSearchResults(resp.data);
}

async function safeScrape(url) {
  try {
    return await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      // TPS gates basic queries behind a JS challenge intermittently. We
      // start without render=true and let the caller flip the env var if
      // block rate climbs (handled inside scrapeDoClient via SCRAPE_DO_RENDER).
      render: process.env.SCRAPE_DO_TPS_RENDER === 'true',
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new TpsScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
}

module.exports = {
  TpsScrapeError,
  byaddress,
  bynameaddress,
  detailsByPeoId,
  // Exported for tests:
  parseSearchResults,
  parsePersonDetails,
  buildSearchUrl,
  peoIdFromHref,
  normalizePhone,
};
