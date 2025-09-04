import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FSBOBadgeProps {
  fsboDetection?: {
    score: number;
    confidence: number;
    tier: 'high' | 'medium' | 'low' | 'none';
    methods: {
      keywordAnalysis: { fsboKeywords: number; motivatedKeywords: number; score: number };
      agentAnalysis: { hasNoAgent: boolean; hasGenericBroker: boolean; agentIndicators: string[]; score: number };
      listingAnalysis: { hasFSBOFlag: boolean; score: number };
      pricingAnalysis: { price?: number; zestimate?: number; ratio?: number; score: number };
      sourceAnalysis: { sources: string[]; score: number };
    };
  };
  isFSBO: boolean;
}

export const FSBOBadge: React.FC<FSBOBadgeProps> = ({ fsboDetection, isFSBO }) => {
  if (!isFSBO || !fsboDetection) {
    return null;
  }

  const { confidence, tier, methods } = fsboDetection;

  // Determine badge color based on confidence tier
  const getBadgeVariant = () => {
    switch (tier) {
      case 'high':
        return 'default'; // Green
      case 'medium':
        return 'secondary'; // Blue
      case 'low':
        return 'outline'; // Gray
      default:
        return 'outline';
    }
  };

  // Create tooltip content with detection breakdown
  const getTooltipContent = () => (
    <div className="space-y-2 text-sm">
      <div className="font-semibold">FSBO Detection Breakdown</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>Confidence: {confidence}%</div>
        <div>Tier: {tier.toUpperCase()}</div>
      </div>
      
      <div className="space-y-1">
        <div className="font-medium">Detection Methods:</div>
        
        {methods.keywordAnalysis.fsboKeywords > 0 && (
          <div>📝 FSBO Keywords: {methods.keywordAnalysis.fsboKeywords}</div>
        )}
        
        {methods.agentAnalysis.hasNoAgent && (
          <div>🏢 No Agent Listed</div>
        )}
        
        {methods.agentAnalysis.agentIndicators.length > 0 && (
          <div>👤 Agent Indicators: {methods.agentAnalysis.agentIndicators.join(', ')}</div>
        )}
        
        {methods.listingAnalysis.hasFSBOFlag && (
          <div>🏷️ Explicit FSBO Flag</div>
        )}
        
        {methods.pricingAnalysis.ratio && (
          <div>💰 Price/Zestimate: {(methods.pricingAnalysis.ratio * 100).toFixed(0)}%</div>
        )}
        
        {methods.sourceAnalysis.sources.length > 0 && (
          <div>🔍 Sources: {methods.sourceAnalysis.sources.join(', ')}</div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={getBadgeVariant()} className="cursor-help">
            FSBO {confidence}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};