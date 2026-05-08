#!/usr/bin/env node
/**
 * build-cities-dataset.js — Enriches additional-cities input with derived data
 *
 * Reads:
 *   - src/data/cities.json         (existing canonical dataset)
 *   - src/data/counties.json       (used to derive home price / rent / growth for new cities)
 *   - src/data/zipcodes.json       (used for top-zip lookup + secondary signal)
 *   - data-raw/additional-cities.json  (input — new cities with at minimum slug/city/state/stateFull/population)
 *
 * For each input city not already in cities.json, derives:
 *   - medianHomePrice, avgRent, priceGrowth → from parent county (matched via topCities[]),
 *                                              fallback to same-state county average
 *   - topZips → first 5 zips in zipcodes.json with matching citySlug, fallback to []
 *   - investorTypes → derived from medianHomePrice + population tier
 *   - marketTemp → derived from priceGrowth (>5%=hot, 3-5%=warm, <3%=cool)
 *
 * Writes:
 *   - src/data/cities.json (in place — extended, sorted by population descending)
 *
 * Usage:
 *   node scripts/build-cities-dataset.js [--dry-run] [--print]
 *
 * Idempotent: re-running with the same input produces the same output.
 * Cities already in cities.json are not modified.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const CITIES_PATH = path.join(ROOT, 'src', 'data', 'cities.json');
const COUNTIES_PATH = path.join(ROOT, 'src', 'data', 'counties.json');
const ZIPCODES_PATH = path.join(ROOT, 'src', 'data', 'zipcodes.json');
const INPUT_PATH = path.join(ROOT, 'data-raw', 'additional-cities.json');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const PRINT = args.has('--print');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const existingCities = loadJson(CITIES_PATH);
const counties = loadJson(COUNTIES_PATH);
const zipcodes = loadJson(ZIPCODES_PATH);
const additional = loadJson(INPUT_PATH);

const existingSlugs = new Set(existingCities.map((c) => c.slug));

// Build lookup: citySlug → parent county (first match in counties.topCities)
const citySlugToCounty = new Map();
for (const county of counties) {
  for (const slug of county.topCities || []) {
    if (!citySlugToCounty.has(slug)) {
      citySlugToCounty.set(slug, county);
    }
  }
}

// Build lookup: state → array of counties for fallback averaging
const stateToCounties = new Map();
for (const county of counties) {
  if (!stateToCounties.has(county.state)) stateToCounties.set(county.state, []);
  stateToCounties.get(county.state).push(county);
}

// Build lookup: citySlug → zip entries
const citySlugToZips = new Map();
for (const z of zipcodes) {
  if (!z.citySlug) continue;
  if (!citySlugToZips.has(z.citySlug)) citySlugToZips.set(z.citySlug, []);
  citySlugToZips.get(z.citySlug).push(z);
}

function avgField(items, field) {
  if (!items.length) return null;
  const sum = items.reduce((s, x) => s + (x[field] || 0), 0);
  return Math.round(sum / items.length);
}

function deriveMarketTemp(priceGrowth) {
  if (priceGrowth >= 5) return 'hot';
  if (priceGrowth >= 3) return 'warm';
  return 'cool';
}

function deriveInvestorTypes(medianHomePrice, population, investorActivity) {
  const types = [];
  // Wholesale works in most markets, especially distressed/lower-priced
  if (medianHomePrice < 500000) types.push('wholesale');
  // Flips need price appreciation potential and ARV spread
  if (medianHomePrice >= 200000 && medianHomePrice < 700000) types.push('flip');
  // Rentals work where prices and rents make sense (most markets)
  if (medianHomePrice < 800000) types.push('rental');
  // Larger markets often support BRRRR
  if (population >= 100000 && medianHomePrice < 600000) {
    if (!types.includes('brrrr')) types.push('brrrr');
  }
  // High-activity markets get more aggressive strategy mix
  if (investorActivity === 'high' && !types.includes('flip')) types.push('flip');
  // Always include at least wholesale for very small markets
  if (types.length === 0) types.push('wholesale');
  return types.slice(0, 3); // cap at 3 like existing data
}

function enrichCity(input) {
  const county = citySlugToCounty.get(input.slug);
  let medianHomePrice, avgRent, priceGrowth, investorActivity;

  if (county) {
    // Primary signal: parent county data
    medianHomePrice = county.medianHomePrice;
    avgRent = county.avgRent;
    priceGrowth = county.priceGrowth;
    investorActivity = county.investorActivity || 'medium';
  } else {
    // Fallback: average of all counties in the same state
    const stateCounties = stateToCounties.get(input.state) || [];
    if (stateCounties.length) {
      medianHomePrice = avgField(stateCounties, 'medianHomePrice');
      avgRent = avgField(stateCounties, 'avgRent');
      // priceGrowth: average across counties, rounded to one decimal
      priceGrowth = Math.round((stateCounties.reduce((s, c) => s + (c.priceGrowth || 0), 0) / stateCounties.length) * 10) / 10;
      investorActivity = 'medium';
    } else {
      // Last-resort: state-wide averages from existing cities
      const stateCities = existingCities.filter((c) => c.state === input.state);
      if (stateCities.length) {
        medianHomePrice = avgField(stateCities, 'medianHomePrice');
        avgRent = avgField(stateCities, 'avgRent');
        priceGrowth = Math.round((stateCities.reduce((s, c) => s + (c.priceGrowth || 0), 0) / stateCities.length) * 10) / 10;
      } else {
        // No data anywhere — use national-ish defaults
        medianHomePrice = 350000;
        avgRent = 1800;
        priceGrowth = 3.5;
      }
      investorActivity = 'medium';
    }
  }

  // Apply small population-based adjustment: larger cities slightly above county median
  if (input.population >= 150000) {
    medianHomePrice = Math.round(medianHomePrice * 1.05);
    avgRent = Math.round(avgRent * 1.05);
  } else if (input.population < 30000) {
    medianHomePrice = Math.round(medianHomePrice * 0.92);
    avgRent = Math.round(avgRent * 0.92);
  }

  // Round to nice numbers
  medianHomePrice = Math.round(medianHomePrice / 1000) * 1000;
  avgRent = Math.round(avgRent / 50) * 50;

  // Top zips for this city, if any
  const zips = (citySlugToZips.get(input.slug) || []).slice(0, 5).map((z) => z.zip);

  return {
    slug: input.slug,
    city: input.city,
    state: input.state,
    stateFull: input.stateFull,
    population: input.population,
    medianHomePrice,
    avgRent,
    priceGrowth,
    topZips: zips,
    investorTypes: deriveInvestorTypes(medianHomePrice, input.population, investorActivity),
    marketTemp: deriveMarketTemp(priceGrowth),
  };
}

// Enrich
const skipped = [];
const added = [];
for (const input of additional) {
  if (existingSlugs.has(input.slug)) {
    skipped.push(input.slug);
    continue;
  }
  if (!input.slug || !input.city || !input.state || !input.stateFull || !input.population) {
    console.error(`SKIP ${input.slug || '(no slug)'}: missing required field`);
    continue;
  }
  added.push(enrichCity(input));
}

// Merge + sort by population descending (matches existing dataset's apparent ordering)
const merged = [...existingCities, ...added].sort((a, b) => b.population - a.population);

if (PRINT) {
  console.log(JSON.stringify(added, null, 2));
}

console.log(`Existing cities: ${existingCities.length}`);
console.log(`Input cities:    ${additional.length}`);
console.log(`Skipped (already present): ${skipped.length}${skipped.length ? ': ' + skipped.join(', ') : ''}`);
console.log(`Added:           ${added.length}`);
console.log(`Total:           ${merged.length}`);

if (DRY_RUN) {
  console.log('--dry-run: not writing cities.json');
} else {
  fs.writeFileSync(CITIES_PATH, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Wrote ${CITIES_PATH}`);
}
