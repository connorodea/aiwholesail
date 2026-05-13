/**
 * Unit tests for the TruePeopleSearch parser.
 * Fixture-based — no network. Pairs with lib/scrapers/truePeopleSearch.js.
 *
 *   $ node --test test/lib/scrapers/truePeopleSearch.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSearchResults,
  parsePersonDetails,
  buildSearchUrl,
  peoIdFromHref,
  normalizePhone,
} = require('../../lib/scrapers/truePeopleSearch');

// ──────────────────────── pure helpers ────────────────────────

test('peoIdFromHref', () => {
  assert.equal(peoIdFromHref('/find/person/abc123xyz'), 'abc123xyz');
  assert.equal(peoIdFromHref('/find/person/abc123xyz/'), 'abc123xyz');
  assert.equal(peoIdFromHref('/find/person/abc-123_xyz?ref=results'), 'abc-123_xyz');
  assert.equal(peoIdFromHref(''), null);
  assert.equal(peoIdFromHref(null), null);
  // too short → rejected
  assert.equal(peoIdFromHref('/find/person/a'), null);
});

test('normalizePhone', () => {
  assert.equal(normalizePhone('5551234567'), '(555) 123-4567');
  assert.equal(normalizePhone('15551234567'), '(555) 123-4567');
  assert.equal(normalizePhone('(555) 123-4567'), '(555) 123-4567');
  assert.equal(normalizePhone('555.123.4567'), '(555) 123-4567');
  assert.equal(normalizePhone(''), '');
  // weird input passes through trimmed
  assert.equal(normalizePhone('  abc  '), 'abc');
});

test('buildSearchUrl', () => {
  const url = buildSearchUrl({ name: 'John Smith', citystatezip: 'Austin, TX' });
  assert.match(url, /^https:\/\/www\.truepeoplesearch\.com\/results\?/);
  assert.match(url, /name=John\+Smith/);
  assert.match(url, /citystatezip=Austin%2C\+TX/);
});

// ──────────────────────── parseSearchResults ────────────────────────

function searchResultFixture(cards) {
  return `<!doctype html><html><body>
<div id="personList">
  ${cards.map(cardHtml).join('\n')}
</div>
</body></html>`;
}

function cardHtml({ slug, name, age, cityState, prevAddr = [], relatives = [] }) {
  return `<div class="card card-block shadow-form">
  <a href="/find/person/${slug}">${name}</a>
  <span class="content-value">${cityState}</span>
  <span>Age ${age}</span>
  <h6>Previous Address</h6>
  ${prevAddr.map((a) => `<div>${a}</div>`).join('')}
  <h6>Relatives</h6>
  ${relatives.map((r) => `<div>${r}</div>`).join('')}
</div>`;
}

test('parseSearchResults — extracts cards', () => {
  const html = searchResultFixture([
    {
      slug: 'jdoe123',
      name: 'John Doe',
      age: 47,
      cityState: 'Austin, TX',
      prevAddr: ['123 Main St, Austin, TX'],
      relatives: ['Jane Doe', 'Mary Doe'],
    },
    {
      slug: 'jdoe456',
      name: 'Johnny Doe',
      age: 22,
      cityState: 'Houston, TX',
    },
  ]);
  const out = parseSearchResults(html);
  assert.equal(out.people.length, 2);
  assert.equal(out.totalResultCount, 2);
  assert.equal(out.people[0].peo_id, 'jdoe123');
  assert.equal(out.people[0].name, 'John Doe');
  assert.equal(out.people[0].age, 47);
  assert.equal(out.people[0].cityState, 'Austin, TX');
  assert.ok(out.people[0].previousAddresses.includes('123 Main St, Austin, TX'));
  assert.ok(out.people[0].relatives.includes('Jane Doe'));
  assert.equal(out.people[0].detailUrl, 'https://www.truepeoplesearch.com/find/person/jdoe123');
});

test('parseSearchResults — empty results page still parses', () => {
  // Pad past the 200-char min-body guard so we exercise the real
  // "no cards but layout present" branch, not the empty-body bail-out.
  const padding = ' '.repeat(300);
  const html = `<!doctype html><html><body>
<h1>No matches</h1>
<div id="personList"></div>
${padding}
</body></html>`;
  const out = parseSearchResults(html);
  assert.equal(out.people.length, 0);
  assert.equal(out.totalResultCount, 0);
});

test('parseSearchResults — throws on captcha/blocked page', () => {
  // Pad past the empty-body guard. No layout markers, no cards →
  // we should diagnose a soft-block.
  const padding = ' '.repeat(300);
  const html = `<html><body>${padding}<p>Please verify you are human</p></body></html>`;
  assert.throws(() => parseSearchResults(html), /missing layout/);
});

test('parseSearchResults — throws on empty body', () => {
  assert.throws(() => parseSearchResults(''), /empty\/short body/);
});

// ──────────────────────── parsePersonDetails ────────────────────────

test('parsePersonDetails — extracts phones, emails, addresses', () => {
  const html = `<!doctype html><html><body>
<h1>John Doe</h1>
<p>Age 47</p>
<div class="current-address">123 Main St, Austin, TX 78701</div>
<a href="tel:+15551234567">555-123-4567</a>
<a href="tel:5559876543">555-987-6543</a>
<a href="mailto:john@example.com">Email</a>
<h2>Previous Addresses</h2>
<div>456 Oak Ln, Dallas, TX</div>
<div>789 Pine Rd, Houston, TX</div>
<h2>Possible Relatives</h2>
<div>Jane Doe</div>
<div>Mary Smith</div>
</body></html>`;
  const out = parsePersonDetails(html);
  assert.equal(out.name, 'John Doe');
  assert.equal(out.age, 47);
  assert.ok(out.phones.includes('(555) 123-4567'));
  assert.ok(out.phones.includes('(555) 987-6543'));
  assert.ok(out.emails.includes('john@example.com'));
  assert.ok(out.addresses[0].startsWith('123 Main St'));
  assert.ok(out.addresses.includes('456 Oak Ln, Dallas, TX'));
  assert.ok(out.relatives.includes('Jane Doe'));
});

test('parsePersonDetails — dedups phones and emails', () => {
  const padding = ' '.repeat(300);
  const html = `<!doctype html><html><body>
<h1>X</h1>
${padding}
<a href="tel:5551234567">A</a>
<a href="tel:(555) 123-4567">B</a>
<a href="mailto:dup@x.com">A</a>
<a href="mailto:DUP@x.com">B</a>
</body></html>`;
  const out = parsePersonDetails(html);
  assert.equal(out.phones.length, 1);
  assert.equal(out.emails.length, 1);
});

test('parsePersonDetails — throws on empty body', () => {
  assert.throws(() => parsePersonDetails(''), /empty\/short body/);
});
