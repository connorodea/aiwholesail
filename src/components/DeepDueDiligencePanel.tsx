import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Camera, 
  Phone, 
  MapPin, 
  Calendar, 
  User, 
  Building, 
  DollarSign, 
  Download,
  ExternalLink 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ZillowAPI } from '@/lib/zillow-api';
import { useToast } from '@/hooks/use-toast';

interface DeepDueDiligencePanelProps {
  property: Property;
}

interface DueDiligenceData {
  ownerInfo: any;
  propertyHistory: any[];
  photos: string[];
  reviews: any[];
  contactInfo: any;
  legalInfo: any;
  investmentAnalysis: {
    cashFlow: number;
    totalReturn: number;
    breakEven: number;
    riskScore: number;
  };
}

export function DeepDueDiligencePanel({ property }: DeepDueDiligencePanelProps) {
  const [dueDiligenceData, setDueDiligenceData] = useState<DueDiligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const zillowAPI = new ZillowAPI();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const fetchDueDiligenceData = async () => {
    const zpid = property.zpid || property.id;
    console.log('DeepDueDiligencePanel: Fetching data for zpid:', zpid, 'property:', property);
    
    if (!zpid) {
      console.warn('DeepDueDiligencePanel: No ZPID found for property');
      return;
    }
    
    setLoading(true);
    try {
      const [historyData, photosData] = await Promise.allSettled([
        zillowAPI.getPriceHistory(zpid),
        zillowAPI.getPropertyPhotos(zpid)
      ]);

      const history = historyData.status === 'fulfilled' ? historyData.value || [] : [];
      const photos = photosData.status === 'fulfilled' ? photosData.value || [] : [];
      const contact = null; // Contact agent feature not available yet

      // Calculate investment analysis
      const monthlyRent = property.property_estimates_rentZestimate || 0;
      const monthlyExpenses = monthlyRent * 0.5; // 50% expense ratio
      const monthlyMortgage = property.price ? (property.price * 0.8 * 0.005) : 0; // Estimate with 20% down, 6% rate
      const cashFlow = monthlyRent - monthlyExpenses - monthlyMortgage;
      
      const downPayment = property.price ? property.price * 0.2 : 0;
      const totalReturn = cashFlow > 0 ? (cashFlow * 12 / downPayment) * 100 : 0;
      const breakEven = monthlyRent > 0 ? (monthlyExpenses + monthlyMortgage) / monthlyRent : 0;
      
      // Calculate risk score (0-100, higher = riskier)
      let riskScore = 0;
      if (property.daysOnMarket && property.daysOnMarket > 90) riskScore += 20;
      if (property.price && property.zestimate && property.price > property.zestimate * 1.1) riskScore += 30;
      if (property.yearBuilt && property.yearBuilt < 1970) riskScore += 15;
      if (monthlyRent === 0) riskScore += 25;
      if (property.property_isPreforeclosureAuction) riskScore += 35;

      setDueDiligenceData({
        ownerInfo: null, // Skip trace service unavailable
        propertyHistory: history,
        photos: photos,
        reviews: [], // Would need separate endpoint
        contactInfo: contact,
        legalInfo: null, // Would need separate legal data
        investmentAnalysis: {
          cashFlow,
          totalReturn,
          breakEven,
          riskScore: Math.min(riskScore, 100)
        }
      });

    } catch (error) {
      console.error('Error fetching due diligence data:', error);
      toast({
        title: "Error",
        description: "Could not load due diligence data",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const exportDueDiligenceReport = () => {
    if (!dueDiligenceData) return;
    
    const csvContent = [
      ['Deep Due Diligence Report'],
      ['Property Address', property.address || 'N/A'],
      ['Report Date', new Date().toLocaleDateString()],
      [''],
      ['Investment Analysis'],
      ['Monthly Cash Flow', formatPrice(dueDiligenceData.investmentAnalysis.cashFlow)],
      ['Total Return on Investment', `${dueDiligenceData.investmentAnalysis.totalReturn.toFixed(1)}%`],
      ['Break-Even Ratio', `${(dueDiligenceData.investmentAnalysis.breakEven * 100).toFixed(1)}%`],
      ['Risk Score', `${dueDiligenceData.investmentAnalysis.riskScore}/100`],
      [''],
      ['Property History'],
      ...dueDiligenceData.propertyHistory.slice(0, 10).map((event: any) => [
        new Date(event.date).toLocaleDateString(),
        event.event || 'Price Change',
        formatPrice(event.price || 0)
      ]),
      [''],
      ['Owner Information'],
      dueDiligenceData.ownerInfo ? [
        'Owner Name', dueDiligenceData.ownerInfo.name || 'N/A',
        'Contact Info', dueDiligenceData.ownerInfo.phone || 'N/A'
      ] : ['No owner information available'],
      [''],
      ['Property Details'],
      ['Year Built', property.yearBuilt?.toString() || 'N/A'],
      ['Square Feet', property.sqft?.toString() || 'N/A'],
      ['Lot Size', property.lotSize?.toString() || 'N/A'],
      ['Bedrooms', property.bedrooms?.toString() || 'N/A'],
      ['Bathrooms', property.bathrooms?.toString() || 'N/A']
    ];
    
    const csv = csvContent.map(row => Array.isArray(row) ? row.join(',') : [row, ''].join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `due-diligence-${property.address?.replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-destructive';
    if (score >= 40) return 'text-warning';
    return 'text-success';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return 'High Risk';
    if (score >= 40) return 'Moderate Risk';
    return 'Low Risk';
  };

  useEffect(() => {
    fetchDueDiligenceData();
  }, [property.zpid, property.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Deep Due Diligence Panel
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={fetchDueDiligenceData} 
              variant="outline" 
              size="sm" 
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            {dueDiligenceData && (
              <Button 
                onClick={exportDueDiligenceReport} 
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading due diligence data...</div>
          </div>
        ) : dueDiligenceData ? (
          <Tabs defaultValue="investment" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="investment">Investment</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="owner">Owner Info</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="investment" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <div className="text-sm text-muted-foreground">Monthly Cash Flow</div>
                  <div className={`text-2xl font-bold ${dueDiligenceData.investmentAnalysis.cashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPrice(dueDiligenceData.investmentAnalysis.cashFlow)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dueDiligenceData.investmentAnalysis.cashFlow >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-sm text-muted-foreground">Total ROI</div>
                  <div className="text-2xl font-bold text-primary">
                    {dueDiligenceData.investmentAnalysis.totalReturn.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Annual return on investment</div>
                </div>

                <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="text-sm text-muted-foreground">Break-Even Point</div>
                  <div className="text-2xl font-bold text-accent">
                    {(dueDiligenceData.investmentAnalysis.breakEven * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Of market rent needed</div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Risk Assessment</div>
                  <div className={`text-2xl font-bold ${getRiskColor(dueDiligenceData.investmentAnalysis.riskScore)}`}>
                    {dueDiligenceData.investmentAnalysis.riskScore}/100
                  </div>
                  <Badge className={getRiskColor(dueDiligenceData.investmentAnalysis.riskScore)}>
                    {getRiskLevel(dueDiligenceData.investmentAnalysis.riskScore)}
                  </Badge>
                </div>
              </div>

              {/* Investment Recommendations */}
              <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2">Investment Recommendation</h4>
                <div className="space-y-2">
                  {dueDiligenceData.investmentAnalysis.cashFlow >= 200 && (
                    <div className="text-sm text-success">✅ Strong positive cash flow - excellent rental property</div>
                  )}
                  {dueDiligenceData.investmentAnalysis.totalReturn >= 12 && (
                    <div className="text-sm text-success">✅ High ROI potential - great investment opportunity</div>
                  )}
                  {dueDiligenceData.investmentAnalysis.riskScore <= 30 && (
                    <div className="text-sm text-success">✅ Low risk profile - safe investment</div>
                  )}
                  {dueDiligenceData.investmentAnalysis.riskScore >= 70 && (
                    <div className="text-sm text-destructive">⚠️ High risk - proceed with caution</div>
                  )}
                  {dueDiligenceData.investmentAnalysis.cashFlow < 0 && (
                    <div className="text-sm text-warning">⚠️ Negative cash flow - consider renovation or price negotiation</div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Property History Timeline
                </h4>
                {dueDiligenceData.propertyHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dueDiligenceData.propertyHistory.map((event: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <div>
                          <div className="font-medium">{event.event || 'Price Change'}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatPrice(event.price || 0)}</div>
                          {index < dueDiligenceData.propertyHistory.length - 1 && (
                            <div className={`text-sm ${event.price < dueDiligenceData.propertyHistory[index + 1].price ? 'text-destructive' : 'text-success'}`}>
                              {event.price < dueDiligenceData.propertyHistory[index + 1].price ? '↓' : '↑'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No price history available
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="owner" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Owner Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Skip Trace Service Unavailable</p>
                    <p className="text-sm mb-4">
                      Owner contact information retrieval is temporarily unavailable due to API limitations.
                    </p>
                    <div className="p-4 bg-muted/30 rounded-lg text-left">
                      <p className="text-sm font-medium mb-2">Alternative Methods:</p>
                      <ul className="text-sm space-y-1">
                        <li>• Check public property records at county recorder's office</li>
                        <li>• Contact the listing agent directly (see Contact tab)</li>
                        <li>• Use professional skip trace services like BeenVerified</li>
                        <li>• Search social media platforms</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Property Photos
                </h4>
                {dueDiligenceData.photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                    {dueDiligenceData.photos.map((photo, index) => (
                      <img 
                        key={index} 
                        src={photo} 
                        alt={`Property photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                        onClick={() => window.open(photo, '_blank')}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No photos available
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Agent Information */}
                  {property.property_propertyDisplayRules_agent_agentName && (
                    <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                      <div className="font-semibold mb-2">Listing Agent</div>
                      <div className="space-y-1">
                        <div className="font-medium">{property.property_propertyDisplayRules_agent_agentName}</div>
                        {(property.property_listing_agentPhone || property.agent_phone) && (
                          <div className="text-sm text-muted-foreground">
                            📞 {property.property_listing_agentPhone || property.agent_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Brokerage Information */}
                  {property.property_propertyDisplayRules_mls_brokerName && (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="font-semibold mb-2">Brokerage</div>
                      <div className="space-y-1">
                        <div className="font-medium">{property.property_propertyDisplayRules_mls_brokerName}</div>
                        {property.property_brokerage_phone && (
                          <div className="text-sm text-muted-foreground">
                            📞 {property.property_brokerage_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <h5 className="font-medium">Quick Contact Actions</h5>
                  <div className="flex flex-wrap gap-2">
                    {property.zillowUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={property.zillowUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View on Zillow
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Phone className="h-4 w-4 mr-1" />
                      Schedule Showing
                    </Button>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-1" />
                      Request Disclosures
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Click "Refresh" to load due diligence data
          </div>
        )}
      </CardContent>
    </Card>
  );
}