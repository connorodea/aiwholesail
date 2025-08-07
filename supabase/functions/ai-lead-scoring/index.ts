import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyIntelligence {
  tax_delinquent: boolean;
  delinquent_amount?: number;
  foreclosure_risk: boolean;
  probate_property: boolean;
  divorce_related: boolean;
  bankruptcy_risk: boolean;
  inheritance_property: boolean;
  financial_distress: boolean;
  absentee_owner: boolean;
  occupancy_status: string;
  property_condition: string;
  active_liens: any[];
  code_violations: any[];
  estimated_equity?: number;
  equity_percentage?: number;
}

interface LeadContact {
  contact_type: string;
  verified: boolean;
  skip_traced: boolean;
  skip_trace_confidence: number;
}

interface ScoringFactor {
  factor: string;
  weight: number;
  impact: 'positive' | 'negative';
  description: string;
}

interface LeadScores {
  motivation_score: number;
  urgency_score: number;
  profitability_score: number;
  contactability_score: number;
  overall_score: number;
  confidence_score: number;
  scoring_factors: ScoringFactor[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, property_intelligence, contacts, force_rescore } = await req.json();

    if (!lead_id) {
      throw new Error('Lead ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if scoring already exists and is recent (unless force_rescore is true)
    if (!force_rescore) {
      const { data: existingScore } = await supabase
        .from('lead_scoring')
        .select('*')
        .eq('lead_id', lead_id)
        .gte('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within 24 hours
        .single();

      if (existingScore) {
        return new Response(JSON.stringify({
          success: true,
          scores: existingScore,
          cached: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Calculate AI-powered lead scoring
    const scores = await calculateLeadScores(property_intelligence, contacts || []);

    // Store the scoring results
    const { data, error } = await supabase
      .from('lead_scoring')
      .upsert({
        lead_id,
        motivation_score: scores.motivation_score,
        urgency_score: scores.urgency_score,
        profitability_score: scores.profitability_score,
        contactability_score: scores.contactability_score,
        overall_score: scores.overall_score,
        confidence_score: scores.confidence_score,
        scoring_factors: scores.scoring_factors,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'lead_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing lead scores:', error);
      throw error;
    }

    console.log(`Lead ${lead_id} scored: ${scores.overall_score}/1000 (Motivation: ${scores.motivation_score}, Urgency: ${scores.urgency_score})`);

    return new Response(JSON.stringify({
      success: true,
      scores: data,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-lead-scoring function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to calculate lead scores'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateLeadScores(
  intel: PropertyIntelligence,
  contacts: LeadContact[]
): Promise<LeadScores> {
  let motivationScore = 0;
  const factors: ScoringFactor[] = [];

  // High-impact motivation factors (based on wholesaling research)
  if (intel.foreclosure_risk) {
    motivationScore += 200;
    factors.push({
      factor: 'Foreclosure Risk',
      weight: 200,
      impact: 'positive',
      description: 'Property shows signs of foreclosure proceedings'
    });
  }

  if (intel.probate_property) {
    motivationScore += 150;
    factors.push({
      factor: 'Probate Property',
      weight: 150,
      impact: 'positive',
      description: 'Property is part of probate proceedings'
    });
  }

  if (intel.divorce_related) {
    motivationScore += 120;
    factors.push({
      factor: 'Divorce Related',
      weight: 120,
      impact: 'positive',
      description: 'Property ownership affected by divorce'
    });
  }

  if (intel.bankruptcy_risk) {
    motivationScore += 180;
    factors.push({
      factor: 'Bankruptcy Risk',
      weight: 180,
      impact: 'positive',
      description: 'Owner shows signs of financial distress/bankruptcy'
    });
  }

  if (intel.inheritance_property) {
    motivationScore += 100;
    factors.push({
      factor: 'Inherited Property',
      weight: 100,
      impact: 'positive',
      description: 'Property was recently inherited'
    });
  }

  // Tax and financial distress
  if (intel.tax_delinquent) {
    const delinquentAmount = intel.delinquent_amount || 0;
    const delinquentScore = Math.min(delinquentAmount / 1000 * 10, 150);
    motivationScore += delinquentScore;
    factors.push({
      factor: 'Tax Delinquency',
      weight: delinquentScore,
      impact: 'positive',
      description: `Property has $${delinquentAmount} in delinquent taxes`
    });
  }

  if (intel.financial_distress) {
    motivationScore += 90;
    factors.push({
      factor: 'Financial Distress',
      weight: 90,
      impact: 'positive',
      description: 'Owner showing signs of financial difficulties'
    });
  }

  // Liens and code violations
  const activeLiens = intel.active_liens?.length || 0;
  if (activeLiens > 0) {
    const lienScore = activeLiens * 30;
    motivationScore += lienScore;
    factors.push({
      factor: `Active Liens (${activeLiens})`,
      weight: lienScore,
      impact: 'positive',
      description: `Property has ${activeLiens} active liens`
    });
  }

  const openViolations = intel.code_violations?.length || 0;
  if (openViolations > 0) {
    const violationScore = openViolations * 25;
    motivationScore += violationScore;
    factors.push({
      factor: `Code Violations (${openViolations})`,
      weight: violationScore,
      impact: 'positive',
      description: `Property has ${openViolations} code violations`
    });
  }

  // Property condition
  if (intel.property_condition === 'poor') {
    motivationScore += 80;
    factors.push({
      factor: 'Poor Property Condition',
      weight: 80,
      impact: 'positive',
      description: 'Property is in poor condition requiring significant repairs'
    });
  } else if (intel.property_condition === 'fair') {
    motivationScore += 40;
    factors.push({
      factor: 'Fair Property Condition',
      weight: 40,
      impact: 'positive',
      description: 'Property needs some repairs and updates'
    });
  }

  // Absentee ownership
  if (intel.absentee_owner) {
    motivationScore += 60;
    factors.push({
      factor: 'Absentee Owner',
      weight: 60,
      impact: 'positive',
      description: 'Owner does not live in the property'
    });
  }

  // Vacancy
  if (intel.occupancy_status === 'vacant') {
    motivationScore += 70;
    factors.push({
      factor: 'Vacant Property',
      weight: 70,
      impact: 'positive',
      description: 'Property is currently vacant with carrying costs'
    });
  }

  // Cap motivation score at 1000
  motivationScore = Math.min(motivationScore, 1000);

  // Calculate urgency score (0-100)
  let urgencyScore = 50; // baseline
  if (intel.foreclosure_risk) urgencyScore += 40;
  if (intel.bankruptcy_risk) urgencyScore += 35;
  if (intel.tax_delinquent) urgencyScore += 25;
  if (intel.financial_distress) urgencyScore += 20;
  urgencyScore = Math.min(urgencyScore, 100);

  // Calculate profitability score (0-100)
  let profitabilityScore = 50; // baseline
  if (intel.equity_percentage !== undefined) {
    profitabilityScore = Math.min(intel.equity_percentage * 2, 100);
  } else if (intel.estimated_equity !== undefined && intel.estimated_equity > 0) {
    // Assume property value and calculate equity percentage
    profitabilityScore = Math.min((intel.estimated_equity / 200000) * 100, 100);
  }

  // Factor in property condition for profitability
  if (intel.property_condition === 'poor') {
    profitabilityScore = Math.max(profitabilityScore - 20, 20);
  }

  // Calculate contactability score (0-100)
  let contactabilityScore = 0;
  for (const contact of contacts) {
    if (contact.contact_type === 'phone') contactabilityScore += 25;
    if (contact.contact_type === 'mobile') contactabilityScore += 30;
    if (contact.contact_type === 'email') contactabilityScore += 20;
    if (contact.contact_type === 'work') contactabilityScore += 15;
    if (contact.verified) contactabilityScore += 10;
    if (contact.skip_traced && contact.skip_trace_confidence > 70) contactabilityScore += 15;
  }
  contactabilityScore = Math.min(contactabilityScore, 100);

  // Calculate overall weighted score
  const overallScore = Math.round(
    motivationScore * 0.5 +    // 50% weight on motivation
    urgencyScore * 0.2 +       // 20% weight on urgency
    profitabilityScore * 0.2 + // 20% weight on profitability
    contactabilityScore * 0.1  // 10% weight on contactability
  );

  // Calculate AI confidence based on data completeness
  let confidenceScore = 60; // base confidence
  if (intel.tax_delinquent !== undefined) confidenceScore += 10;
  if (intel.property_condition !== undefined) confidenceScore += 10;
  if (intel.occupancy_status !== undefined) confidenceScore += 10;
  if (contacts.length > 0) confidenceScore += 10;
  confidenceScore = Math.min(confidenceScore, 100);

  return {
    motivation_score: motivationScore,
    urgency_score: urgencyScore,
    profitability_score: Math.round(profitabilityScore),
    contactability_score: contactabilityScore,
    overall_score: overallScore,
    confidence_score: confidenceScore,
    scoring_factors: factors
  };
}