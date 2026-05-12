#!/usr/bin/env node
/**
 * Google Ads Keyword Planner — gap-focused expansion for AIWholesail.
 *
 * Targets clusters NOT well covered in the April 30 keyword-research-report.csv:
 *  - AI real estate / PropTech intent
 *  - Skip tracing / direct mail / cold calling motion
 *  - Distress signal-specific (pre-foreclosure, tax delinquent, vacant)
 *  - Competitor comparison/alternative queries (PropStream/DealMachine/BatchLeads)
 *  - State + strategy combinations (wholesaling laws, license rules)
 *  - Calculator long-tail (MAO, BRRRR, 70% rule, ARV, DSCR)
 *  - Driving-for-dollars motion (DealMachine adjacent)
 *  - Cash buyer / buyer matching workflow
 *
 * Writes:
 *  - keyword-research-gaps.csv (all results with ROI score)
 *  - keyword-research-gaps.json (clustered + classified for content recs)
 */
const { GoogleAdsApi, enums } = require('google-ads-api');
const fs = require('fs');
const path = require('path');

// Prefer the unified token file from oauth-refresh-multi.js; fall back to ADC.
const UNIFIED_TOKEN = path.join(process.env.HOME, '.config/gcloud/aiw-oauth-tokens.json');
const ADC_PATH = path.join(process.env.HOME, '.config/gcloud/application_default_credentials.json');
const adc = JSON.parse(fs.readFileSync(
  fs.existsSync(UNIFIED_TOKEN) ? UNIFIED_TOKEN : ADC_PATH,
  'utf8'
));

const DEVELOPER_TOKEN = 'kRCDpeAatWU0jkitEB5Ycg';
const CUSTOMER_ID = '1754727937';
const OUTPUT_DIR = __dirname;

const SEED_KEYWORDS = [
  // --- AI / PropTech ---
  'AI real estate software',
  'AI for real estate investors',
  'AI deal finder',
  'AI property analysis',
  'machine learning real estate',
  'real estate AI tools',
  // --- Competitor comparisons ---
  'PropStream alternative',
  'PropStream vs',
  'PropStream review',
  'DealMachine alternative',
  'DealMachine review',
  'BatchLeads alternative',
  'BatchLeads review',
  'BiggerPockets alternative',
  'best real estate investing software',
  'best wholesale real estate software',
  // --- Skip tracing motion ---
  'skip tracing',
  'skip tracing for real estate',
  'skip trace property owner',
  'find property owner phone number',
  'cheapest skip tracing service',
  'skip tracing software',
  // --- Distress signals ---
  'pre foreclosure list',
  'pre foreclosure leads',
  'tax delinquent property list',
  'vacant property list',
  'absentee owner list',
  'high equity leads',
  'probate leads real estate',
  'code violation list',
  // --- Direct mail / cold calling ---
  'real estate direct mail',
  'yellow letters real estate',
  'cold calling for real estate',
  'real estate text marketing',
  'motivated seller marketing',
  'driving for dollars',
  // --- Calculators long-tail ---
  'maximum allowable offer calculator',
  '70 percent rule calculator',
  'BRRRR calculator',
  'DSCR loan calculator',
  'flip profit calculator',
  'rental property calculator',
  'after repair value calculator',
  // --- Strategy long-tail ---
  'how to find motivated sellers',
  'how to find cash buyers',
  'how to wholesale a house',
  'subject to real estate',
  'creative real estate financing',
  'owner finance real estate',
  // --- State/legal ---
  'wholesaling real estate laws',
  'is wholesaling real estate legal',
  'real estate assignment contract',
  'double close real estate',
  // --- Cash buyer / disposition ---
  'cash buyers for houses',
  'sell wholesale deal to investor',
  'build cash buyer list',
  // --- Lead gen ---
  'real estate leads',
  'motivated seller leads',
  'distressed property leads',
];

function classifyIntent(kw) {
  const k = kw.toLowerCase();
  if (/(vs|alternative|review|best|compare|comparison)/.test(k)) return 'commercial';
  if (/(calculator|software|tool|app|platform|service|crm|api)/.test(k)) return 'transactional';
  if (/(how to|what is|guide|tutorial|tips|examples|for beginners|step by step|template)/.test(k)) return 'informational';
  if (/(price|cost|pricing|fee|cheap|free|trial|buy)/.test(k)) return 'transactional';
  if (/(list|leads|find|locate|near me)/.test(k)) return 'commercial';
  return 'informational';
}

function clusterFor(kw) {
  const k = kw.toLowerCase();
  if (/skip trac/.test(k)) return 'skip-tracing';
  if (/(propstream|dealmachine|batchleads|biggerpockets|alternative|vs |review|best.*software)/.test(k)) return 'competitor-comparison';
  if (/ai |ml |machine learning|proptech/.test(k)) return 'ai-proptech';
  if (/calculator/.test(k)) return 'calculators';
  if (/(pre.?foreclosure|tax delinquent|vacant|absentee|probate|code violation|distressed|high equity)/.test(k)) return 'distress-signals';
  if (/(direct mail|yellow letter|cold call|text marketing|driving for dollars|seller marketing)/.test(k)) return 'outreach-motion';
  if (/(legal|laws|assignment contract|double close|license)/.test(k)) return 'legal-compliance';
  if (/(cash buyer|buyer list|disposition|sell.*deal)/.test(k)) return 'cash-buyers';
  if (/(motivated seller|leads|find.*deals|wholesale.*deals)/.test(k)) return 'lead-generation';
  if (/(brrrr|flip|rental|owner finance|subject to|creative.*finance|how to wholesale)/.test(k)) return 'strategy-education';
  return 'other';
}

function bucketDifficulty(competitionIdx) {
  if (competitionIdx == null) return 'unknown';
  if (competitionIdx < 33) return 'low';
  if (competitionIdx < 67) return 'medium';
  return 'high';
}

async function main() {
  console.log('=== Google Ads Keyword Planner — Gap Research ===\n');
  console.log('Seed keywords:', SEED_KEYWORDS.length);

  const client = new GoogleAdsApi({
    client_id: adc.client_id,
    client_secret: adc.client_secret,
    developer_token: DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: CUSTOMER_ID,
    login_customer_id: CUSTOMER_ID,
    refresh_token: adc.refresh_token,
  });

  console.log('Fetching keyword ideas from Google Ads...\n');

  const ideas = await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: CUSTOMER_ID,
    language: 'languageConstants/1000',
    geo_target_constants: ['geoTargetConstants/2840'],
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    keyword_seed: { keywords: SEED_KEYWORDS },
  });

  if (!ideas || ideas.length === 0) {
    console.log('No ideas returned.');
    return;
  }

  console.log(`Received ${ideas.length} keyword ideas.\n`);

  const processed = ideas.map((idea) => {
    const m = idea.keyword_idea_metrics || {};
    const vol = Number(m.avg_monthly_searches || 0);
    const compIdx = m.competition_index != null ? Number(m.competition_index) : null;
    const lowBid = Number(m.low_top_of_page_bid_micros || 0) / 1_000_000;
    const highBid = Number(m.high_top_of_page_bid_micros || 0) / 1_000_000;
    const avgBid = (lowBid + highBid) / 2;
    const kw = idea.text || '';

    // ROI: volume_norm + (100-comp) + (100-cost_norm)
    const volNorm = Math.min(vol / 500, 1) * 100;
    const compScore = compIdx != null ? 100 - compIdx : 50;
    const costScore = avgBid > 0 ? Math.max(0, 100 - avgBid * 5) : 50;
    const roi = volNorm * 0.35 + compScore * 0.35 + costScore * 0.3;

    return {
      keyword: kw,
      volume: vol,
      competition: m.competition || 'UNSPECIFIED',
      competitionIdx: compIdx,
      difficulty: bucketDifficulty(compIdx),
      lowBid: +lowBid.toFixed(2),
      highBid: +highBid.toFixed(2),
      avgBid: +avgBid.toFixed(2),
      intent: classifyIntent(kw),
      cluster: clusterFor(kw),
      roiScore: +roi.toFixed(1),
    };
  })
  .filter((k) => k.volume > 0)
  .sort((a, b) => b.roiScore - a.roiScore);

  // CSV output
  const csvPath = path.join(OUTPUT_DIR, 'keyword-research-gaps.csv');
  const header = 'Keyword,Volume,Competition,CompIdx,Difficulty,LowBid,HighBid,AvgBid,Intent,Cluster,ROIScore\n';
  const rows = processed.map((k) =>
    `"${k.keyword.replace(/"/g, '""')}",${k.volume},${k.competition},${k.competitionIdx ?? ''},${k.difficulty},${k.lowBid},${k.highBid},${k.avgBid},${k.intent},${k.cluster},${k.roiScore}`
  ).join('\n');
  fs.writeFileSync(csvPath, header + rows);
  console.log('CSV saved:', csvPath);

  // Cluster summary
  const clusters = {};
  for (const k of processed) {
    if (!clusters[k.cluster]) {
      clusters[k.cluster] = { count: 0, totalVolume: 0, avgComp: 0, top: [] };
    }
    const c = clusters[k.cluster];
    c.count++;
    c.totalVolume += k.volume;
    if (k.competitionIdx != null) c.avgComp += k.competitionIdx;
    if (c.top.length < 5) c.top.push({ kw: k.keyword, vol: k.volume, comp: k.competition, intent: k.intent, roi: k.roiScore });
  }
  for (const cname of Object.keys(clusters)) {
    const c = clusters[cname];
    c.avgComp = c.count ? +(c.avgComp / c.count).toFixed(1) : null;
  }

  const summary = {
    generated: new Date().toISOString().slice(0, 10),
    seedKeywords: SEED_KEYWORDS.length,
    totalIdeas: ideas.length,
    keywordsWithVolume: processed.length,
    clusters,
    top25ByRoi: processed.slice(0, 25),
    top15ByVolume: [...processed].sort((a, b) => b.volume - a.volume).slice(0, 15),
    lowCompetitionHighVolume: processed.filter(k => k.volume >= 1000 && k.difficulty === 'low').slice(0, 25),
  };

  const jsonPath = path.join(OUTPUT_DIR, 'keyword-research-gaps.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log('JSON saved:', jsonPath);

  console.log('\n=== CLUSTER SUMMARY ===\n');
  console.log('Cluster                    | # KW |  Total Vol/mo | Avg Comp');
  console.log('---------------------------|------|---------------|---------');
  Object.entries(clusters)
    .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
    .forEach(([n, c]) => {
      console.log(n.padEnd(26) + ' | ' + String(c.count).padStart(4) + ' | ' + String(c.totalVolume).padStart(13) + ' | ' + String(c.avgComp ?? '?').padStart(7));
    });

  console.log('\n=== TOP 15 BY ROI ===\n');
  processed.slice(0, 15).forEach((k, i) => {
    console.log(`${String(i + 1).padStart(2)}. [${k.roiScore.toString().padStart(5)}] vol=${String(k.volume).padStart(7)} comp=${k.competition.padEnd(10)} cpc=$${k.lowBid}-${k.highBid}  ${k.keyword}`);
  });
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
