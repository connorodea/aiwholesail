#!/usr/bin/env node
/**
 * generate-pseo-content.js — LLM-enriched copy for pSEO city pages
 *
 * For each (city × strategy) and (city × distress) combo, generates a unique
 * 250–400 word block: market-aware intro paragraph, 3 strategy-specific
 * insights, and a market-data callout. Reads city stats from cities.json
 * to keep claims grounded in real numbers.
 *
 * Output: src/data/generated/pseo-copy.json
 *   { "<route>": { intro, insights[3], callout, generatedAt, model } }
 *
 * Cost & safety guardrails:
 *  - Model: claude-haiku-4-5 (cheap, fast for 250-word intros)
 *  - Hard $200 budget cap (defensive — actual full-run cost is ~$10-15)
 *  - Output caching: skip routes already in pseo-copy.json (zero-cost re-runs)
 *  - Concurrency: 5 parallel requests max
 *  - Rate limit: exponential backoff on 429
 *  - Note: prompt-prefix caching (cache_control marker on system block) is set
 *    but inactive because the prompt is below Haiku 4.5's 4096-token minimum.
 *    The marker is harmless and activates automatically if the system prompt
 *    grows past the threshold (e.g. by adding worked style examples).
 *
 * Usage:
 *   node scripts/generate-pseo-content.js                         # full run
 *   node scripts/generate-pseo-content.js --limit 10              # 10 routes only
 *   node scripts/generate-pseo-content.js --dry-run               # no API calls
 *   node scripts/generate-pseo-content.js --target invest         # only /invest/* routes
 *   node scripts/generate-pseo-content.js --target deals          # only /deals/* routes
 *   node scripts/generate-pseo-content.js --regenerate            # ignore cache
 *   node scripts/generate-pseo-content.js --budget 50             # override $ cap
 *
 * Requires: ANTHROPIC_API_KEY env var.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// --------------------------------------------------------------------------
// CLI args
// --------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const LIMIT = parseInt(arg('limit', '0'), 10);
const DRY_RUN = flag('dry-run');
const REGENERATE = flag('regenerate');
const TARGET = arg('target', 'all'); // 'invest' | 'deals' | 'all'
const BUDGET_USD = parseFloat(arg('budget', '200'));
const CONCURRENCY = parseInt(arg('concurrency', '5'), 10);

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------
const MODEL = 'claude-haiku-4-5';
// Pricing per 1M tokens (haiku 4.5)
const INPUT_COST_PER_M = 1.0;
const OUTPUT_COST_PER_M = 5.0;
const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

const CITIES_PATH = path.join(ROOT, 'src', 'data', 'cities.json');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'generated');
const OUT_PATH = path.join(OUT_DIR, 'pseo-copy.json');

const STRATEGIES = [
  { slug: 'wholesale', label: 'wholesaling' },
  { slug: 'flip', label: 'fix-and-flip' },
  { slug: 'rental', label: 'long-term rental' },
  { slug: 'brrrr', label: 'BRRRR (buy/rehab/rent/refinance/repeat)' },
  { slug: 'subject-to', label: 'subject-to financing' },
  { slug: 'seller-financing', label: 'seller financing' },
  { slug: 'foreclosure', label: 'foreclosure investing' },
  { slug: 'pre-foreclosure', label: 'pre-foreclosure outreach' },
  { slug: 'tax-lien', label: 'tax lien investing' },
  { slug: 'probate', label: 'probate-lead investing' },
  { slug: 'absentee-owner', label: 'absentee-owner outreach' },
  { slug: 'distressed', label: 'distressed property investing' },
];

const DISTRESS_TYPES = [
  { slug: 'pre-foreclosure', label: 'pre-foreclosure leads' },
  { slug: 'tax-delinquent', label: 'tax-delinquent property leads' },
  { slug: 'probate', label: 'probate leads' },
  { slug: 'code-violations', label: 'code-violation leads' },
  { slug: 'absentee-owners', label: 'absentee-owner leads' },
  { slug: 'vacant-properties', label: 'vacant-property leads' },
  { slug: 'high-equity', label: 'high-equity owner leads' },
  { slug: 'fsbo', label: 'FSBO (for sale by owner) leads' },
  { slug: 'expired-listings', label: 'expired-listing leads' },
];

// --------------------------------------------------------------------------
// Setup
// --------------------------------------------------------------------------
if (!DRY_RUN && !process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set. Use --dry-run to test without it.');
  process.exit(1);
}

const client = DRY_RUN ? null : new Anthropic();
const cities = JSON.parse(fs.readFileSync(CITIES_PATH, 'utf8'));

fs.mkdirSync(OUT_DIR, { recursive: true });
let existing = {};
if (fs.existsSync(OUT_PATH)) {
  existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
}

// --------------------------------------------------------------------------
// Build the route list
// --------------------------------------------------------------------------
const routes = [];
if (TARGET === 'invest' || TARGET === 'all') {
  for (const strategy of STRATEGIES) {
    for (const city of cities) {
      routes.push({
        key: `/invest/${strategy.slug}/${city.slug}`,
        kind: 'invest',
        city,
        category: strategy,
      });
    }
  }
}
if (TARGET === 'deals' || TARGET === 'all') {
  for (const distress of DISTRESS_TYPES) {
    for (const city of cities) {
      routes.push({
        key: `/deals/${distress.slug}/${city.slug}`,
        kind: 'deals',
        city,
        category: distress,
      });
    }
  }
}

// --------------------------------------------------------------------------
// System prompt (cached — frozen across all calls)
// --------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a real-estate investing content writer for AIWholesail, a platform that helps wholesalers and investors find off-market deals across US cities.

You generate market-aware copy for landing pages targeting (city × strategy) combinations. Your output must be unique per page — Google penalizes templated thin content.

Style guide:
- Voice: confident, practical, specific. Investor-to-investor tone.
- No marketing fluff ("amazing", "incredible"). No first-person ("we", "our platform"). No second-person CTAs ("buy our tool").
- Use the actual city stats provided. Don't invent numbers.
- Vary sentence structure across pages. Don't reuse phrasings between cities.
- 250-400 words combined across intro + insights + callout.
- Output format: JSON only. No markdown, no preamble, no explanation. Schema:
  {
    "intro": "<2-3 sentence intro paragraph that names the city, the strategy, and a key market signal>",
    "insights": [
      "<sentence 1: what makes this strategy work in this city>",
      "<sentence 2: a tactical observation about local conditions>",
      "<sentence 3: a specific opportunity or risk an investor should know>"
    ],
    "callout": "<1-2 sentence market-data callout citing 1-2 specific numbers from the city stats>"
  }

Each insight is one sentence (15-30 words). The intro and callout are short paragraphs.`;

// --------------------------------------------------------------------------
// Per-route prompt
// --------------------------------------------------------------------------
function buildUserPrompt(route) {
  const c = route.city;
  const cat = route.category;
  const tempLabel = { hot: 'hot (rising)', warm: 'warm (steady growth)', cool: 'cool (slow/declining)' }[c.marketTemp] || c.marketTemp;
  const investorMix = (c.investorTypes || []).join(', ');

  return `City: ${c.city}, ${c.state} (${c.stateFull})
Strategy/category: ${cat.label} (slug: ${cat.slug})
Page kind: ${route.kind === 'invest' ? '/invest/<strategy>/<city>' : '/deals/<distress-type>/<city>'}

Market stats:
- Population: ${c.population.toLocaleString()}
- Median home price: $${c.medianHomePrice.toLocaleString()}
- Avg rent: $${c.avgRent.toLocaleString()}/mo
- Price growth (YoY): ${c.priceGrowth}%
- Market temperature: ${tempLabel}
- Active investor types: ${investorMix || 'mixed'}
- Top zip codes: ${(c.topZips && c.topZips.length) ? c.topZips.join(', ') : 'not yet mapped'}

Generate the JSON object now.`;
}

// --------------------------------------------------------------------------
// LLM call with prompt caching
// --------------------------------------------------------------------------
let totalCost = 0;
let cacheHits = 0;
let cacheWrites = 0;

async function callClaude(route, attempt = 0) {
  const userPrompt = buildUserPrompt(route);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const usage = response.usage;
    const inTokens = usage.input_tokens || 0;
    const outTokens = usage.output_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
    if (cacheReadTokens > 0) cacheHits++;
    if (cacheWriteTokens > 0) cacheWrites++;

    const cost =
      (inTokens / 1e6) * INPUT_COST_PER_M +
      (outTokens / 1e6) * OUTPUT_COST_PER_M +
      (cacheReadTokens / 1e6) * INPUT_COST_PER_M * CACHE_READ_MULT +
      (cacheWriteTokens / 1e6) * INPUT_COST_PER_M * CACHE_WRITE_MULT;
    totalCost += cost;

    // Extract text (response.content is an array of content blocks)
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('No text block in response');
    let raw = textBlock.text.trim();

    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`JSON parse failed for ${route.key}: ${e.message}\nRaw: ${raw.slice(0, 200)}`);
    }

    // Validate shape
    if (typeof parsed.intro !== 'string' || !Array.isArray(parsed.insights) || typeof parsed.callout !== 'string') {
      throw new Error(`Bad schema for ${route.key}: ${JSON.stringify(parsed).slice(0, 200)}`);
    }
    if (parsed.insights.length !== 3) {
      // Be flexible — pad or truncate to 3
      if (parsed.insights.length > 3) parsed.insights = parsed.insights.slice(0, 3);
      else while (parsed.insights.length < 3) parsed.insights.push('');
    }

    return {
      intro: parsed.intro,
      insights: parsed.insights,
      callout: parsed.callout,
      generatedAt: new Date().toISOString(),
      model: MODEL,
    };
  } catch (err) {
    // Retry with exponential backoff on rate limit / server errors
    if (attempt < 4 && (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError)) {
      const delay = 1000 * Math.pow(2, attempt);
      console.warn(`[${route.key}] retry ${attempt + 1} after ${delay}ms: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return callClaude(route, attempt + 1);
    }
    throw err;
  }
}

// --------------------------------------------------------------------------
// Worker pool
// --------------------------------------------------------------------------
async function runWorkers(toGenerate) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const failures = [];

  const queue = [...toGenerate];

  async function worker(workerId) {
    while (queue.length > 0) {
      if (totalCost >= BUDGET_USD) {
        console.warn(`[budget] $${totalCost.toFixed(2)} >= $${BUDGET_USD} — aborting`);
        break;
      }
      const route = queue.shift();
      if (!route) break;
      processed++;
      try {
        const result = await callClaude(route);
        existing[route.key] = result;
        succeeded++;
        // Persist incrementally every 25 successes — survives crashes
        if (succeeded % 25 === 0) {
          fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n');
        }
        if (succeeded % 10 === 0) {
          process.stdout.write(`  ${processed}/${toGenerate.length} done | $${totalCost.toFixed(3)} | cache: ${cacheHits}H/${cacheWrites}W\n`);
        }
      } catch (err) {
        failed++;
        failures.push({ key: route.key, error: err.message });
        console.error(`[${route.key}] FAILED: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, toGenerate.length) }, (_, i) => worker(i));
  await Promise.all(workers);

  return { processed, succeeded, failed, failures };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  console.log(`Cities loaded:    ${cities.length}`);
  console.log(`Routes possible:  ${routes.length} (target=${TARGET})`);
  console.log(`Already cached:   ${Object.keys(existing).length}`);

  let toGenerate = REGENERATE ? routes : routes.filter((r) => !existing[r.key]);
  if (LIMIT > 0) toGenerate = toGenerate.slice(0, LIMIT);

  console.log(`To generate:      ${toGenerate.length}`);
  console.log(`Model:            ${MODEL}`);
  console.log(`Concurrency:      ${CONCURRENCY}`);
  console.log(`Budget cap:       $${BUDGET_USD.toFixed(2)}`);
  console.log(`Output:           ${OUT_PATH}`);

  if (DRY_RUN) {
    console.log('\n--dry-run: no API calls. Sample prompt:');
    if (toGenerate.length > 0) {
      console.log('---');
      console.log(buildUserPrompt(toGenerate[0]));
      console.log('---');
    }
    return;
  }

  if (toGenerate.length === 0) {
    console.log('Nothing to generate. Use --regenerate to overwrite.');
    return;
  }

  const start = Date.now();
  const { processed, succeeded, failed, failures } = await runWorkers(toGenerate);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Final flush
  fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n');

  console.log('\n--- Done ---');
  console.log(`Processed: ${processed}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Cache hits: ${cacheHits} / writes: ${cacheWrites}`);
  console.log(`Total cost: $${totalCost.toFixed(3)}`);
  console.log(`Elapsed:    ${elapsed}s`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 20)) console.log(`  ${f.key}: ${f.error}`);
    if (failures.length > 20) console.log(`  ... ${failures.length - 20} more`);
  }
}

main().catch((err) => {
  // Final flush even on error
  try { fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n'); } catch {}
  console.error('FATAL:', err);
  process.exit(1);
});
