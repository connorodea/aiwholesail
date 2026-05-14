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
 * Modes:
 *  - Default (BATCH): submits all routes via Anthropic Message Batches API.
 *    50% off standard pricing. Sub-1-hour typical turnaround, 24h SLA.
 *    Full 5,500-route run costs ~$6.46 vs ~$13 sync.
 *  - --sync: classic concurrent calls. Use for small samples where you want
 *    immediate output (e.g. --limit 5 to spot-check quality).
 *
 * Output: src/data/generated/pseo-copy.json
 *   { "<route>": { intro, insights[3], callout, generatedAt, model } }
 *
 * Cost & safety guardrails:
 *  - Model: claude-haiku-4-5 (cheap, fast for 250-word intros)
 *  - Hard $200 budget cap (defensive — actual batch cost ~$6.50, sync ~$13)
 *  - Output caching: skip routes already in pseo-copy.json (zero-cost re-runs)
 *  - Sync mode: 5-way concurrency, exponential backoff on 429
 *  - Batch mode: single batch up to 100k requests, polls every 60s
 *  - Note: prompt-prefix caching (cache_control marker on system block) is set
 *    but inactive because the prompt is below Haiku 4.5's 4096-token minimum.
 *    The marker is harmless and activates automatically if the system prompt
 *    grows past the threshold.
 *
 * Usage:
 *   node scripts/generate-pseo-content.js                  # full run via batch
 *   node scripts/generate-pseo-content.js --sync --limit 5 # 5 sync calls (testing)
 *   node scripts/generate-pseo-content.js --dry-run        # no API calls
 *   node scripts/generate-pseo-content.js --target invest  # only /invest/* routes
 *   node scripts/generate-pseo-content.js --regenerate     # ignore cache
 *   node scripts/generate-pseo-content.js --budget 50      # override $ cap
 *   node scripts/generate-pseo-content.js --resume <id>    # resume an existing batch
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
const SYNC_MODE = flag('sync'); // default is batch
const RESUME_BATCH_ID = arg('resume', null);
const POLL_INTERVAL_MS = parseInt(arg('poll', '60000'), 10);

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------
const MODEL = 'claude-haiku-4-5';
// Pricing per 1M tokens (haiku 4.5)
const INPUT_COST_PER_M_SYNC = 1.0;
const OUTPUT_COST_PER_M_SYNC = 5.0;
// Batch tier: 50% off both directions
const INPUT_COST_PER_M_BATCH = 0.5;
const OUTPUT_COST_PER_M_BATCH = 2.5;
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
      (inTokens / 1e6) * INPUT_COST_PER_M_SYNC +
      (outTokens / 1e6) * OUTPUT_COST_PER_M_SYNC +
      (cacheReadTokens / 1e6) * INPUT_COST_PER_M_SYNC * CACHE_READ_MULT +
      (cacheWriteTokens / 1e6) * INPUT_COST_PER_M_SYNC * CACHE_WRITE_MULT;
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
// Batch mode helpers
// --------------------------------------------------------------------------

// Anthropic Batches API uses route.key as custom_id. They accept letters,
// digits, underscores, and hyphens — so we replace `/` with `__`.
function routeKeyToCustomId(key) {
  return key.replace(/^\//, '').replace(/\//g, '__');
}
function customIdToRouteKey(id) {
  return '/' + id.replace(/__/g, '/');
}

function buildBatchRequest(route) {
  return {
    custom_id: routeKeyToCustomId(route.key),
    params: {
      model: MODEL,
      max_tokens: 800,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: buildUserPrompt(route) }],
    },
  };
}

function parseAndValidate(messageContent, routeKey) {
  const textBlock = messageContent.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text block in response');
  let raw = textBlock.text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON parse failed for ${routeKey}: ${e.message}\nRaw: ${raw.slice(0, 200)}`);
  }
  if (typeof parsed.intro !== 'string' || !Array.isArray(parsed.insights) || typeof parsed.callout !== 'string') {
    throw new Error(`Bad schema for ${routeKey}: ${JSON.stringify(parsed).slice(0, 200)}`);
  }
  if (parsed.insights.length !== 3) {
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
}

async function runBatch(toGenerate) {
  let batchId = RESUME_BATCH_ID;

  // Project cost up-front (rough — assumes 600 input + 350 output per request)
  const projectedInputTokens = toGenerate.length * 600;
  const projectedOutputTokens = toGenerate.length * 350;
  const projectedCost =
    (projectedInputTokens / 1e6) * INPUT_COST_PER_M_BATCH +
    (projectedOutputTokens / 1e6) * OUTPUT_COST_PER_M_BATCH;
  console.log(`Projected cost (batch): ~$${projectedCost.toFixed(2)} (50% off sync)`);

  if (projectedCost > BUDGET_USD) {
    console.error(`Projected cost $${projectedCost.toFixed(2)} exceeds budget $${BUDGET_USD}. Use --budget to override.`);
    process.exit(1);
  }

  if (!batchId) {
    console.log(`Submitting batch of ${toGenerate.length} requests...`);
    const requests = toGenerate.map(buildBatchRequest);
    const batch = await client.messages.batches.create({ requests });
    batchId = batch.id;
    console.log(`Batch ID: ${batchId}`);
    console.log(`Status:   ${batch.processing_status}`);
    console.log(`(Resume later with: --resume ${batchId})`);
  } else {
    console.log(`Resuming batch: ${batchId}`);
  }

  // Poll
  let batch;
  while (true) {
    batch = await client.messages.batches.retrieve(batchId);
    const c = batch.request_counts;
    const elapsedMin = batch.created_at
      ? ((Date.now() - new Date(batch.created_at).getTime()) / 60000).toFixed(1)
      : '?';
    process.stdout.write(
      `  [${batch.processing_status}] processing=${c.processing} succeeded=${c.succeeded} errored=${c.errored} expired=${c.expired || 0} (${elapsedMin}m)\n`,
    );
    if (batch.processing_status === 'ended') break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.log('Batch ended. Streaming results...');

  // Stream results back. The SDK returns a JSONL parser-iterable.
  const routeMap = new Map(toGenerate.map((r) => [routeKeyToCustomId(r.key), r.key]));
  let succeeded = 0;
  let failed = 0;
  let actualInputTokens = 0;
  let actualOutputTokens = 0;
  const failures = [];

  for await (const result of await client.messages.batches.results(batchId)) {
    const routeKey = customIdToRouteKey(result.custom_id);
    const r = result.result;
    if (r.type === 'succeeded') {
      try {
        const enriched = parseAndValidate(r.message.content, routeKey);
        existing[routeKey] = enriched;
        succeeded++;
        const u = r.message.usage || {};
        actualInputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        actualOutputTokens += u.output_tokens || 0;
      } catch (err) {
        failed++;
        failures.push({ key: routeKey, error: err.message });
      }
    } else if (r.type === 'errored') {
      failed++;
      failures.push({ key: routeKey, error: `${r.error?.type || 'errored'}: ${r.error?.message || 'unknown'}` });
    } else if (r.type === 'expired') {
      failed++;
      failures.push({ key: routeKey, error: 'expired (24h SLA exceeded)' });
    } else if (r.type === 'canceled' || r.type === 'cancelled') {
      failed++;
      failures.push({ key: routeKey, error: 'canceled' });
    }

    // Persist every 100 results
    if ((succeeded + failed) % 100 === 0) {
      fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n');
    }
  }

  const actualCost =
    (actualInputTokens / 1e6) * INPUT_COST_PER_M_BATCH +
    (actualOutputTokens / 1e6) * OUTPUT_COST_PER_M_BATCH;
  totalCost = actualCost;

  console.log('\n--- Batch done ---');
  console.log(`Succeeded:        ${succeeded}`);
  console.log(`Failed/expired:   ${failed}`);
  console.log(`Input tokens:     ${actualInputTokens.toLocaleString()}`);
  console.log(`Output tokens:    ${actualOutputTokens.toLocaleString()}`);
  console.log(`Actual cost:      $${actualCost.toFixed(3)}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 20)) console.log(`  ${f.key}: ${f.error}`);
    if (failures.length > 20) console.log(`  ... ${failures.length - 20} more`);
  }

  return { succeeded, failed, failures };
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

  const mode = SYNC_MODE ? 'SYNC' : 'BATCH';
  console.log(`Mode:             ${mode}${RESUME_BATCH_ID ? ' (resume ' + RESUME_BATCH_ID + ')' : ''}`);
  console.log(`To generate:      ${toGenerate.length}`);
  console.log(`Model:            ${MODEL}`);
  if (SYNC_MODE) console.log(`Concurrency:      ${CONCURRENCY}`);
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

  if (toGenerate.length === 0 && !RESUME_BATCH_ID) {
    console.log('Nothing to generate. Use --regenerate to overwrite.');
    return;
  }

  const start = Date.now();

  if (SYNC_MODE) {
    await runWorkers(toGenerate);
  } else {
    await runBatch(toGenerate);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Final flush
  fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n');

  console.log(`\nTotal cost: $${totalCost.toFixed(3)}`);
  console.log(`Elapsed:    ${elapsed}s`);
}

main().catch((err) => {
  // Final flush even on error
  try { fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n'); } catch {}
  console.error('FATAL:', err);
  process.exit(1);
});
