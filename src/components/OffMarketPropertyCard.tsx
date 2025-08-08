import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, Star, TrendingUp, Calculator } from 'lucide-react';
import type { OffMarketProperty } from '@/lib/off-market-api';

interface OffMarketPropertyCardProps {
  property: OffMarketProperty;
  onViewDetails?: () => void;
  onContact?: () => void;
}

export function OffMarketPropertyCard({ 
  property, 
  onViewDetails, 
  onContact 
}: OffMarketPropertyCardProps) {
  
  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'collected': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'filtered': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'validated': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'ai_analyzed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'collected': return 'Free Data';
      case 'filtered': return 'Filtered';
      case 'validated': return 'Validated';
      case 'ai_analyzed': return 'AI Analyzed';
      default: return 'Unknown';
    }
  };

  const getDistressIndicators = () => {
    const indicators = [];
    if (property.taxDelinquent) indicators.push({ label: 'Tax Delinquent', color: 'destructive' });
    if (property.foreclosureNotice) indicators.push({ label: 'Foreclosure', color: 'destructive' });
    if (property.codeViolations) indicators.push({ label: 'Code Violations', color: 'orange' });
    if (property.buildingPermitsRecent) indicators.push({ label: 'Recent Permits', color: 'blue' });
    if (!property.ownerOccupied) indicators.push({ label: 'Non-Owner Occupied', color: 'purple' });
    return indicators;
  };

  const distressIndicators = getDistressIndicators();

  return (
    <Card className="w-full max-w-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-lg leading-tight">
                {property.address}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {property.city}, {property.state}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant="secondary" className={getStageColor(property.stage)}>
              {getStageLabel(property.stage)}
            </Badge>
            {property.aiPriorityRank && (
              <Badge variant="default" className="bg-primary text-primary-foreground">
                <Star className="h-3 w-3 mr-1" />
                #{property.aiPriorityRank}
              </Badge>
            )}
          </div>
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Estimated Value</p>
            <p className="text-lg font-bold text-green-600">
              ${property.estimatedValue.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Property Type</p>
            <p className="text-sm font-medium">{property.propertyType}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Distress Indicators */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Distress Indicators
            </h4>
            <Badge variant="outline" className="text-xs">
              Score: {property.freeDataScore}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {distressIndicators.map((indicator, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {indicator.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* AI Analysis Results (if available) */}
        {property.stage === 'ai_analyzed' && (
          <div className="space-y-3 p-3 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg border">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Calculator className="h-4 w-4" />
              AI Analysis
            </h4>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact Strategy:</span>
                <span className="font-medium">{property.aiContactStrategy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offer Range:</span>
                <span className="font-medium text-green-600">{property.aiOfferRange}</span>
              </div>
              {property.aiTalkingPoints && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Key Points:</span>
                  <ul className="space-y-1 ml-2">
                    {property.aiTalkingPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-1 text-xs">
                        <span className="w-1 h-1 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Information (if available) */}
        {(property.phones || property.emails) && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Contact Info
            </h4>
            
            {property.ownerName && (
              <p className="text-sm font-medium">{property.ownerName}</p>
            )}
            
            <div className="space-y-2 text-xs">
              {property.phones?.map((phone, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{phone}</span>
                </div>
              ))}
              {property.emails?.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs">{email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Cost */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Calculator className="h-3 w-3" />
            Processing Cost: ${property.processingCost.toFixed(3)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {property.createdAt.toLocaleDateString()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex-1 h-9 text-sm"
          >
            <Calculator className="h-3 w-3 mr-1" />
            View Details
          </Button>
          
          {onContact && (property.phones || property.emails) && (
            <Button
              size="sm"
              onClick={onContact}
              className="flex-1 h-9 text-sm"
            >
              <Phone className="h-3 w-3 mr-1" />
              Contact
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}