import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyPhoto {
  url: string;
  room_type: string;
  description?: string;
}

interface AdvancedRepairAssessment {
  category: string;
  subcategory?: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical' | 'emergency';
  estimated_cost: number;
  cost_range: { min: number; max: number };
  confidence_score: number;
  description: string;
  location: string;
  priority: number;
  urgency: 'immediate' | 'within_week' | 'within_month' | 'routine';
  detected_materials?: string[];
  safety_concerns?: string[];
  code_violations?: string[];
  recommended_action: string;
  prevention_tips?: string;
  ai_model_used: string;
}

interface PropertyConditionReport {
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor' | 'distressed' | 'condemned';
  total_repair_estimate: number;
  confidence_score: number;
  repairs: AdvancedRepairAssessment[];
  photos_analyzed: number;
  assessment_timestamp: string;
  market_value_impact: number;
  investment_recommendation: 'strong_buy' | 'buy' | 'hold' | 'pass' | 'avoid';
  risk_factors: string[];
  opportunities: string[];
}

class StateOfTheArtAIAssessment {
  private anthropicApiKey: string;
  private openaiApiKey: string;
  private supabase: any;
  
  constructor() {
    this.anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    this.openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async assessProperty(zpid: string, photos: PropertyPhoto[]): Promise<PropertyConditionReport> {
    console.log(`🔍 Starting state-of-the-art AI assessment for property ${zpid}`);
    
    try {
      const assessmentPromises = photos.map(async (photo, index) => {
        const [claudeAssessment, gptAssessment] = await Promise.all([
          this.analyzeWithClaudeSonnet4(photo, index),
          this.analyzeWithGPT(photo, index)
        ]);
        
        return this.fuseAssessments(claudeAssessment, gptAssessment, photo);
      });

      const allAssessments = await Promise.all(assessmentPromises);
      const repairs = allAssessments.flat();
      
      const consolidatedRepairs = await this.intelligentConsolidation(repairs);
      const marketAnalysis = await this.analyzeMarketImpact(consolidatedRepairs, zpid);
      const report = await this.generateComprehensiveReport(consolidatedRepairs, marketAnalysis, photos.length);
      
      await this.saveAdvancedAssessment(zpid, report);
      
      return report;
    } catch (error) {
      console.error('Error in state-of-the-art assessment:', error);
      throw error;
    }
  }

  async assessPropertyWithoutPhotos(property: any): Promise<PropertyConditionReport> {
    console.log(`🏠 Assessing property without photos: ${property.zpid}`);
    
    // Generate basic assessment based on property data
    const estimatedRepairs = this.estimateRepairsFromPropertyData(property);
    
    return {
      zpid: property.zpid,
      total_repair_estimate: estimatedRepairs,
      confidence_score: 0.6, // Lower confidence without photos
      repairs: [],
      overall_condition: 'average',
      major_concerns: [],
      photos_analyzed: 0,
      assessment_timestamp: new Date().toISOString(),
      market_value_impact: -5,
      investment_recommendation: 'hold',
      risk_factors: ['No visual inspection available'],
      opportunities: ['Basic market analysis completed']
    };
  }

  private estimateRepairsFromPropertyData(property: any): number {
    const baseRepair = 15000; // Base repair estimate
    const ageMultiplier = property.yearBuilt ? Math.max(1, 2024 - property.yearBuilt) / 20 : 1.5;
    const sizeMultiplier = property.sqft ? property.sqft / 2000 : 1;
    
    return Math.round(baseRepair * ageMultiplier * sizeMultiplier);
  }

  private async analyzeWithClaudeSonnet4(photo: PropertyPhoto, photoIndex: number): Promise<AdvancedRepairAssessment[]> {
    const advancedPrompt = this.buildClaudePrompt(photo.room_type);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2000,
          temperature: 0.1,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: advancedPrompt },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: await this.convertImageToBase64(photo.url)
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.content[0].text;
      return this.parseAdvancedResponse(analysis, photo.room_type, 'claude-sonnet-4', photoIndex);
    } catch (error) {
      console.error('Claude Sonnet 4 analysis error:', error);
      return [];
    }
  }

  private async analyzeWithGPT(photo: PropertyPhoto, photoIndex: number): Promise<AdvancedRepairAssessment[]> {
    const prompt = this.buildGPTPrompt(photo.room_type);
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert property inspector and contractor with 25+ years of experience. Provide detailed, accurate assessments with precise cost estimates."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: photo.url } }
              ]
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.choices[0].message.content || '';
      return this.parseAdvancedResponse(analysis, photo.room_type, 'gpt-4o', photoIndex);
    } catch (error) {
      console.error('GPT analysis error:', error);
      return [];
    }
  }

  private buildClaudePrompt(roomType: string): string {
    return `As a master property inspector with deep expertise in construction, real estate valuation, and building codes, analyze this ${roomType} image with exceptional detail and precision.

ADVANCED ANALYSIS FRAMEWORK:

🔍 VISUAL INSPECTION PROTOCOL:
- Structural integrity assessment (foundation, framing, load-bearing elements)
- Building envelope analysis (moisture barriers, insulation, ventilation)
- Systems evaluation (electrical, plumbing, HVAC visible components)
- Material condition and lifecycle assessment
- Code compliance observations
- Safety hazard identification

💰 COST ESTIMATION METHODOLOGY:
- Use 2024-2025 construction cost data
- Factor in regional labor rates (25-35% variance by market)
- Include material costs with current inflation adjustments
- Account for permit requirements and inspection fees
- Consider access difficulty and project complexity
- Add contingency for unforeseen conditions (10-20%)

⚠️ PRIORITY CLASSIFICATION:
1. EMERGENCY (immediate safety risk, structural failure)
2. CRITICAL (major system failure, water intrusion)
3. MAJOR (significant repair needed within 6 months)
4. MODERATE (repair needed within 1 year)
5. MINOR (cosmetic or preventive maintenance)

Return analysis as JSON array:
[{
  "category": "specific_category",
  "subcategory": "detailed_subcategory",
  "severity": "emergency|critical|major|moderate|minor",
  "description": "detailed technical description",
  "location": "precise location within room",
  "estimated_cost": numeric_value,
  "cost_range": {"min": lower_bound, "max": upper_bound},
  "confidence_score": 0.0_to_1.0,
  "priority": 1_to_10_scale,
  "urgency": "immediate|within_week|within_month|routine",
  "detected_materials": ["material1", "material2"],
  "safety_concerns": ["concern1", "concern2"],
  "code_violations": ["violation1", "violation2"],
  "recommended_action": "specific action plan",
  "prevention_tips": "how to prevent recurrence"
}]`;
  }

  private buildGPTPrompt(roomType: string): string {
    return `You are analyzing a ${roomType} photograph as an expert property inspector and general contractor. Use advanced pattern recognition to identify ALL repair needs with construction-grade accuracy.

INSPECTION CHECKLIST FOR ${roomType.toUpperCase()}:
${this.getRoomSpecificChecklist(roomType)}

ADVANCED DETECTION REQUIREMENTS:
• Micro-crack analysis in surfaces
• Water stain pattern recognition  
• Material degradation assessment
• Installation quality evaluation
• Code compliance verification
• Hidden damage indicators
• Wear pattern analysis
• Safety hazard identification

COST ESTIMATION STANDARDS:
• Use current market rates (2024-2025)
• Include labor, materials, permits, disposal
• Factor in access difficulty multipliers
• Add geographic cost adjustments
• Include project management fees (10-15%)
• Account for code upgrade requirements

Return detailed JSON array with exact fields for each issue:
[{
  "category": "Primary repair category",
  "subcategory": "Specific issue type",
  "severity": "emergency|critical|major|moderate|minor",
  "estimated_cost": "Single best estimate in USD",
  "cost_range": {"min": "lowest_cost", "max": "highest_cost"},
  "confidence_score": "0.1 to 1.0",
  "description": "Technical description of the issue",
  "location": "Specific location within the room",
  "priority": "1-10 ranking for repair sequence",
  "urgency": "immediate|within_week|within_month|routine",
  "recommended_action": "Specific steps to address",
  "safety_concerns": ["Any safety implications"],
  "code_violations": ["Building code issues if any"]
}]`;
  }

  private getRoomSpecificChecklist(roomType: string): string {
    const checklists = {
      kitchen: `
• Cabinet door alignment, hardware looseness, drawer slide wear
• Countertop material condition, seam integrity, edge damage
• Backsplash tile condition, grout deterioration, caulk failure
• Appliance condition, electrical connections, gas line integrity
• Faucet operation, under-sink plumbing, disposal unit
• Flooring wear patterns, subfloor deflection, transition strips
• Electrical outlet GFCI compliance, switch functionality
• Ventilation adequacy, range hood condition, makeup air
• Windows above sink, natural lighting, moisture control`,
      
      bathroom: `
• Tile condition, grout integrity, caulk seal effectiveness
• Fixture mounting, water pressure, drainage flow rates
• Mirror mounting, medicine cabinet condition, lighting adequacy
• Ventilation fan operation, moisture control, mold prevention
• Flooring water resistance, subfloor integrity, threshold sealing
• Plumbing access, shut-off valve operation, supply line condition
• Electrical GFCI protection, fixture grounding, switch placement
• Window condition, privacy glass, moisture resistance
• Storage functionality, towel bar mounting, accessibility features`,
      
      bedroom: `
• Wall surface condition, paint adhesion, texture uniformity
• Flooring condition, carpet wear, hardwood finish integrity
• Window operation, seal condition, hardware functionality
• Ceiling condition, texture adherence, light fixture mounting
• Electrical outlet quantity, switch operation, fan installation
• Closet door operation, shelving condition, rod mounting
• Heating/cooling register condition, airflow adequacy
• Insulation visibility, vapor barrier integrity, air sealing`,
      
      exterior: `
• Roof material condition, fastener integrity, flashing details
• Gutter system functionality, downspout connection, drainage
• Siding condition, paint adherence, caulk seal effectiveness
• Foundation visible condition, grade levels, drainage patterns
• Window condition, weatherstripping, caulk sealing
• Door condition, threshold integrity, lock functionality
• Walkway condition, slope adequacy, material integrity
• Landscaping impact, tree proximity, irrigation systems`
    };

    return checklists[roomType as keyof typeof checklists] || checklists.bedroom;
  }

  private async fuseAssessments(
    claudeAssessment: AdvancedRepairAssessment[],
    gptAssessment: AdvancedRepairAssessment[],
    photo: PropertyPhoto
  ): Promise<AdvancedRepairAssessment[]> {
    
    if (claudeAssessment.length === 0) return gptAssessment;
    if (gptAssessment.length === 0) return claudeAssessment;
    
    const fusionPrompt = `As an expert property assessor, fuse these two AI assessments into a single, optimized assessment:

CLAUDE ASSESSMENT:
${JSON.stringify(claudeAssessment, null, 2)}

GPT ASSESSMENT:  
${JSON.stringify(gptAssessment, null, 2)}

Return the fused assessment as a JSON array with the most accurate, comprehensive, and actionable repair list.`;

    try {
      const fusionResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2000,
          temperature: 0.05,
          messages: [
            {
              role: "user",
              content: fusionPrompt
            }
          ]
        })
      });

      if (!fusionResponse.ok) {
        throw new Error(`Claude fusion API error: ${fusionResponse.status}`);
      }

      const data = await fusionResponse.json();
      const fusionText = data.content[0].text;
      const fusedAssessment = this.parseAdvancedResponse(fusionText, photo.room_type, 'claude-fusion', 0);
      
      return fusedAssessment.length > 0 ? fusedAssessment : [...claudeAssessment, ...gptAssessment];
    } catch (error) {
      console.error('Fusion assessment error:', error);
      return this.fallbackFusion(claudeAssessment, gptAssessment);
    }
  }

  private parseAdvancedResponse(
    response: string, 
    location: string, 
    modelUsed: string, 
    photoIndex: number
  ): AdvancedRepairAssessment[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*?\]/) || response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        console.warn(`No JSON found in ${modelUsed} response`);
        return [];
      }
      
      let repairs = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(repairs)) {
        repairs = [repairs];
      }
      
      return repairs.map((repair: any): AdvancedRepairAssessment => ({
        category: repair.category || 'unknown',
        subcategory: repair.subcategory,
        severity: this.validateSeverity(repair.severity),
        estimated_cost: this.parseEstimatedCost(repair.estimated_cost || repair.cost_range?.min || 0),
        cost_range: {
          min: repair.cost_range?.min || repair.estimated_cost || 0,
          max: repair.cost_range?.max || repair.estimated_cost || 0
        },
        confidence_score: Math.min(Math.max(repair.confidence_score || 0.5, 0), 1),
        description: repair.description || 'Assessment description unavailable',
        location: location,
        priority: Math.min(Math.max(repair.priority || 5, 1), 10),
        urgency: this.validateUrgency(repair.urgency),
        detected_materials: repair.detected_materials || [],
        safety_concerns: repair.safety_concerns || [],
        code_violations: repair.code_violations || [],
        recommended_action: repair.recommended_action || 'Further inspection recommended',
        prevention_tips: repair.prevention_tips,
        ai_model_used: modelUsed
      }));
    } catch (error) {
      console.error(`Error parsing ${modelUsed} response:`, error);
      return [];
    }
  }

  private async analyzeMarketImpact(repairs: AdvancedRepairAssessment[], zpid: string): Promise<any> {
    const totalRepairCost = repairs.reduce((sum, repair) => sum + repair.estimated_cost, 0);
    const criticalIssues = repairs.filter(r => r.severity === 'critical' || r.severity === 'emergency').length;
    
    const marketPrompt = `As a real estate market analyst, analyze the market impact of these property repairs:

REPAIR SUMMARY:
- Total Estimated Repairs: $${totalRepairCost.toLocaleString()}
- Critical Issues: ${criticalIssues}
- Total Issues: ${repairs.length}

DETAILED REPAIRS:
${repairs.map(r => `• ${r.category}: $${r.estimated_cost.toLocaleString()} (${r.severity})`).join('\n')}

Provide JSON analysis:
{
  "market_value_impact": percentage_impact,
  "investment_recommendation": "strong_buy|buy|hold|pass|avoid",
  "risk_factors": ["factor1", "factor2", "factor3"],
  "opportunities": ["opportunity1", "opportunity2", "opportunity3"],
  "absorption_timeline": "time_estimate"
}`;

    try {
      const marketResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: marketPrompt
            }
          ]
        })
      });

      if (!marketResponse.ok) {
        throw new Error(`Market analysis API error: ${marketResponse.status}`);
      }

      const data = await marketResponse.json();
      const analysisText = data.content[0].text;
      return this.parseMarketAnalysis(analysisText);
    } catch (error) {
      console.error('Market analysis error:', error);
      return this.generateFallbackMarketAnalysis(totalRepairCost, criticalIssues);
    }
  }

  private validateSeverity(severity: string): AdvancedRepairAssessment['severity'] {
    const validSeverities = ['minor', 'moderate', 'major', 'critical', 'emergency'];
    return validSeverities.includes(severity) ? severity as any : 'moderate';
  }

  private validateUrgency(urgency: string): AdvancedRepairAssessment['urgency'] {
    const validUrgencies = ['immediate', 'within_week', 'within_month', 'routine'];
    return validUrgencies.includes(urgency) ? urgency as any : 'routine';
  }

  private parseEstimatedCost(cost: any): number {
    if (typeof cost === 'number') return cost;
    if (typeof cost === 'string') {
      const numbers = cost.match(/\d+/g)?.map(Number) || [0];
      return Math.max(...numbers);
    }
    return 0;
  }

  private async convertImageToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const decoder = new TextDecoder('latin1');
      const binaryString = decoder.decode(uint8Array);
      return btoa(binaryString);
    } catch (error) {
      console.error('Image conversion error:', error);
      throw error;
    }
  }

  private fallbackFusion(
    assessment1: AdvancedRepairAssessment[], 
    assessment2: AdvancedRepairAssessment[]
  ): AdvancedRepairAssessment[] {
    const merged = [...assessment1];
    
    for (const repair of assessment2) {
      const existing = merged.find(r => 
        r.category === repair.category && 
        r.location === repair.location
      );
      
      if (!existing) {
        merged.push(repair);
      } else if (repair.confidence_score > existing.confidence_score) {
        const index = merged.indexOf(existing);
        merged[index] = repair;
      }
    }
    
    return merged;
  }

  private async intelligentConsolidation(repairs: AdvancedRepairAssessment[]): Promise<AdvancedRepairAssessment[]> {
    const consolidated = new Map<string, AdvancedRepairAssessment>();
    
    for (const repair of repairs) {
      const key = `${repair.category}-${repair.location}-${repair.subcategory || ''}`;
      
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        if (this.getSeverityWeight(repair.severity) >= this.getSeverityWeight(existing.severity)) {
          consolidated.set(key, {
            ...repair,
            estimated_cost: Math.max(repair.estimated_cost, existing.estimated_cost),
            confidence_score: (repair.confidence_score + existing.confidence_score) / 2,
            ai_model_used: `${existing.ai_model_used},${repair.ai_model_used}`
          });
        }
      } else {
        consolidated.set(key, repair);
      }
    }
    
    return Array.from(consolidated.values()).sort((a, b) => b.priority - a.priority);
  }

  private getSeverityWeight(severity: string): number {
    const weights = { minor: 1, moderate: 2, major: 3, critical: 4, emergency: 5 };
    return weights[severity as keyof typeof weights] || 2;
  }

  private parseMarketAnalysis(analysisText: string): any {
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.generateFallbackMarketAnalysis(0, 0);
    } catch {
      return this.generateFallbackMarketAnalysis(0, 0);
    }
  }

  private generateFallbackMarketAnalysis(totalCost: number, criticalIssues: number): any {
    const impactPercent = Math.min(totalCost / 5000, 30);
    
    return {
      market_value_impact: -impactPercent,
      investment_recommendation: criticalIssues > 2 ? 'pass' : totalCost > 25000 ? 'hold' : 'buy',
      risk_factors: ['High repair costs', 'Multiple critical issues', 'Market uncertainty'],
      opportunities: ['Below market purchase', 'Forced appreciation', 'Rental income potential'],
      absorption_timeline: criticalIssues > 2 ? '6+ months' : '2-4 months'
    };
  }

  private async generateComprehensiveReport(
    repairs: AdvancedRepairAssessment[], 
    marketAnalysis: any, 
    photosCount: number
  ): Promise<PropertyConditionReport> {
    const totalCost = repairs.reduce((sum, r) => sum + r.estimated_cost, 0);
    const avgConfidence = repairs.length > 0 ? 
      repairs.reduce((sum, r) => sum + r.confidence_score, 0) / repairs.length : 0;
    
    return {
      overall_condition: this.determineOverallCondition(repairs, totalCost),
      total_repair_estimate: totalCost,
      confidence_score: avgConfidence,
      repairs: repairs,
      photos_analyzed: photosCount,
      assessment_timestamp: new Date().toISOString(),
      market_value_impact: marketAnalysis.market_value_impact || 0,
      investment_recommendation: marketAnalysis.investment_recommendation || 'hold',
      risk_factors: marketAnalysis.risk_factors || [],
      opportunities: marketAnalysis.opportunities || []
    };
  }

  private determineOverallCondition(
    repairs: AdvancedRepairAssessment[], 
    totalCost: number
  ): PropertyConditionReport['overall_condition'] {
    const emergencyCount = repairs.filter(r => r.severity === 'emergency').length;
    const criticalCount = repairs.filter(r => r.severity === 'critical').length;
    const majorCount = repairs.filter(r => r.severity === 'major').length;
    
    if (emergencyCount > 0 || totalCost > 75000) return 'condemned';
    if (criticalCount > 2 || totalCost > 50000) return 'distressed';
    if (criticalCount > 0 || majorCount > 3 || totalCost > 25000) return 'poor';
    if (majorCount > 0 || totalCost > 10000) return 'fair';
    if (totalCost > 3000) return 'good';
    return 'excellent';
  }

  private async saveAdvancedAssessment(zpid: string, report: PropertyConditionReport): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('advanced_property_assessments')
        .upsert({
          zpid,
          overall_condition: report.overall_condition,
          total_repair_estimate: report.total_repair_estimate,
          confidence_score: report.confidence_score,
          market_value_impact: report.market_value_impact,
          investment_recommendation: report.investment_recommendation,
          detailed_assessment: report,
          photos_analyzed: report.photos_analyzed,
          ai_models_used: ['claude-sonnet-4', 'gpt-4o'],
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      console.log(`✅ Advanced assessment saved for property ${zpid}`);
    } catch (error) {
      console.error('Error saving advanced assessment:', error);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zpid, photos, arv, acquisition_costs, wholesale_fee } = await req.json();
    
    if (!zpid || !photos || !Array.isArray(photos)) {
      throw new Error('ZPID and photos array are required');
    }

    console.log(`🚀 Starting comprehensive AI assessment for property ${zpid}`);
    
    const aiAssessment = new StateOfTheArtAIAssessment();
    const assessment = await aiAssessment.assessProperty(zpid, photos);
    
    // Calculate advanced deal metrics
    const repairCosts = assessment.total_repair_estimate;
    const marketValueAdjustment = (arv || 250000) * (assessment.market_value_impact / 100);
    const adjustedARV = (arv || 250000) + marketValueAdjustment;
    
    const maxOffer = (adjustedARV * 0.70) - repairCosts - (acquisition_costs || 2000);
    const maxPurchasePrice = maxOffer - (wholesale_fee || 5000);
    
    const riskScore = this.calculateRiskScore(assessment);
    const opportunityScore = this.calculateOpportunityScore(assessment, adjustedARV);
    
    const dealMetrics = {
      arv: adjustedARV,
      original_arv: arv || 250000,
      market_adjustment: marketValueAdjustment,
      estimated_repairs: repairCosts,
      max_offer: maxOffer,
      wholesale_fee: wholesale_fee || 5000,
      max_purchase_price: maxPurchasePrice,
      profit_margin: wholesale_fee || 5000,
      deal_grade: this.gradeDeal(maxPurchasePrice, adjustedARV, assessment.confidence_score, riskScore),
      risk_score: riskScore,
      opportunity_score: opportunityScore,
      roi_potential: maxPurchasePrice > 0 ? ((wholesale_fee || 5000) / maxPurchasePrice) * 100 : 0,
      condition_assessment: assessment,
      investment_recommendation: assessment.investment_recommendation,
      risk_factors: assessment.risk_factors,
      opportunities: assessment.opportunities
    };

    console.log(`✅ Comprehensive assessment completed for ${zpid}`);

    return new Response(JSON.stringify({
      success: true,
      assessment,
      deal_metrics: dealMetrics,
      analysis_timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in comprehensive property assessment:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions for deal grading (attached to global scope for access)
function calculateRiskScore(assessment: PropertyConditionReport): number {
  let riskScore = 0;
  
  const severityWeights = { minor: 1, moderate: 2, major: 4, critical: 7, emergency: 10 };
  const severityRisk = assessment.repairs.reduce((sum, repair) => {
    return sum + (severityWeights[repair.severity] || 2);
  }, 0);
  
  const costRisk = Math.min(assessment.total_repair_estimate / 1000, 50);
  const confidenceRisk = (1 - assessment.confidence_score) * 20;
  
  riskScore = (severityRisk + costRisk + confidenceRisk) / 3;
  
  return Math.min(Math.max(riskScore, 0), 100);
}

function calculateOpportunityScore(assessment: PropertyConditionReport, arv: number): number {
  let opportunityScore = 0;
  
  const costRatio = assessment.total_repair_estimate / arv;
  const costOpportunity = Math.max(0, (0.15 - costRatio) * 100);
  
  const confidenceOpportunity = assessment.confidence_score * 30;
  
  const criticalIssues = assessment.repairs.filter(r => r.severity === 'critical' || r.severity === 'emergency').length;
  const severityOpportunity = Math.max(0, 40 - (criticalIssues * 10));
  
  opportunityScore = (costOpportunity + confidenceOpportunity + severityOpportunity) / 3;
  
  return Math.min(Math.max(opportunityScore, 0), 100);
}

function gradeDeal(purchasePrice: number, arv: number, confidence: number, riskScore: number): string {
  if (purchasePrice <= 0) return 'F';
  
  const margin = (arv - purchasePrice) / arv;
  const adjustedMargin = margin * confidence * (100 - riskScore) / 100;
  
  if (adjustedMargin > 0.45) return 'A+';
  if (adjustedMargin > 0.35) return 'A';
  if (adjustedMargin > 0.25) return 'B+';
  if (adjustedMargin > 0.20) return 'B';
  if (adjustedMargin > 0.15) return 'C+';
  if (adjustedMargin > 0.10) return 'C';
  return 'D';
}