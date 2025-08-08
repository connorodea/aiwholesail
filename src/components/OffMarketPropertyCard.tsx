import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, Star, TrendingUp, Calculator, Eye, Target, Home } from 'lucide-react';
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
      case 'collected': return 'bg-muted text-muted-foreground';
      case 'filtered': return 'bg-info/20 text-info border border-info/30';
      case 'validated': return 'bg-warning/20 text-warning border border-warning/30';
      case 'ai_analyzed': return 'bg-success/20 text-success border border-success/30';
      default: return 'bg-muted text-muted-foreground';
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
    if (property.taxDelinquent) indicators.push({ label: 'Tax Delinquent', icon: '⚠️' });
    if (property.foreclosureNotice) indicators.push({ label: 'Foreclosure', icon: '🏠' });
    if (property.codeViolations) indicators.push({ label: 'Code Violations', icon: '🚫' });
    if (property.buildingPermitsRecent) indicators.push({ label: 'Recent Permits', icon: '🔧' });
    if (!property.ownerOccupied) indicators.push({ label: 'Non-Owner Occupied', icon: '🏢' });
    return indicators;
  };

  const distressIndicators = getDistressIndicators();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <Card className="group simple-card smooth-transition hover:shadow-elegant">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors leading-tight break-words">
              {property.address}
            </h3>
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin className="h-4 w-4 mr-1.5 text-primary/70 flex-shrink-0" />
              <span className="truncate">{property.city}, {property.state}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className={`${getStageColor(property.stage)} rounded-full px-2 sm:px-3 py-1 text-xs font-medium flex-shrink-0`}>
              {getStageLabel(property.stage)}
            </Badge>
            {property.aiPriorityRank && (
              <Badge className="bg-primary text-primary-foreground rounded-full px-2 sm:px-3 py-1 text-xs font-medium flex-shrink-0">
                <Star className="h-3 w-3 mr-1" />
                #{property.aiPriorityRank}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6">
        {/* Estimated Value */}
        <div className="text-2xl sm:text-3xl font-bold gradient-text">
          {formatPrice(property.estimatedValue)}
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-muted/30 rounded-lg">
            <Home className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate">{property.propertyType}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-muted/30 rounded-lg">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate">Score: {property.freeDataScore}</span>
          </div>
        </div>

        {/* Distress Indicators */}
        {distressIndicators.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Distress Indicators:</h4>
            <div className="flex flex-wrap gap-2">
              {distressIndicators.map((indicator, index) => (
                <Badge key={index} variant="destructive" className="text-xs rounded-full px-2 py-1">
                  {indicator.icon} {indicator.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {property.stage === 'ai_analyzed' && (
          <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">AI Analysis</span>
            </div>
            <div className="space-y-2 text-sm">
              <div><strong>Strategy:</strong> {property.aiContactStrategy}</div>
              <div><strong>Offer Range:</strong> {property.aiOfferRange}</div>
              {property.aiTalkingPoints && (
                <div>
                  <strong>Key Points:</strong>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {property.aiTalkingPoints.map((point, index) => (
                      <li key={index} className="text-xs">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Information */}
        {(property.phones || property.emails || property.ownerName) && (
          <div className="p-3 bg-muted/20 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Contact Information</span>
            </div>
            <div className="space-y-1 text-sm">
              {property.ownerName && (
                <div><strong>Owner:</strong> {property.ownerName}</div>
              )}
              {property.phones?.map((phone, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs">{phone}</span>
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

        {/* Processing Cost & Date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Calculator className="h-3 w-3" />
            Cost: ${property.processingCost.toFixed(3)}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {property.createdAt.toLocaleDateString()}
          </span>
        </div>
      </CardContent>

      <div className="p-4 sm:p-6 pt-0">
        <div className="flex gap-2 w-full">
          <Button 
            onClick={onViewDetails}
            variant="default"
            size="sm"
            className="flex-1 text-xs sm:text-sm"
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">View </span>Details
          </Button>
          
          {onContact && (property.phones || property.emails) && (
            <Button 
              onClick={onContact}
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs sm:text-sm"
            >
              <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Contact
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}