import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export type RiskLevel = 'low' | 'medium' | 'high';
export type TrendDirection = 'improving' | 'stable' | 'worsening';
export type Priority = 'high' | 'medium' | 'low';

export interface ViolationTrend {
  type: string;
  count: number;
  percentage: number;
  insight: string;
}

export interface ConvertingCase {
  type: string;
  conversion_rate: number;
  avg_revenue: number;
  insight: string;
}

export interface SeasonalPatterns {
  peak_month: string;
  peak_day: string;
  peak_time: string;
  insight: string;
}

export interface GeographicInsights {
  top_states: string[];
  underserved_markets: string[];
  expansion_opportunities: string;
}

export interface TrendsSummary {
  most_common_violations: ViolationTrend[];
  highest_converting_cases: ConvertingCase[];
  seasonal_patterns: SeasonalPatterns;
  geographic_insights: GeographicInsights;
}

export interface ConversionAnalysis {
  overall_rate: number;
  best_performing_segment: string;
  worst_performing_segment: string;
  improvement_opportunities: string[];
}

export interface FeatureSuggestion {
  feature: string;
  rationale: string;
  priority: Priority;
  expected_impact: string;
}

export interface ProductResearchInsights {
  customer_pain_points: string[];
  unmet_needs: string[];
  content_opportunities: string[];
  partnership_opportunities: string[];
}

export interface RiskCategory {
  name: string;
  case_count: number;
  conversion_rate: number;
  revenue: number;
  risk_level: RiskLevel;
  trend_direction: TrendDirection;
  top_states: string[];
  strategic_notes: string;
  common_defenses: string[];
}

export interface RiskAssessment {
  categories: RiskCategory[];
  highest_risk_category: string;
  fastest_growing_category: string;
  most_profitable_category: string;
}

export interface StrategicRecommendation {
  recommendation: string;
  category: 'marketing' | 'product' | 'content' | 'operations';
  priority: Priority;
  expected_outcome: string;
}

export interface FullAnalysis {
  trends_summary: TrendsSummary;
  conversion_analysis: ConversionAnalysis;
  feature_suggestions: FeatureSuggestion[];
  product_research_insights: ProductResearchInsights;
  risk_assessment: RiskAssessment;
  strategic_recommendations: StrategicRecommendation[];
  executive_summary: string;
}

export interface RawData {
  violationTypes: Record<string, any>;
  seasonalTrends: {
    byMonth: Record<string, number>;
    byDayOfWeek: Record<string, number>;
    peakMonth: string;
    peakDay: string;
  };
  conversionFunnel: {
    totalCases: number;
    unlockedCases: number;
    completedCases: number;
    overallConversionRate: string;
  };
  geography: {
    topStates: Array<{ state: string; total: number; revenue: number }>;
  };
  documentStats: {
    total: number;
    avgDocsPerCase: string;
  };
  messageStats: {
    total: number;
    avgMsgsPerCase: string;
  };
}

export interface LegalityScorecard {
  id: string;
  analysis_date: string;
  period_start: string;
  period_end: string;
  categories: RiskCategory[];
  summary: any;
  full_analysis: string;
  cases_analyzed: number;
  news_articles_referenced: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface ScorecardResponse {
  scorecard: LegalityScorecard | null;
  analysis?: FullAnalysis;
  rawData?: RawData;
  fromCache?: boolean;
  ageHours?: number;
  generated?: boolean;
  message?: string;
  history?: Array<{
    id: string;
    analysis_date: string;
    summary: any;
    cases_analyzed: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class LegalityScorecardService {
  private readonly apiUrl = '/api/dashboard/legality-scorecard';

  constructor(private http: HttpClient) {}

  getScorecard(forceRefresh = false, includeHistory = false): Observable<ScorecardResponse> {
    const params = new URLSearchParams();

    if (forceRefresh) {
      params.append('refresh', 'true');
    }
    if (includeHistory) {
      params.append('history', 'true');
    }

    const url = params.toString() ? `${this.apiUrl}?${params.toString()}` : this.apiUrl;

    return this.http.get<ScorecardResponse>(url).pipe(
      catchError(error => {
        console.error('Legality scorecard service error:', error);
        return of({
          scorecard: null,
          message: error.message || 'Failed to fetch legality scorecard'
        });
      })
    );
  }

  generateScorecard(): Observable<ScorecardResponse> {
    return this.http.post<ScorecardResponse>(this.apiUrl, {}).pipe(
      catchError(error => {
        console.error('Error generating scorecard:', error);
        return of({
          scorecard: null,
          message: error.message || 'Failed to generate scorecard'
        });
      })
    );
  }

  getRiskLevelColor(level: RiskLevel): string {
    switch (level) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  }

  getRiskLevelBgColor(level: RiskLevel): string {
    switch (level) {
      case 'low': return 'bg-green-500/20';
      case 'medium': return 'bg-amber-500/20';
      case 'high': return 'bg-red-500/20';
      default: return 'bg-slate-500/20';
    }
  }

  getTrendIcon(direction: TrendDirection): string {
    switch (direction) {
      case 'improving': return '↗';
      case 'stable': return '→';
      case 'worsening': return '↘';
      default: return '→';
    }
  }

  getTrendColor(direction: TrendDirection): string {
    switch (direction) {
      case 'improving': return 'text-green-400';
      case 'stable': return 'text-slate-400';
      case 'worsening': return 'text-red-400';
      default: return 'text-slate-400';
    }
  }

  getPriorityColor(priority: Priority): string {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-amber-400';
      case 'low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  }

  getPriorityBgColor(priority: Priority): string {
    switch (priority) {
      case 'high': return 'bg-red-500/20';
      case 'medium': return 'bg-amber-500/20';
      case 'low': return 'bg-green-500/20';
      default: return 'bg-slate-500/20';
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'marketing': return '📣';
      case 'product': return '🛠️';
      case 'content': return '📝';
      case 'operations': return '⚙️';
      default: return '💡';
    }
  }
}
