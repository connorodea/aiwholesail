import { Property, AIAnalysis, MarketAnalysis } from '@/types/zillow';

export class AIAnalyzer {
  analyzeProperties(properties: Property[]): AIAnalysis {
    if (properties.length === 0) {
      return {
        summary: {
          total_properties: 0,
          unique_locations: 0,
          data_quality_score: 0
        },
        insights: ['No properties found to analyze'],
        recommendations: ['Expand search criteria to find more properties'],
        market_analysis: {},
        outliers: [],
        trends: {}
      };
    }

    const analysis: AIAnalysis = {
      summary: this.generateSummary(properties),
      insights: this.generateInsights(properties),
      recommendations: this.generateRecommendations(properties),
      market_analysis: this.analyzeMarket(properties),
      outliers: this.detectOutliers(properties),
      trends: this.analyzeTrends(properties)
    };

    return analysis;
  }

  private generateSummary(properties: Property[]) {
    const uniqueAddresses = new Set(properties.map(p => p.address)).size;
    const dataQuality = this.calculateDataQuality(properties);

    return {
      total_properties: properties.length,
      unique_locations: uniqueAddresses,
      data_quality_score: dataQuality
    };
  }

  private calculateDataQuality(properties: Property[]): number {
    if (properties.length === 0) return 0;

    const totalFields = ['price', 'bedrooms', 'bathrooms', 'sqft', 'propertyType'];
    let completenessScore = 0;

    properties.forEach(property => {
      let fieldCount = 0;
      totalFields.forEach(field => {
        if (property[field as keyof Property] !== undefined && property[field as keyof Property] !== null) {
          fieldCount++;
        }
      });
      completenessScore += (fieldCount / totalFields.length) * 100;
    });

    return Math.round(completenessScore / properties.length);
  }

  private generateInsights(properties: Property[]): string[] {
    const insights: string[] = [];
    
    // Price insights
    const prices = properties.filter(p => p.price).map(p => p.price!);
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const medianPrice = this.median(prices);
      
      if (avgPrice > medianPrice * 1.2) {
        insights.push(`📊 Market shows premium properties (avg $${this.formatNumber(avgPrice)} > median $${this.formatNumber(medianPrice)})`);
      } else if (Math.abs(avgPrice - medianPrice) / medianPrice < 0.1) {
        insights.push(`📊 Balanced market pricing (avg ≈ median: $${this.formatNumber(medianPrice)})`);
      }
    }

    // Property type distribution
    const propertyTypes = properties.filter(p => p.propertyType).map(p => p.propertyType!);
    if (propertyTypes.length > 0) {
      const typeCount = this.countOccurrences(propertyTypes);
      const mostCommon = Object.entries(typeCount).sort(([,a], [,b]) => b - a)[0];
      insights.push(`🏠 Most common property type: ${mostCommon[0]} (${mostCommon[1]} properties)`);
    }

    // Days on market insights
    const daysOnMarket = properties.filter(p => p.daysOnMarket).map(p => p.daysOnMarket!);
    if (daysOnMarket.length > 0) {
      const avgDOM = daysOnMarket.reduce((a, b) => a + b, 0) / daysOnMarket.length;
      if (avgDOM < 30) {
        insights.push(`⚡ Fast-moving market (avg ${Math.round(avgDOM)} days on market)`);
      } else if (avgDOM > 90) {
        insights.push(`🐌 Slow market conditions (avg ${Math.round(avgDOM)} days on market)`);
      }
    }

    // Price per sqft insights
    const pricePerSqft = properties.filter(p => p.pricePerSqft).map(p => p.pricePerSqft!);
    if (pricePerSqft.length > 0) {
      const avgPriceSqft = pricePerSqft.reduce((a, b) => a + b, 0) / pricePerSqft.length;
      insights.push(`📏 Average price per sqft: $${Math.round(avgPriceSqft)}`);
    }

    return insights;
  }

  private generateRecommendations(properties: Property[]): string[] {
    const recommendations: string[] = [];

    // Price-based recommendations
    const prices = properties.filter(p => p.price).map(p => p.price!);
    if (prices.length > 0) {
      const medianPrice = this.median(prices);
      const belowMedianCount = prices.filter(p => p < medianPrice).length;
      
      if (belowMedianCount > 0) {
        recommendations.push(`💡 ${belowMedianCount} properties below median price - potential value opportunities`);
      }
    }

    // Days on market recommendations
    const daysOnMarket = properties.filter(p => p.daysOnMarket).map(p => p.daysOnMarket!);
    if (daysOnMarket.length > 0) {
      const longOnMarket = properties.filter(p => p.daysOnMarket && p.daysOnMarket > 60);
      if (longOnMarket.length > 0) {
        recommendations.push(`🎯 ${longOnMarket.length} properties on market >60 days - potential negotiation opportunities`);
      }
    }

    // Property type recommendations
    const propertyTypes = properties.filter(p => p.propertyType).map(p => p.propertyType!);
    if (propertyTypes.length > 0) {
      const typeCount = this.countOccurrences(propertyTypes);
      const diversity = Object.keys(typeCount).length;
      if (diversity > 3) {
        recommendations.push(`🏘️ Diverse property types available - consider specializing in one type`);
      }
    }

    // General wholesaling recommendations
    recommendations.push(`📊 Focus on properties with high spread between ask price and market value`);
    recommendations.push(`📈 Monitor properties with recent price reductions`);
    recommendations.push(`🔍 Cross-reference with local rental rates for investment potential`);

    return recommendations;
  }

  private analyzeMarket(properties: Property[]): Record<string, MarketAnalysis> {
    const analysis: Record<string, MarketAnalysis> = {};

    // Analyze price
    const prices = properties.filter(p => p.price).map(p => p.price!);
    if (prices.length > 0) {
      analysis.price = this.calculateStats(prices);
    }

    // Analyze price per sqft
    const pricePerSqft = properties.filter(p => p.pricePerSqft).map(p => p.pricePerSqft!);
    if (pricePerSqft.length > 0) {
      analysis.pricePerSqft = this.calculateStats(pricePerSqft);
    }

    // Analyze sqft
    const sqft = properties.filter(p => p.sqft).map(p => p.sqft!);
    if (sqft.length > 0) {
      analysis.sqft = this.calculateStats(sqft);
    }

    return analysis;
  }

  private calculateStats(values: number[]): MarketAnalysis {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    return {
      mean: Math.round(mean),
      median: this.median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      q25: this.percentile(sorted, 0.25),
      q75: this.percentile(sorted, 0.75),
      std: Math.round(std)
    };
  }

  private detectOutliers(properties: Property[]): Array<{column: string; count: number; percentage: number; description: string}> {
    const outliers: Array<{column: string; count: number; percentage: number; description: string}> = [];

    // Price outliers
    const prices = properties.filter(p => p.price).map(p => p.price!);
    if (prices.length > 10) {
      const priceOutliers = this.findOutliers(prices);
      if (priceOutliers.outlierCount > 0) {
        outliers.push({
          column: 'price',
          count: priceOutliers.outlierCount,
          percentage: Math.round((priceOutliers.outlierCount / prices.length) * 100),
          description: `Values outside $${this.formatNumber(priceOutliers.lowerBound)} - $${this.formatNumber(priceOutliers.upperBound)}`
        });
      }
    }

    // Sqft outliers
    const sqft = properties.filter(p => p.sqft).map(p => p.sqft!);
    if (sqft.length > 10) {
      const sqftOutliers = this.findOutliers(sqft);
      if (sqftOutliers.outlierCount > 0) {
        outliers.push({
          column: 'sqft',
          count: sqftOutliers.outlierCount,
          percentage: Math.round((sqftOutliers.outlierCount / sqft.length) * 100),
          description: `Values outside ${Math.round(sqftOutliers.lowerBound)} - ${Math.round(sqftOutliers.upperBound)} sqft`
        });
      }
    }

    return outliers.slice(0, 5); // Return top 5
  }

  private findOutliers(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 0.25);
    const q3 = this.percentile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outlierCount = values.filter(v => v < lowerBound || v > upperBound).length;
    
    return { outlierCount, lowerBound, upperBound };
  }

  private analyzeTrends(properties: Property[]): Record<string, any> {
    const trends: Record<string, any> = {};

    // Property type distribution
    const propertyTypes = properties.filter(p => p.propertyType).map(p => p.propertyType!);
    if (propertyTypes.length > 0) {
      trends.propertyTypes = this.countOccurrences(propertyTypes);
    }

    // Bedroom distribution
    const bedrooms = properties.filter(p => p.bedrooms).map(p => p.bedrooms!);
    if (bedrooms.length > 0) {
      trends.bedrooms = this.countOccurrences(bedrooms.map(b => b.toString()));
    }

    // Year built trends
    const yearBuilt = properties.filter(p => p.yearBuilt && p.yearBuilt > 1800).map(p => p.yearBuilt!);
    if (yearBuilt.length > 0) {
      const decades = yearBuilt.map(year => `${Math.floor(year / 10) * 10}s`);
      trends.decades = this.countOccurrences(decades);
    }

    return trends;
  }

  // Utility functions
  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  private percentile(sortedValues: number[], percentile: number): number {
    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private countOccurrences<T>(items: T[]): Record<string, number> {
    return items.reduce((acc: Record<string, number>, item) => {
      const key = String(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  private formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  }
}

export const aiAnalyzer = new AIAnalyzer();