#!/usr/bin/env node
/**
 * AIWholesail CLI — Test search, enrichment, and spread analysis
 * Usage: node cli-test.js <location> [--limit N] [--deals-only]
 */

const API = 'https://api.aiwholesail.com/zillow/zillow';

async function callAPI(payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// State name → abbreviation
const STATES = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',
  connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',
  illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',
  maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',
  missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ',
  'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',
  oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
  washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY'
};

function normalizeLocation(loc) {
  const abbr = STATES[loc.toLowerCase().trim()];
  return abbr || loc;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node cli-test.js <location> [--pages N] [--deals-only]');
    console.log('  e.g. node cli-test.js "Detroit, MI"');
    console.log('       node cli-test.js Michigan --pages 5 --deals-only');
    process.exit(1);
  }

  const location = normalizeLocation(args[0]);
  const maxPages = parseInt(args[args.indexOf('--pages') + 1]) || 3;
  const dealsOnly = args.includes('--deals-only');

  console.log(`\n🔍 Searching: "${location}" (${maxPages} pages)\n`);

  // Step 1: Search
  const startSearch = Date.now();
  let allListings = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const result = await callAPI({
        action: 'search',
        searchParams: { location, homeType: 'house', page: String(page) }
      });
      const data = result?.data?.data || result?.data || {};
      const listings = data.listings || [];
      allListings.push(...listings);
      const total = data.total_results || '?';
      const totalPages = data.total_pages || '?';
      if (page === 1) console.log(`📊 Total available: ${total} properties (${totalPages} pages)`);
      process.stdout.write(`  Page ${page}: +${listings.length} (total: ${allListings.length})\r`);
      if (listings.length === 0) break;
    } catch (e) {
      console.log(`  Page ${page}: ERROR - ${e.message}`);
      break;
    }
  }
  const searchTime = ((Date.now() - startSearch) / 1000).toFixed(1);
  console.log(`\n✅ Search complete: ${allListings.length} properties in ${searchTime}s\n`);

  // Step 2: Batch enrich with zestimates (server-side)
  console.log(`🏠 Fetching Zestimates for ${allListings.length} properties via batch endpoint...`);
  const startEnrich = Date.now();
  const zpids = allListings.map(l => String(l.zpid));

  const batchRes = await fetch('https://api.aiwholesail.com/zillow/batch-zestimates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zpids }),
  });
  const batchData = await batchRes.json();
  const zestimates = batchData?.data || {};
  const withZest = Object.values(zestimates).filter(v => v !== null).length;

  const enrichTime = ((Date.now() - startEnrich) / 1000).toFixed(1);
  console.log(`✅ Enrichment complete in ${enrichTime}s (${withZest}/${allListings.length} have Zestimates)\n`);

  // Step 3: Find deals
  let deals = [];
  for (const l of allListings) {
    const z = zestimates[String(l.zpid)];
    if (z && l.price && z > l.price) {
      deals.push({ zpid: l.zpid, address: l.address, price: l.price, zestimate: z, spread: z - l.price });
    }
  }
  deals.sort((a, b) => b.spread - a.spread);

  console.log(`📈 RESULTS: ${deals.length} deals found out of ${allListings.length} properties (${withZest} had Zestimates)\n`);

  if (deals.length === 0) {
    console.log('No properties found priced below their Zestimate in this search.');
    console.log('This is normal — most listings are priced at or above market value.');
    console.log('Try different locations or increase --pages.\n');
  } else {
    console.log('  #  Address                                        Price     Zestimate       Spread      %');
    console.log('-'.repeat(95));

    const show = dealsOnly ? deals : deals;
    for (let i = 0; i < show.length; i++) {
      const d = show[i];
      const pct = ((d.spread / d.zestimate) * 100).toFixed(1);
      const tier = d.spread >= 100000 ? '🔥' : d.spread >= 50000 ? '⭐' : d.spread >= 30000 ? '✅' : '  ';
      console.log(
        `${tier}${String(i + 1).padStart(2)}  ${d.address.substring(0, 45).padEnd(45)} $${d.price.toLocaleString().padStart(11)} $${d.zestimate.toLocaleString().padStart(11)} $${d.spread.toLocaleString().padStart(11)} ${pct.padStart(5)}%`
      );
    }
  }

  // Summary
  const totalTime = ((Date.now() - startSearch) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${totalTime}s (search: ${searchTime}s, enrichment: ${enrichTime}s)`);
  console.log(`📊 ${allListings.length} searched → ${withZest} with Zestimates → ${deals.length} deals below market\n`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
