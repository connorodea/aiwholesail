const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { attachSubscription, requireElite, requireTierWithLimit } = require('../middleware/subscription');
const { checkLlmBudget } = require('../middleware/llmBudget');
const { wrapUserData, INJECTION_GUARDRAIL, PromptInjectionError } = require('../lib/llm-prompt-safety');
const { logEvent, EVENTS } = require('../lib/events');
const {
  callClaude,
  callClaudeWithTools,
  callOpenAI,
  PROPERTY_ANALYSIS_PROMPT,
  LEAD_SCORING_PROMPT,
  WHOLESALE_ANALYSIS_PROMPT
} = require('../services/openai');
const { proxyZillow } = require('../lib/agent/zillowProxy');

const router = express.Router();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/**
 * POST /api/ai/property-analysis
 * AI-powered property analysis
 */
router.post('/property-analysis',
  authenticate,
  attachSubscription,
  checkLlmBudget(),
  requireTierWithLimit({ eventType: 'ai_property_analysis', proMonthly: 10, featureLabel: 'AI property analysis' }),
  [body('property').optional().isObject(), body('csv_data').optional().isArray(), body('market').optional().isString()],
asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  // Rate limiting
  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-property-analysis', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  const { property, userMessage, conversationHistory = [] } = req.body;

  // Define tools for AI to gather additional property data
  const tools = [
    {
      name: 'get_detailed_property_info',
      description: 'Get comprehensive property details including ownership, tax history, and detailed specifications',
      input_schema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Full property address' }
        },
        required: ['address']
      }
    },
    {
      name: 'get_price_history',
      description: 'Get historical price and Zestimate data to analyze price trends',
      input_schema: {
        type: 'object',
        properties: {
          zpid: { type: 'string', description: 'Zillow property ID' },
          address: { type: 'string', description: 'Property address' }
        },
        required: ['address']
      }
    },
    {
      name: 'get_comparable_sales',
      description: 'Get recent comparable home sales in the area for market analysis',
      input_schema: {
        type: 'object',
        properties: {
          zpid: { type: 'string', description: 'Zillow property ID' },
          address: { type: 'string', description: 'Property address' }
        },
        required: ['address']
      }
    },
    {
      name: 'calculate_wholesale_metrics',
      description: 'Calculate key wholesale investment metrics and deal analysis',
      input_schema: {
        type: 'object',
        properties: {
          listPrice: { type: 'number', description: 'Current listing price' },
          zestimate: { type: 'number', description: 'Zillow estimate' },
          sqft: { type: 'number', description: 'Square footage' },
          yearBuilt: { type: 'number', description: 'Year built' },
          repairEstimate: { type: 'number', description: 'Estimated repair costs' },
          comparables: { type: 'array', description: 'Comparable sales data' }
        },
        required: ['listPrice']
      }
    }
  ];

  // Prompt-injection hardening: user-supplied `property` previously landed
  // in the SYSTEM prompt (HIGH-risk). Now it goes into the user message
  // wrapped in <user_data>. The guardrail telling the model not to follow
  // instructions inside those tags is baked into PROPERTY_ANALYSIS_PROMPT
  // via services/openai.js — see lib/llm-prompt-safety.INJECTION_GUARDRAIL.
  const systemPrompt = PROPERTY_ANALYSIS_PROMPT;

  const messages = [];

  // Add conversation history
  conversationHistory.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content });
  });

  // First user message: the structured property data, wrapped so the model
  // can find it but treats it as untrusted input.
  messages.push({
    role: 'user',
    content: `Here is the property to analyze:\n${wrapUserData('property', property)}`,
  });

  // Add current user message
  if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  } else {
    messages.push({
      role: 'user',
      content: 'Please provide a comprehensive wholesale analysis of this property. Use all available tools to gather detailed data and give me your expert assessment of the wholesale opportunity.'
    });
  }

  // Call Claude with tools
  const aiResponse = await callClaudeWithTools(systemPrompt, messages, tools, { userId: req.user.id, endpoint: '/api/ai/property-analysis' });

  // Handle tool calls if any
  if (aiResponse.content?.some(content => content.type === 'tool_use')) {
    const toolResults = [];

    for (const content of aiResponse.content) {
      if (content.type === 'tool_use') {
        const toolResult = await executeToolCall(content.name, content.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: content.id,
          content: JSON.stringify(toolResult)
        });
      }
    }

    // Send tool results back to Claude
    messages.push({ role: 'assistant', content: aiResponse.content });
    messages.push({ role: 'user', content: toolResults });

    const finalResponse = await callClaudeWithTools(systemPrompt, messages, tools, { userId: req.user.id, endpoint: '/api/ai/property-analysis' });

    await logSecurityEvent('ai_analysis_complete', {
      userId: req.user.id,
      type: 'property-analysis',
      tokensUsed: finalResponse.usage?.total_tokens || 0
    }, req.user.id, req);

    return res.json({
      response: finalResponse.content[0]?.text || 'Analysis complete',
      usage: finalResponse.usage
    });
  }

  await logSecurityEvent('ai_analysis_complete', {
    userId: req.user.id,
    type: 'property-analysis',
    tokensUsed: aiResponse.usage?.total_tokens || 0
  }, req.user.id, req);

  logEvent(req.user.id, EVENTS.AI_PROPERTY_ANALYSIS, {
    tokens: aiResponse.usage?.total_tokens || 0,
  });

  res.json({
    response: aiResponse.content[0]?.text || 'Analysis complete',
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/lead-scoring
 * AI-powered lead scoring
 */
router.post('/lead-scoring', authenticate, attachSubscription, checkLlmBudget(), [
  body('property').optional().isObject(), body('csv_data').optional().isArray(), body('market').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-lead-scoring', 30, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { property, leadId } = req.body;

  const userMessage = `Analyze this property and provide lead scoring:

${wrapUserData('property', property)}

Please return a JSON object with the following structure:
{
  "overallScore": <0-100>,
  "motivationScore": <0-25>,
  "urgencyScore": <0-25>,
  "profitabilityScore": <0-25>,
  "contactabilityScore": <0-25>,
  "confidenceScore": <0-100>,
  "scoringFactors": [<array of string reasons>],
  "recommendation": "<PURSUE/MAYBE/PASS>",
  "analysis": "<detailed analysis text>"
}`;

  const aiResponse = await callClaude(LEAD_SCORING_PROMPT, userMessage, { userId: req.user.id, endpoint: '/api/ai/lead-scoring' });
  const responseText = aiResponse.content[0]?.text || '';

  // Try to extract JSON from response
  let scoringData;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      scoringData = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[AI] Failed to parse lead scoring response:', e);
  }

  // If we have a leadId, save the scoring
  if (leadId && scoringData) {
    await query(
      `INSERT INTO lead_scoring (lead_id, overall_score, motivation_score, urgency_score,
       profitability_score, contactability_score, confidence_score, scoring_factors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (lead_id)
       DO UPDATE SET
         overall_score = EXCLUDED.overall_score,
         motivation_score = EXCLUDED.motivation_score,
         urgency_score = EXCLUDED.urgency_score,
         profitability_score = EXCLUDED.profitability_score,
         contactability_score = EXCLUDED.contactability_score,
         confidence_score = EXCLUDED.confidence_score,
         scoring_factors = EXCLUDED.scoring_factors,
         last_updated = NOW()`,
      [
        leadId,
        scoringData.overallScore || 0,
        scoringData.motivationScore || 0,
        scoringData.urgencyScore || 0,
        scoringData.profitabilityScore || 0,
        scoringData.contactabilityScore || 0,
        scoringData.confidenceScore || 0,
        JSON.stringify(scoringData.scoringFactors || [])
      ]
    );
  }

  res.json({
    response: responseText,
    scoring: scoringData,
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/wholesale-analyzer
 * Wholesale deal analysis
 */
router.post('/wholesale-analyzer', authenticate, attachSubscription, checkLlmBudget(), [
  body('property').optional().isObject(), body('csv_data').optional().isArray(), body('market').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-wholesale-analyzer', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { property, repairEstimate, arv, csv_data, market, analysis_params } = req.body;

  // Batch mode: if csv_data is provided, analyze multiple properties
  if (csv_data && Array.isArray(csv_data) && csv_data.length > 0) {
    const params = analysis_params || {};
    const targetFee = Number(params.target_fee) || 10000;
    const minSpreadPct = Number(params.min_spread_pct) || 0.20;
    const repairLow = Number(params.repair_cost_low) || 25;
    const repairHigh = Number(params.repair_cost_high) || 60;
    const maxCandidates = Math.min(Number(params.max_candidates) || 15, 15);

    const candidates = csv_data.slice(0, maxCandidates);

    // Branch the prompt by source. Off-market rows (PropData absentee owners
    // sent from AbsenteeOwnerSearch via PR #182) have no list_price — the
    // analyzer's spread-driven logic doesn't apply. Use market_value as the
    // ARV anchor and emit a motivation_score per deal instead of relying on
    // listing momentum signals.
    const isOffMarket = candidates.some((c) => c?.source === 'off-market');
    const allOffMarket = isOffMarket && candidates.every((c) => c?.source === 'off-market');

    const BATCH_SYSTEM_ONMARKET = `You are an expert real estate wholesale deal analyzer. You MUST respond with valid JSON only — no prose, no markdown fences, no commentary before or after. The response must parse with JSON.parse.

Output schema (return EXACTLY this shape):
{
  "market": string,
  "analysis_timestamp": string (ISO-8601),
  "assumptions": {
    "target_fee": number,
    "min_spread_pct": number,
    "mao_rule_pct_of_arv": number,
    "repair_cost_low_per_sqft": number,
    "repair_cost_high_per_sqft": number
  },
  "deals": [
    {
      "rank": number,
      "address": string,
      "property_details": { "list_price": number, "zestimate": number, "sqft": number, "beds": number, "baths": number },
      "arv_calculation": { "estimated_arv": number, "method": string },
      "repair_estimate": { "total_repair_estimate": number, "rationale": string },
      "mao_calculation": { "mao": number, "mao_rounded": number },
      "profit_analysis": {
        "if_purchased_at_mao": { "recommended_assignment_fee": number, "estimated_wholesale_profit": number }
      },
      "deal_score": number,
      "recommendation": "PURSUE" | "MAYBE" | "PASS",
      "summary": { "one_liner": string }
    }
  ]
}

Rules:
- Rank deals best-first by deal_score (highest first)
- ARV: use Zestimate as primary anchor; adjust ±10% based on sqft/condition signals
- Repair: sqft × repair_cost_low_per_sqft as floor, × repair_cost_high_per_sqft as ceiling, pick midpoint unless red flags push higher
- MAO = (ARV × mao_rule_pct_of_arv) − repairs − target_fee
- deal_score 0-100: 80+ for strong margin, 50-79 solid, 30-49 marginal, <30 pass
- one_liner: ≤120 chars, plain English, why this is/isn't a deal
- Return ALL ${candidates.length} deals — none filtered out`;

    const BATCH_SYSTEM_OFFMARKET = `You are an expert real estate wholesale deal analyzer working with OFF-MARKET county assessor data. The properties below are absentee-owner records from PropData — no list price, no listing agent. Owner mailing address differs from property address, so these are direct-mail prospects, not listings.

You MUST respond with valid JSON only — no prose, no markdown fences, no commentary before or after. The response must parse with JSON.parse.

Output schema (return EXACTLY this shape, keep field names for downstream compatibility):
{
  "market": string,
  "analysis_timestamp": string (ISO-8601),
  "assumptions": {
    "target_fee": number,
    "mao_rule_pct_of_arv": number,
    "repair_cost_low_per_sqft": number,
    "repair_cost_high_per_sqft": number
  },
  "deals": [
    {
      "rank": number,
      "address": string,
      "property_details": { "list_price": 0, "zestimate": number, "sqft": number, "beds": number, "baths": number },
      "arv_calculation": { "estimated_arv": number, "method": string },
      "repair_estimate": { "total_repair_estimate": number, "rationale": string },
      "mao_calculation": { "mao": number, "mao_rounded": number },
      "profit_analysis": {
        "if_purchased_at_mao": { "recommended_assignment_fee": number, "estimated_wholesale_profit": number }
      },
      "deal_score": number,
      "recommendation": "PURSUE" | "MAYBE" | "PASS",
      "summary": { "one_liner": string, "motivation": string }
    }
  ]
}

Off-market rules:
- list_price is ALWAYS 0 in the output — these properties are not listed
- ARV: use the property's market_value field as the anchor. Adjust ±10% for sqft / year_built / condition signals. If market_value is absent or 0, fall back to land_value + improvement_value if available, else use 0.
- "estimated_arv" is the ARV anchor described above; "zestimate" field in the output mirrors it (downstream consumers expect zestimate present even off-market).
- Repair: sqft × repair_cost_low_per_sqft as floor, × repair_cost_high_per_sqft as ceiling. Off-market = no inspection signal — pick MIDPOINT to be conservative.
- MAO = (ARV × mao_rule_pct_of_arv) − repairs − target_fee. Round to nearest $1,000 for the offer ceiling.
- deal_score (0-100) is a MOTIVATION composite, not spread-driven. Use the equity_pct, years_held, and is_absentee_owner fields from the input. Heuristic:
    * 80+ : equity_pct ≥ 70% AND years_held ≥ 10 (entrenched landlord, easy direct-mail target)
    * 50-79: equity_pct ≥ 50% OR years_held ≥ 7
    * 30-49: equity_pct ≥ 30%
    * <30  : low-equity / recent purchase (less motivated)
- recommendation: PURSUE for 70+, MAYBE for 40-69, PASS below.
- one_liner: ≤120 chars, plain English, why this owner might sell (high equity, long hold, out-of-state, etc.)
- motivation: 1 sentence on the specific outreach angle (e.g. "Owner held for 14 years with 78% equity — likely receptive to a cash offer to avoid the rehab burden").
- Return ALL ${candidates.length} deals — none filtered out`;

    const BATCH_SYSTEM = allOffMarket ? BATCH_SYSTEM_OFFMARKET : BATCH_SYSTEM_ONMARKET;

    const batchMessage = `Market: ${wrapUserData('market', market || 'unspecified')}
Assumptions: target_fee=$${targetFee}, min_spread_pct=${minSpreadPct}, mao_rule_pct_of_arv=0.70, repair_cost_low_per_sqft=$${repairLow}, repair_cost_high_per_sqft=$${repairHigh}

${candidates.length} properties to analyze:
${wrapUserData('candidates', candidates)}

Return JSON only.`;

    try {
      const batchResponse = await callClaude(BATCH_SYSTEM, batchMessage, { maxTokens: 8000, timeoutMs: 120000, userId: req.user.id, endpoint: '/api/ai/wholesale-analyzer:batch' });
      const batchText = batchResponse.content?.[0]?.text || '';
      // Strip any accidental markdown fences before sending to frontend
      const cleaned = batchText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      return res.json({ response: cleaned, type: 'batch', count: candidates.length });
    } catch (err) {
      const msg = err.code === 'ECONNABORTED'
        ? 'Analysis timed out. Try fewer properties or try again in a moment.'
        : (err.response?.data?.error?.message || err.message || 'Analysis failed');
      console.error('[wholesale-analyzer batch] Claude call failed:', msg);
      return res.status(502).json({ error: msg });
    }
  }

  if (!property) {
    return res.status(400).json({ error: "Either property or csv_data is required" });
  }

  const userMessage = `Analyze this wholesale deal opportunity:

${wrapUserData('property', property)}
${repairEstimate ? `Estimated Repairs: $${Number(repairEstimate)}` : ''}
${arv ? `Estimated ARV: $${Number(arv)}` : ''}

Provide a comprehensive wholesale deal analysis including MAO calculation, profit potential, and recommendation.`;

  const aiResponse = await callClaude(WHOLESALE_ANALYSIS_PROMPT, userMessage, { userId: req.user.id, endpoint: '/api/ai/wholesale-analyzer' });
  const responseText = aiResponse.content[0]?.text || '';

  // Save to wholesale_deals table
  const address = property.address || property.streetAddress || 'Unknown';
  const price = property.price || property.listPrice || 0;

  await query(
    `INSERT INTO wholesale_deals (user_id, property_address, arv, repair_estimate, ai_analysis, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [req.user.id, address, arv || null, repairEstimate || null, responseText]
  );

  logEvent(req.user.id, EVENTS.AI_ANALYZER_RUN, {
    has_arv: !!arv,
    has_repair_estimate: !!repairEstimate,
    tokens: aiResponse.usage?.total_tokens || 0,
  });

  res.json({
    response: responseText,
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/damage-detection
 * AI-powered property damage detection from photos
 */
router.post('/damage-detection', authenticate, attachSubscription, checkLlmBudget(), [
  body('photos').isArray().withMessage('Photos array required'),
  body('zpid').notEmpty().withMessage('Property ZPID required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-damage-detection', 10, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { photos, zpid, propertyData } = req.body;

  // Build image analysis prompt
  const systemPrompt = `You are an expert property condition assessor. Analyze the provided property photos to identify:

1. STRUCTURAL ISSUES:
- Foundation problems
- Roof damage
- Wall cracks
- Water damage

2. COSMETIC ISSUES:
- Paint/finish condition
- Flooring condition
- Kitchen/bathroom updates needed
- Landscaping

3. REPAIR ESTIMATES:
- Provide cost estimates for each issue
- Categorize as: Minor (<$5k), Moderate ($5k-$20k), Major (>$20k)

4. OVERALL ASSESSMENT:
- Property condition grade (A-F)
- Total estimated repair cost
- Investment recommendation

Return a structured analysis with specific findings and estimates.${INJECTION_GUARDRAIL}`;

  // For now, analyze based on property data (full image analysis would require OpenAI Vision)
  const userMessage = `Property details:
${wrapUserData('property', propertyData || {})}

Number of photos to analyze: ${Number(photos.length)}
${wrapUserData('photo_urls', photos.slice(0, 5))}

Based on the property age, type, and available data, provide an estimated condition assessment.`;

  const aiResponse = await callClaude(systemPrompt, userMessage, { userId: req.user.id, endpoint: '/api/ai/damage-detection' });
  const responseText = aiResponse.content[0]?.text || '';

  // Save assessment
  await query(
    `INSERT INTO advanced_property_assessments (user_id, zpid, photos_analyzed, detailed_assessment, ai_models_used, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (zpid) DO UPDATE SET
       photos_analyzed = EXCLUDED.photos_analyzed,
       detailed_assessment = EXCLUDED.detailed_assessment,
       updated_at = NOW()`,
    [req.user.id, zpid, photos.length, JSON.stringify({ analysis: responseText }), ['claude-sonnet-4-6', 'gpt-4.1']]
  );

  res.json({
    response: responseText,
    photosAnalyzed: photos.length,
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/deal-analysis
 * Quick deal analysis
 */
router.post('/deal-analysis', authenticate, attachSubscription, checkLlmBudget(), [
  body('zillowUrl').optional().isURL(),
  body('address').optional().isString()
], asyncHandler(async (req, res) => {
  const { zillowUrl, address, propertyData } = req.body;

  if (!zillowUrl && !address && !propertyData) {
    return res.status(400).json({ error: 'Zillow URL, address, or property data required' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-deal-analysis', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const userMessage = `Analyze this deal:
${zillowUrl ? wrapUserData('zillow_url', zillowUrl) : ''}
${address ? wrapUserData('address', address) : ''}
${propertyData ? wrapUserData('property', propertyData) : ''}

Provide a quick wholesale deal assessment with:
1. Estimated ARV
2. Suggested offer price
3. Deal potential (1-10 score)
4. Key considerations`;

  const aiResponse = await callClaude(WHOLESALE_ANALYSIS_PROMPT, userMessage, { userId: req.user.id, endpoint: '/api/ai/deal-analysis' });

  res.json({
    response: aiResponse.content[0]?.text || 'Analysis complete',
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/chat
 * General AI chat for property questions
 */
router.post('/chat', authenticate, attachSubscription, checkLlmBudget(), [
  body('message').notEmpty().withMessage('Message required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { message, context, conversationHistory = [] } = req.body;

  // Prompt-injection hardening: previously `context` (user-supplied) was
  // JSON.stringify'd into the SYSTEM prompt (HIGH-risk). Now context lives
  // in a user message wrapped in <user_data> tags, and the system prompt
  // is static + carries the guardrail.
  const systemPrompt = `You are AI Wholesail Assistant, an expert in real estate wholesaling. Help users with:
- Property analysis and evaluation
- Wholesale deal calculations
- Market insights
- Investment strategies
- Skip tracing guidance
- Marketing advice

Be helpful, concise, and provide actionable advice.${INJECTION_GUARDRAIL}`;

  const messages = [
    ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
  ];
  if (context) {
    messages.push({ role: 'user', content: `Conversation context:\n${wrapUserData('context', context)}` });
  }
  messages.push({ role: 'user', content: message });

  const aiResponse = await callClaudeWithTools(systemPrompt, messages, [], { userId: req.user.id, endpoint: '/api/ai/chat' });

  res.json({
    response: aiResponse.content[0]?.text || '',
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/photo-analysis
 * AI-powered property photo condition analysis and rehab cost estimation
 */
router.post('/photo-analysis',
  authenticate,
  attachSubscription,
  checkLlmBudget(),
  requireTierWithLimit({ eventType: 'photo_analysis', proMonthly: 10, featureLabel: 'AI photo analysis' }),
  [
  body('property').optional().isObject(), body('csv_data').optional().isArray(), body('market').optional().isString(),
  body('imageUrls').isArray({ min: 1 }).withMessage('At least one image URL required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  // Rate limit: 5 per hour
  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-photo-analysis', 5, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Photo analysis rate limit exceeded. Maximum 5 per hour.' });
  }

  const { property, imageUrls } = req.body;

  const propertyDetails = [
    property.address && `Address: ${property.address}`,
    property.sqft && `Square footage: ${property.sqft}`,
    property.bedrooms && `Bedrooms: ${property.bedrooms}`,
    property.bathrooms && `Bathrooms: ${property.bathrooms}`,
    property.yearBuilt && `Year built: ${property.yearBuilt}`,
    property.price && `List price: $${property.price.toLocaleString()}`,
    property.propertyType && `Property type: ${property.propertyType}`,
  ].filter(Boolean).join(', ');

  // Prompt-injection hardening: previously `propertyDetails` (user-controlled
  // address/bedrooms/sqft string) was interpolated into the SYSTEM prompt.
  // Moved to the user message in a delimited block + guardrail in system.
  const systemPrompt = `You are an expert real estate property inspector and rehab cost estimator. Analyze these property photos and provide:
1) Overall condition assessment (excellent/good/fair/poor)
2) Specific issues visible (roof, siding, windows, flooring, kitchen, bathrooms, etc.)
3) Estimated rehab cost breakdown by category
4) Total estimated rehab cost range
5) Recommended repairs prioritized by ROI

Base estimates on current 2026 contractor rates.

IMPORTANT: Respond ONLY with valid JSON in this exact structure (no markdown, no code fences):
{
  "overallCondition": "excellent" | "good" | "fair" | "poor",
  "conditionScore": <number 0-100>,
  "issues": [
    { "category": "<string>", "severity": "minor" | "moderate" | "major", "description": "<string>", "estimatedCost": <number> }
  ],
  "totalRehabEstimate": { "low": <number>, "high": <number> },
  "prioritizedRepairs": ["<string>", ...],
  "investmentAdvice": "<string>"
}${INJECTION_GUARDRAIL}`;

  const userMessage = `Please analyze these property photos and provide a detailed condition assessment with rehab cost estimates.

Property details (untrusted user input):
${wrapUserData('property', propertyDetails)}`;

  // Limit to 4 images to stay within token limits
  const limitedUrls = imageUrls.slice(0, 4);

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4.1',
      max_tokens: 2000,
      messages: [{
        role: 'system',
        content: systemPrompt
      }, {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          ...limitedUrls.map(url => ({
            type: 'image_url',
            image_url: { url }
          }))
        ]
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      // Cap the wait — vision calls usually finish in 10-30s; a hung request
      // shouldn't burn the full nginx 300s window before the user sees an error.
      timeout: 90000
    });

    const responseText = response.data.choices?.[0]?.message?.content || '';

    // Direct axios call — bypasses services/openai.js, so write the ledger
    // manually. logLlmUsage handles its own errors.
    require('../lib/llm-usage').logLlmUsage({
      userId: req.user.id,
      endpoint: '/api/ai/photo-analysis',
      model: response.data?.model || 'gpt-4.1',
      usage: response.data?.usage,
    });

    // Parse JSON from response
    let analysisData;
    try {
      // Strip markdown code fences if present
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[AI] Failed to parse photo analysis JSON:', parseError);
    }

    await logSecurityEvent('ai_analysis_complete', {
      userId: req.user.id,
      type: 'photo-analysis',
      photosAnalyzed: limitedUrls.length,
      tokensUsed: response.data.usage?.total_tokens || 0
    }, req.user.id, req);

    // Required for Pro monthly-limit accounting (requireTierWithLimit queries
    // user_events by event_type). Without this, Pro users would get unlimited
    // photo analyses for free — the counter would never increment.
    logEvent(req.user.id, EVENTS.PHOTO_ANALYSIS, {
      photos: limitedUrls.length,
      tokens: response.data.usage?.total_tokens || 0,
    });

    res.json({
      analysis: analysisData || null,
      rawResponse: !analysisData ? responseText : undefined,
      photosAnalyzed: limitedUrls.length,
      usage: response.data.usage
    });
  } catch (error) {
    console.error('[AI] Photo analysis error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || 'Photo analysis failed. Please try again.';
    res.status(status).json({ error: message });
  }
}));

/**
 * Execute tool calls for property analysis
 */
async function executeToolCall(toolName, input) {
  console.log(`[AI] Executing tool: ${toolName}`, input);

  try {
    switch (toolName) {
      case 'get_detailed_property_info':
        return await getDetailedPropertyInfo(input.address);

      case 'get_price_history':
        return await getPriceHistory(input.zpid, input.address);

      case 'get_comparable_sales':
        return await getComparableSales(input.zpid, input.address);

      case 'calculate_wholesale_metrics':
        return calculateWholesaleMetrics(input);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`[AI] Error in ${toolName}:`, error);
    return { error: error.message };
  }
}

async function getDetailedPropertyInfo(address) {
  const response = await axios.get(
    `https://zillow-working-api.p.rapidapi.com/pro/byaddress`,
    {
      params: { propertyaddress: address },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
      }
    }
  );
  return response.data;
}

async function getPriceHistory(zpid, address) {
  const params = {
    recent_first: 'True',
    which: 'zestimate_history'
  };
  if (zpid) params.byzpid = zpid;
  if (address) params.byaddress = address;

  const response = await axios.get(
    'https://zillow-working-api.p.rapidapi.com/graph_charts',
    {
      params,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
      }
    }
  );
  return response.data;
}

async function getComparableSales(zpid, address) {
  const params = {};
  if (zpid) params.byzpid = zpid;
  if (address) params.byaddress = address;

  const response = await axios.get(
    'https://zillow-working-api.p.rapidapi.com/comparable_homes',
    {
      params,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
      }
    }
  );
  return response.data;
}

function calculateWholesaleMetrics(input) {
  const { listPrice, zestimate, sqft, yearBuilt, repairEstimate = 0, comparables = [] } = input;

  if (!listPrice) return { error: 'List price required for calculations' };

  // Calculate ARV
  let arv = zestimate || listPrice;
  if (comparables.length > 0) {
    const compPrices = comparables
      .filter(comp => comp.price && comp.sqft)
      .map(comp => (comp.price / comp.sqft) * sqft);

    if (compPrices.length > 0) {
      arv = Math.max(arv, compPrices.reduce((a, b) => a + b, 0) / compPrices.length);
    }
  }

  // Wholesale calculations
  const spreadAmount = arv - listPrice;
  const spreadPercentage = (spreadAmount / arv) * 100;
  const maxAllowableOffer = arv * 0.70 - repairEstimate;
  const potentialProfit = maxAllowableOffer - listPrice;
  const profitMargin = (potentialProfit / listPrice) * 100;

  // Property age factor
  const currentYear = new Date().getFullYear();
  const propertyAge = yearBuilt ? currentYear - yearBuilt : 0;

  // Investment score (0-100)
  let investmentScore = 0;
  if (spreadPercentage > 20) investmentScore += 30;
  else if (spreadPercentage > 10) investmentScore += 15;

  if (profitMargin > 15) investmentScore += 25;
  else if (profitMargin > 5) investmentScore += 10;

  if (propertyAge < 20) investmentScore += 20;
  else if (propertyAge < 40) investmentScore += 10;

  if (sqft && sqft > 1200) investmentScore += 15;
  else if (sqft && sqft > 800) investmentScore += 10;

  const riskFactors = [];
  if (spreadPercentage < 15) riskFactors.push('Low profit margin');
  if (propertyAge > 50) riskFactors.push('Older property may need major repairs');
  if (!zestimate) riskFactors.push('No Zestimate available for validation');

  return {
    listPrice,
    arv,
    spreadAmount,
    spreadPercentage: Number(spreadPercentage.toFixed(2)),
    maxAllowableOffer,
    potentialProfit,
    profitMargin: Number(profitMargin.toFixed(2)),
    repairEstimate,
    investmentScore,
    propertyAge,
    riskFactors,
    recommendation: investmentScore >= 60 ? 'Strong wholesale opportunity' :
                    investmentScore >= 40 ? 'Moderate opportunity - analyze carefully' :
                    'Weak opportunity - consider passing'
  };
}

// ============================================================================
// POST /api/ai/rank-deals
// Filter the top spread candidates from a search through GPT-5.4-mini and
// return a structured ranked list with AI scores, deal labels, and red flags.
// Designed to surface true deals from spread-only noise (teardowns, condemned,
// title issues, etc.).
// ============================================================================

const RANK_DEALS_SYSTEM_PROMPT = `You are an expert real estate wholesale deal evaluator. Given a list of property candidates that already passed a basic spread filter (list price < Zestimate), your job is to score each property on whether it is a GENUINE wholesale opportunity vs. a false-positive spread.

GENUINE signals (raise score):
- Description contains motivated-seller language: "must sell", "estate sale", "AS-IS", "investor special", "cash only", "needs TLC", "fixer-upper", "relocation", "motivated"
- High days-on-market (>60) with no sale = motivated
- FSBO listings = direct seller access
- Recent price reductions
- Description mentions cosmetic/light rehab needs (paintable, cosmetic, surface)

FALSE-POSITIVE signals (lower score, flag):
- "fire damage", "uninhabitable", "boarded up", "structural", "foundation issue", "tear down", "land value only", "condemned", "mold remediation", "asbestos"
- Title/legal red flags: "subject to back taxes", "probate pending", "lien", "title issues", "auction"
- Suspicious price (e.g. $1, $100) — likely data error
- Brand-new construction with high spread = Zestimate is wrong, not a deal
- Property type mismatch (e.g. land, mobile home — not wholesale-friendly)

Output exactly the structured JSON requested. Be concise. Be honest — if a property looks risky, flag it.${INJECTION_GUARDRAIL}`;

const RANK_DEALS_SCHEMA = {
  type: 'object',
  properties: {
    ranked_deals: {
      type: 'array',
      description: 'Properties ranked by genuine deal quality, best first. Include ALL input properties.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Property id from input' },
          ai_score: { type: 'integer', description: 'Genuine-deal score 0-100' },
          label: {
            type: 'string',
            enum: ['strong_buy', 'solid', 'caution', 'avoid'],
            description: 'Categorical recommendation'
          },
          rationale: {
            type: 'string',
            description: 'One sentence explaining the score, max 120 chars'
          },
          red_flags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific red-flag phrases from listing (max 3, empty array if none)'
          },
          motivated_signals: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific motivated-seller phrases detected (max 3, empty array if none)'
          },
        },
        required: ['id', 'ai_score', 'label', 'rationale', 'red_flags', 'motivated_signals'],
        additionalProperties: false,
      },
    },
  },
  required: ['ranked_deals'],
  additionalProperties: false,
};

router.post('/rank-deals', authenticate, attachSubscription, checkLlmBudget(), [
  body('properties').isArray({ min: 1 }).withMessage('properties array required (1-25 entries)'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  // Rate limit: 20 calls/hour/user
  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'ai-rank-deals', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in an hour.' });
  }

  const { properties } = req.body;

  // Cap at 25 to control cost + token budget. Caller is responsible for picking
  // the top-spread 25 from a larger result set.
  const candidates = properties
    .filter(p => p && p.id && p.price > 0 && p.zestimate > 0 && p.zestimate > p.price)
    .slice(0, 25);

  if (candidates.length === 0) {
    return res.json({ ranked_deals: [], note: 'No valid spread candidates in input.' });
  }

  // Compact each property to only the signals the LLM needs (saves tokens).
  const compact = candidates.map(p => ({
    id: String(p.id),
    address: p.address || '',
    price: p.price,
    zestimate: p.zestimate,
    spread: Math.round((p.zestimate - p.price)),
    spread_pct: Math.round(((p.zestimate - p.price) / p.zestimate) * 100),
    bedrooms: p.bedrooms || null,
    bathrooms: p.bathrooms || null,
    sqft: p.sqft || null,
    yearBuilt: p.yearBuilt || null,
    daysOnMarket: p.daysOnMarket || null,
    propertyType: p.propertyType || null,
    isFSBO: !!p.isFSBO,
    description: (p.description || '').slice(0, 600), // trim long descriptions
  }));

  const userMessage = `Score these ${Number(compact.length)} candidates:\n\n${wrapUserData('candidates', compact)}`;

  try {
    const aiResponse = await callOpenAI(
      [
        { role: 'system', content: RANK_DEALS_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      {
        model: 'gpt-5.4-mini',
        maxTokens: 4000,
        temperature: 0.3,
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'ranked_deals',
            schema: RANK_DEALS_SCHEMA,
            strict: true,
          },
        },
        userId: req.user.id,
        endpoint: '/api/ai/rank-deals',
      }
    );

    const choice = aiResponse?.choices?.[0]?.message?.content;
    if (!choice) {
      throw new Error('Empty response from OpenAI');
    }

    let parsed;
    try {
      parsed = JSON.parse(choice);
    } catch (parseErr) {
      console.error('[rank-deals] JSON parse failed:', parseErr, 'Raw:', choice.slice(0, 500));
      return res.status(502).json({ error: 'AI returned malformed response' });
    }

    logEvent(req.user.id, EVENTS.AI_RANK_DEALS, {
      candidates: candidates.length,
      ranked: (parsed.ranked_deals || []).length,
    });

    res.json({
      ranked_deals: parsed.ranked_deals || [],
      candidates_evaluated: candidates.length,
      model: 'gpt-5.4-mini',
      usage: aiResponse.usage,
    });
  } catch (err) {
    console.error('[rank-deals] OpenAI call failed:', err.response?.data || err.message);
    res.status(502).json({ error: 'AI service unavailable. Try again in a moment.' });
  }
}));

/**
 * POST /api/ai/rank-comps
 * Elite-only. Takes a subject property, fetches the Zillow comp pool, asks
 * Claude to pick the top 6 with reasoning + adjustments + confidence.
 *
 * This is the head-to-head feature with chatarv.ai — their headline product
 * is "top 6 comps with reasoning in 60 seconds." This route does the same
 * thing, but augmented by our broader platform (skip-trace, contracts,
 * pipeline) that ChatARV doesn't have.
 *
 * Request body: { zpid?: string, address?: string, subject: { sqft, beds,
 *   baths, yearBuilt, lotSize, propertyType, price } }
 *
 * Response: {
 *   ranked: [{ comp_index, score, reasoning, adjustments: [...], comp: {...} }],
 *   overall_confidence: 'high' | 'medium' | 'low',
 *   confidence_reasoning: string,
 *   implied_arv: number,
 *   implied_as_is_value: number,
 *   candidates_evaluated: number,
 *   model: 'claude-sonnet-4-6'
 * }
 */
router.post('/rank-comps',
  authenticate,
  attachSubscription,
  checkLlmBudget(),
  requireTierWithLimit({ eventType: 'ai_rank_comps', proMonthly: 25, featureLabel: 'AI-ranked comps' }),
  [
  body('zpid').optional().isString(),
  body('address').optional().isString(),
  body('subject').isObject().withMessage('subject property required'),
], asyncHandler(async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errs.array() });

  const { zpid, address, subject } = req.body;
  if (!zpid && !address) return res.status(400).json({ error: 'zpid or address required' });

  // Comp pool comes from our internal Zillow proxy (port 3201, action: 'comps')
  // — same source ComparableSalesTable uses successfully. The prior direct
  // call to `zillow-working-api.p.rapidapi.com/comparable_homes` failed
  // because that's a different RapidAPI subscription we don't have. Routing
  // through proxyZillow gives us: shared key + caching + the 27 known-
  // supported actions allowlist (PR #211 guard).
  let compPool = [];
  try {
    const params = {};
    if (zpid) params.zpid = zpid;
    if (address) params.address = address;
    // Geo hints help upstream rank by proximity when no zpid resolves.
    if (subject?.latitude) params.lat = subject.latitude;
    if (subject?.longitude) params.lng = subject.longitude;
    const data = await proxyZillow('comps', params);
    // The proxy returns a normalized shape; defensively pull from the
    // common keys it surfaces.
    const payload = data || {};
    compPool = payload.comparableHomes || payload.comparable_homes ||
               payload.comparables || payload.comps || payload.data?.comps ||
               payload.data?.comparables || (Array.isArray(payload.data) ? payload.data : []) || [];
    if (!Array.isArray(compPool)) compPool = [];
  } catch (err) {
    console.error('[rank-comps] Zillow proxy comps fetch failed:', err.message);
    return res.status(502).json({
      error: 'Could not fetch comparable sales from upstream',
      message: 'Try again in a moment.',
    });
  }

  if (compPool.length === 0) {
    return res.json({
      ranked: [],
      overall_confidence: 'low',
      confidence_reasoning: 'No comparable sales returned from upstream.',
      implied_arv: null,
      implied_as_is_value: null,
      candidates_evaluated: 0,
      model: 'claude-sonnet-4-6',
    });
  }

  // 2) Trim each comp to fields that matter so we don't blow Claude's context
  const slimComps = compPool.slice(0, 50).map((c, i) => ({
    i,
    address: c.address?.streetAddress || c.address || c.streetAddress || '',
    city: c.address?.city || c.city || '',
    zip: c.address?.zipcode || c.zipcode || '',
    price: c.price || c.lastSoldPrice || c.salePrice,
    sqft: c.livingArea || c.sqft || c.area,
    beds: c.bedrooms || c.beds,
    baths: c.bathrooms || c.baths,
    yearBuilt: c.yearBuilt,
    lotSize: c.lotAreaValue || c.lotSize,
    propertyType: c.homeType || c.propertyType,
    saleDate: c.dateSold || c.lastSoldDate || c.saleDate,
    daysOnZillow: c.daysOnZillow,
    distance: c.distance,
    pricePerSqft: c.pricePerSqft || (c.price && c.livingArea ? Math.round(c.price / c.livingArea) : undefined),
    zpid: c.zpid,
  }));

  // 3) Ask Claude for structured top-6 + reasoning
  const systemPrompt = `You are a senior real estate appraiser specializing in wholesale-deal ARV valuation. You select comparable sales the way an experienced wholesaler would: prioritizing recency, proximity, sqft tightness, similar bed/bath/yearBuilt, and same property type. You explain your reasoning concisely and flag adjustments where the comp differs meaningfully from the subject.

You MUST respond with valid JSON only — no preamble, no markdown, no code fences. Just the JSON object.${INJECTION_GUARDRAIL}`;

  const userPrompt = `SUBJECT PROPERTY:
${wrapUserData('subject', subject)}

COMP POOL (${Number(slimComps.length)} candidates, each with index i):
${wrapUserData('comps', slimComps)}

TASK: Pick the top 6 best comps for ARV calculation on the subject property. Reply with this exact JSON shape:

{
  "ranked": [
    {
      "comp_index": <integer matching i in pool>,
      "score": <0-100 similarity score>,
      "reasoning": "<one short sentence, e.g. 'Same zip, sold 47 days ago, sqft within 4%'>",
      "adjustments": [
        {
          "factor": "<lot_size|sqft|beds|baths|year_built|condition|garage|other>",
          "direction": "<up|down>",
          "amount_estimate": <signed integer in dollars, negative if down>,
          "reason": "<one short clause>"
        }
      ]
    }
  ],
  "overall_confidence": "<high|medium|low>",
  "confidence_reasoning": "<one sentence on comp tightness, e.g. '12 candidates, all within 0.5mi, sold within 90 days'>",
  "implied_as_is_value": <integer in dollars, median of comps without condition lift>,
  "implied_arv": <integer in dollars, comps adjusted up for post-rehab condition>
}

Pick fewer than 6 only if the pool genuinely lacks good matches. Order by score descending. Score >= 80 = excellent, 60-79 = good, 40-59 = marginal, < 40 = poor (avoid if possible).`;

  let aiResponse;
  try {
    aiResponse = await callClaude(systemPrompt, userPrompt, {
      model: 'claude-sonnet-4-6',
      maxTokens: 4000,
      temperature: 0.3, // low — we want consistent, defensible picks
      timeoutMs: 90_000,
      userId: req.user.id,
      endpoint: '/api/ai/rank-comps',
    });
  } catch (err) {
    console.error('[rank-comps] Claude call failed:', err.response?.data || err.message);
    return res.status(502).json({ error: 'AI service unavailable. Try again in a moment.' });
  }

  const text = aiResponse?.content?.[0]?.text || '';
  let parsed;
  try {
    // Strip any accidental code fences in case the model ignored instructions
    const cleaned = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[rank-comps] JSON parse failed:', parseErr.message, 'Raw:', text.slice(0, 500));
    return res.status(502).json({ error: 'AI returned malformed response' });
  }

  // Re-hydrate each ranked entry with the full comp object so the UI doesn't
  // need to cross-reference indexes itself. Dedup on comp_index in case
  // Claude returns the same comp twice (rare but observed) — otherwise the
  // UI renders duplicate cards.
  const seenIndexes = new Set();
  const ranked = (parsed.ranked || [])
    .filter((r) => Number.isInteger(r.comp_index) && slimComps[r.comp_index])
    .filter((r) => {
      if (seenIndexes.has(r.comp_index)) return false;
      seenIndexes.add(r.comp_index);
      return true;
    })
    .map((r) => ({
      ...r,
      comp: slimComps[r.comp_index],
    }));

  // Dedicated event type so Pro monthly-limit counting is accurate (the
  // requireTierWithLimit middleware queries by event_type, so rank_comps
  // must not share a bucket with property_analysis).
  logEvent(req.user.id, EVENTS.AI_RANK_COMPS, {
    candidates: slimComps.length,
    returned: ranked.length,
    confidence: parsed.overall_confidence,
    tokens: aiResponse?.usage?.total_tokens || 0,
  });

  res.json({
    ranked,
    overall_confidence: parsed.overall_confidence || 'medium',
    confidence_reasoning: parsed.confidence_reasoning || '',
    implied_arv: parsed.implied_arv ?? null,
    implied_as_is_value: parsed.implied_as_is_value ?? null,
    candidates_evaluated: slimComps.length,
    model: 'claude-sonnet-4-6',
    usage: aiResponse?.usage,
  });
}));

/**
 * POST /api/ai/listing-description
 * Phase 1.5 of ChatARV parity.
 *
 * Generates wholesale-style marketing copy from a property. Used by:
 *  - BuyerPitchPDF (drops into the "About this property" section)
 *  - "Run Full ARV Analysis" bundle (Phase 1.4)
 *  - Standalone "Copy listing description" button on the property modal
 *
 * Tier gating: Pro 25/mo, Elite unlimited.
 */
router.post('/listing-description',
  authenticate,
  attachSubscription,
  checkLlmBudget(),
  requireTierWithLimit({ eventType: 'ai_listing_description', proMonthly: 25, featureLabel: 'AI listing description' }),
  [
    body('property').isObject().withMessage('property required'),
    body('tone').optional().isIn(['wholesaler', 'flipper', 'rental', 'agent']),
  ],
  asyncHandler(async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errs.array() });

    const { property, tone = 'wholesaler' } = req.body;

    // Trim to what matters — don't dump the whole property object on Claude.
    const slim = {
      address: property.address,
      price: property.price,
      zestimate: property.zestimate,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.sqft,
      yearBuilt: property.yearBuilt,
      lotSize: property.lotSize,
      propertyType: property.propertyType,
      isFSBO: property.isFSBO,
      status: property.status,
      daysOnMarket: property.daysOnMarket,
      mlsDescription: property.description ? String(property.description).slice(0, 800) : undefined,
    };

    const toneGuide = {
      wholesaler: 'speak to cash buyers and other wholesalers — emphasize spread, motivated-seller signals, and quick-close upside. Avoid retail-buyer language.',
      flipper:    'speak to fix-and-flip investors — emphasize ARV potential, condition, and after-rehab comps. Mention rehab opportunity but be honest about scope.',
      rental:     'speak to buy-and-hold landlords — emphasize cash flow, cap rate, neighborhood rent comps, and tenant appeal.',
      agent:      'speak to retail buyers via a listing agent — highlight lifestyle features, school district vibes, move-in readiness.',
    };

    const systemPrompt = `You are an expert real estate copywriter producing short, scannable marketing copy for investor property listings. Your tone is direct, specific, and grounded — never hyperbolic or "gurus-on-Instagram." Cite real numbers when they're in the input, and never fabricate features.

Audience tone: ${toneGuide[tone] || toneGuide.wholesaler}

Output strict JSON only:
{
  "headline": "<short headline, 6-10 words, no clickbait>",
  "description": "<2-3 short paragraphs of body copy, 80-180 words total>",
  "bullets": ["<5-8 short standalone selling points, each <14 words>"]
}${INJECTION_GUARDRAIL}`;

    const userPrompt = `PROPERTY:
${wrapUserData('property', slim)}

Write the listing copy now. JSON only.`;

    let aiResponse;
    try {
      aiResponse = await callClaude(systemPrompt, userPrompt, {
        model: 'claude-sonnet-4-6',
        maxTokens: 1500,
        temperature: 0.5,
        timeoutMs: 60_000,
        userId: req.user.id,
        endpoint: '/api/ai/listing-description',
      });
    } catch (err) {
      console.error('[listing-description] Claude call failed:', err.response?.data || err.message);
      return res.status(502).json({ error: 'AI service unavailable. Try again in a moment.' });
    }

    const text = aiResponse?.content?.[0]?.text || '';
    let parsed;
    try {
      const cleaned = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[listing-description] JSON parse failed:', parseErr.message, 'Raw:', text.slice(0, 400));
      return res.status(502).json({ error: 'AI returned malformed response' });
    }

    logEvent(req.user.id, EVENTS.AI_LISTING_DESC, {
      tone,
      word_count: typeof parsed.description === 'string' ? parsed.description.split(/\s+/).length : 0,
      tokens: aiResponse?.usage?.total_tokens || 0,
    });

    res.json({
      headline: parsed.headline || '',
      description: parsed.description || '',
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 8) : [],
      tone,
      model: 'claude-sonnet-4-6',
      usage: aiResponse?.usage,
    });
  })
);

module.exports = router;
