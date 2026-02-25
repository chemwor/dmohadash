import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import {
  LegalityScorecardService,
  LegalityScorecard,
  RiskCategory,
  ScorecardResponse,
  RiskLevel,
  TrendDirection,
  Priority,
  FullAnalysis,
  RawData,
  FeatureSuggestion,
  StrategicRecommendation
} from '../../../core/services/legality-scorecard.service';

@Component({
  selector: 'app-legality-scorecard',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './legality-scorecard.component.html'
})
export class LegalityScorecardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  scorecard: LegalityScorecard | null = null;
  analysis: FullAnalysis | null = null;
  rawData: RawData | null = null;
  isLoading = false;
  isGenerating = false;
  error = '';
  fromCache = false;
  cacheAgeHours = 0;

  selectedCategory: RiskCategory | null = null;
  activeTab: 'overview' | 'trends' | 'insights' | 'recommendations' = 'overview';

  constructor(private scorecardService: LegalityScorecardService) {}

  ngOnInit(): void {
    this.loadScorecard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadScorecard(forceRefresh = false): void {
    this.isLoading = true;
    this.error = '';

    this.scorecardService.getScorecard(forceRefresh, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.scorecard = response.scorecard;
          this.analysis = response.analysis || null;
          this.rawData = response.rawData || null;
          this.fromCache = response.fromCache || false;
          this.cacheAgeHours = response.ageHours || 0;
          this.isLoading = false;

          if (response.message && !response.scorecard) {
            this.error = response.message;
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.error = err.message || 'Failed to load scorecard';
        }
      });
  }

  generateNewScorecard(): void {
    this.isGenerating = true;
    this.error = '';

    this.scorecardService.generateScorecard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.scorecard = response.scorecard;
          this.analysis = response.analysis || null;
          this.rawData = response.rawData || null;
          this.fromCache = false;
          this.isGenerating = false;

          if (response.message && !response.scorecard) {
            this.error = response.message;
          }
        },
        error: (err) => {
          this.isGenerating = false;
          this.error = err.message || 'Failed to generate scorecard';
        }
      });
  }

  setActiveTab(tab: 'overview' | 'trends' | 'insights' | 'recommendations'): void {
    this.activeTab = tab;
  }

  selectCategory(category: RiskCategory): void {
    this.selectedCategory = this.selectedCategory?.name === category.name ? null : category;
  }

  getRiskLevelColor(level: RiskLevel): string {
    return this.scorecardService.getRiskLevelColor(level);
  }

  getRiskLevelBgColor(level: RiskLevel): string {
    return this.scorecardService.getRiskLevelBgColor(level);
  }

  getTrendIcon(direction: TrendDirection): string {
    return this.scorecardService.getTrendIcon(direction);
  }

  getTrendColor(direction: TrendDirection): string {
    return this.scorecardService.getTrendColor(direction);
  }

  getRiskLevelLabel(level: RiskLevel): string {
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  getPriorityColor(priority: Priority): string {
    return this.scorecardService.getPriorityColor(priority);
  }

  getPriorityBgColor(priority: Priority): string {
    return this.scorecardService.getPriorityBgColor(priority);
  }

  getCategoryIcon(category: string): string {
    return this.scorecardService.getCategoryIcon(category);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDateRange(): string {
    if (!this.scorecard) return '';
    const start = new Date(this.scorecard.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(this.scorecard.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  }

  getTrendChange(category: RiskCategory): number {
    const prev = (category as any).trend_count_previous || 0;
    if (prev === 0) return 0;
    return Math.round(((category.case_count - prev) / prev) * 100);
  }

  getHighRiskCategories(): RiskCategory[] {
    return this.scorecard?.categories?.filter(c => c.risk_level === 'high') || [];
  }

  getImprovingCategories(): RiskCategory[] {
    return this.scorecard?.categories?.filter(c => c.trend_direction === 'improving') || [];
  }

  getWorseningCategories(): RiskCategory[] {
    return this.scorecard?.categories?.filter(c => c.trend_direction === 'worsening') || [];
  }

  getSortedCategories(): RiskCategory[] {
    if (!this.scorecard?.categories) return [];
    return [...this.scorecard.categories].sort((a, b) => b.case_count - a.case_count);
  }

  // Analysis helpers
  getFeatureSuggestions(): FeatureSuggestion[] {
    return this.analysis?.feature_suggestions || [];
  }

  getStrategicRecommendations(): StrategicRecommendation[] {
    return this.analysis?.strategic_recommendations || [];
  }

  getRecommendationsByCategory(category: string): StrategicRecommendation[] {
    return this.getStrategicRecommendations().filter(r => r.category === category);
  }

  getConversionRate(): number {
    return this.analysis?.conversion_analysis?.overall_rate || 0;
  }

  getTopViolations(): { type: string; count: number; percentage: number }[] {
    return this.analysis?.trends_summary?.most_common_violations?.slice(0, 5) || [];
  }

  getSeasonalInsight(): string {
    const patterns = this.analysis?.trends_summary?.seasonal_patterns;
    if (!patterns) return 'No seasonal data available';
    return patterns.insight || `Peak activity: ${patterns.peak_month}, ${patterns.peak_day}s at ${patterns.peak_time}`;
  }

  getGeographicInsight(): string {
    const geo = this.analysis?.trends_summary?.geographic_insights;
    if (!geo) return 'No geographic data available';
    return geo.expansion_opportunities || `Top states: ${geo.top_states?.join(', ')}`;
  }
}
