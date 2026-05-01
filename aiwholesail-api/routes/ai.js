const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { attachSubscription, requireElite } = require('../middleware/subscription');
const {
  callClaude,
  callClaudeWithTools,
  PROPERTY_ANALYSIS_PROMPT,
  LEAD_SCORING_PROMPT,
  WHOLESALE_ANALYSIS_PROMPT
} = require('../services/openai');

const router = express.Router();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/**
 * POST /api/ai/property-analysis
 * AI-powered property analysis
 */
router.post('/property-analysis', authenticate, attachSubscription, requireElite, [
  body('property').optional().isObject(), body('csv_data').optional().isArray(), body('market').optional().isString()
], asyncHandler(async (req, res) => {
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

  const systemPrompt = `${PROPERTY_ANALYSIS_PROMPT}

Current property overview: ${JSON.stringify(property, null, 2)}`;

  const messages = [];

  // Add conversation history
  conversationHistory.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content });
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
  const aiResponse = await callClaudeWithTools(systemPrompt, messages, tools);

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

    const finalResponse = await callClaudeWithTools(systemPrompt, messages, tools);

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

  res.json({
    response: aiResponse.content[0]?.text || 'Analysis complete',
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/lead-scoring
 * AI-powered lead scoring
 */
router.post('/lead-scoring', authenticate, [
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

Property Data: ${JSON.stringify(property, null, 2)}

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

  const aiResponse = await callClaude(LEAD_SCORING_PROMPT, userMessage);
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
router.post('/wholesale-analyzer', authenticate, [
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
    const batchMessage = "Analyze these " + csv_data.length + " wholesale deal candidates in " + (market || "the target market") + ". Properties: " + JSON.stringify(csv_data.slice(0, 25)) + ". For each: calculate ARV, repair costs, MAO (70% rule), wholesale profit, deal score (1-100). Rank best to worst. Return JSON with deals array.";
    const batchResponse = await callClaude(WHOLESALE_ANALYSIS_PROMPT, batchMessage);
    const batchText = batchResponse.content[0]?.text || "";
    return res.json({ response: batchText, type: "batch", count: csv_data.length });
  }

  if (!property) {
    return res.status(400).json({ error: "Either property or csv_data is required" });
  }

  const userMessage = `Analyze this wholesale deal opportunity:

Property Data: ${JSON.stringify(property, null, 2)}
${repairEstimate ? `Estimated Repairs: $${repairEstimate}` : ''}
${arv ? `Estimated ARV: $${arv}` : ''}

Provide a comprehensive wholesale deal analysis including MAO calculation, profit potential, and recommendation.`;

  const aiResponse = await callClaude(WHOLESALE_ANALYSIS_PROMPT, userMessage);
  const responseText = aiResponse.content[0]?.text || '';

  // Save to wholesale_deals table
  const address = property.address || property.streetAddress || 'Unknown';
  const price = property.price || property.listPrice || 0;

  await query(
    `INSERT INTO wholesale_deals (user_id, property_address, arv, repair_estimate, ai_analysis, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [req.user.id, address, arv || null, repairEstimate || null, responseText]
  );

  res.json({
    response: responseText,
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/damage-detection
 * AI-powered property damage detection from photos
 */
router.post('/damage-detection', authenticate, [
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

Return a structured analysis with specific findings and estimates.`;

  // For now, analyze based on property data (full image analysis would require OpenAI Vision)
  const userMessage = `Property Details:
${JSON.stringify(propertyData || {}, null, 2)}

Number of photos to analyze: ${photos.length}
Photo URLs: ${photos.slice(0, 5).join(', ')}

Based on the property age, type, and available data, provide an estimated condition assessment.`;

  const aiResponse = await callClaude(systemPrompt, userMessage);
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
router.post('/deal-analysis', authenticate, [
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
${zillowUrl ? `Zillow URL: ${zillowUrl}` : ''}
${address ? `Address: ${address}` : ''}
${propertyData ? `Property Data: ${JSON.stringify(propertyData, null, 2)}` : ''}

Provide a quick wholesale deal assessment with:
1. Estimated ARV
2. Suggested offer price
3. Deal potential (1-10 score)
4. Key considerations`;

  const aiResponse = await callClaude(WHOLESALE_ANALYSIS_PROMPT, userMessage);

  res.json({
    response: aiResponse.content[0]?.text || 'Analysis complete',
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/chat
 * General AI chat for property questions
 */
router.post('/chat', authenticate, [
  body('message').notEmpty().withMessage('Message required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { message, context, conversationHistory = [] } = req.body;

  const systemPrompt = `You are AI Wholesail Assistant, an expert in real estate wholesaling. Help users with:
- Property analysis and evaluation
- Wholesale deal calculations
- Market insights
- Investment strategies
- Skip tracing guidance
- Marketing advice

${context ? `Context: ${JSON.stringify(context)}` : ''}

Be helpful, concise, and provide actionable advice.`;

  const messages = [
    ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: message }
  ];

  const aiResponse = await callClaudeWithTools(systemPrompt, messages, []);

  res.json({
    response: aiResponse.content[0]?.text || '',
    usage: aiResponse.usage
  });
}));

/**
 * POST /api/ai/photo-analysis
 * AI-powered property photo condition analysis and rehab cost estimation
 */
router.post('/photo-analysis', authenticate, attachSubscription, requireElite, [
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

  const systemPrompt = `You are an expert real estate property inspector and rehab cost estimator. Analyze these property photos and provide:
1) Overall condition assessment (excellent/good/fair/poor)
2) Specific issues visible (roof, siding, windows, flooring, kitchen, bathrooms, etc.)
3) Estimated rehab cost breakdown by category
4) Total estimated rehab cost range
5) Recommended repairs prioritized by ROI

Base estimates on current 2026 contractor rates. Property details: ${propertyDetails}

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
}`;

  const userMessage = `Please analyze these property photos and provide a detailed condition assessment with rehab cost estimates for the property at ${property.address || 'the provided address'}.`;

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
      }
    });

    const responseText = response.data.choices?.[0]?.message?.content || '';

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

module.exports = router;
