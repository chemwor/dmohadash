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

  // --- Enriched Data Getters ---

  // Business Snapshot
  getRevenueMonth(): number {
    return this.rawData?.businessSnapshot?.revenueMonth || 0;
  }

  getRevenueWeek(): number {
    return this.rawData?.businessSnapshot?.revenueWeek || 0;
  }

  getAdCPA(): number {
    return this.rawData?.businessSnapshot?.adCPA || 0;
  }

  getAdCTR(): number {
    return this.rawData?.businessSnapshot?.adCTR || 0;
  }

  hasBusinessSnapshot(): boolean {
    return !!(this.rawData?.businessSnapshot && this.rawData.businessSnapshot.revenueMonth > 0);
  }

  // PostHog
  getBounceRate(): number {
    return this.rawData?.posthogMetrics?.bounceRate || 0;
  }

  getAvgTimeOnPage(): number {
    return this.rawData?.posthogMetrics?.avgTimeOnPage || 0;
  }

  getRageClicks(): number {
    return this.rawData?.posthogMetrics?.rageClicks || 0;
  }

  hasPosthogData(): boolean {
    return !!(this.rawData?.posthogMetrics && (this.rawData.posthogMetrics.bounceRate > 0 || this.rawData.posthogMetrics.avgTimeOnPage > 0));
  }

  // Preview Insights
  getPreviewHeadlines(): string[] {
    return this.rawData?.previewInsights?.sampleHeadlines || [];
  }

  getCommonRisks(): string[] {
    return this.rawData?.previewInsights?.commonRisks || [];
  }

  hasPreviewInsights(): boolean {
    return !!(this.rawData?.previewInsights && this.rawData.previewInsights.totalPreviews > 0);
  }

  // News Context
  getNewsArticleCount(): number {
    return this.rawData?.newsContext?.articleCount || 0;
  }

  getRecentNewsTitles(): string[] {
    return this.rawData?.newsContext?.recentTitles || [];
  }

  hasNewsContext(): boolean {
    return !!(this.rawData?.newsContext && this.rawData.newsContext.articleCount > 0);
  }

  // AI Analysis: Engagement Health
  getEngagementHealth(): any {
    return this.analysis?.engagement_health || null;
  }

  getEngagementGrade(): string {
    return this.analysis?.engagement_health?.overall_grade || 'N/A';
  }

  getUXIssues(): string[] {
    return this.analysis?.engagement_health?.ux_issues || [];
  }

  // AI Analysis: Funnel & Ads
  getFunnelHealth(): any {
    return this.analysis?.conversion_analysis?.funnel_health || null;
  }

  getAdEfficiency(): any {
    return this.analysis?.conversion_analysis?.ad_efficiency || null;
  }

  // AI Analysis: News
  getNewsAnalysis(): any {
    return this.analysis?.news_context || null;
  }

  getNewsTrends(): string[] {
    return this.analysis?.news_context?.relevant_trends || [];
  }

  getNewsOpportunities(): string[] {
    return this.analysis?.news_context?.opportunities || [];
  }

  // AI Analysis: Preview Themes
  getPreviewThemes(): any {
    return this.analysis?.trends_summary?.preview_themes || null;
  }

  // AI Analysis: Case Themes
  getCaseThemeAnalysis(): any {
    return this.analysis?.product_research_insights?.case_theme_analysis || null;
  }

  // Recommendation data basis
  getDataBasis(rec: StrategicRecommendation): string {
    return (rec as any).data_basis || '';
  }

  // Grade color utility
  getGradeColor(grade: string): string {
    const g = (grade || '').toLowerCase();
    if (['a', 'excellent', 'good'].some(v => g.includes(v))) return 'text-green-400';
    if (['b', 'fair', 'average', 'moderate'].some(v => g.includes(v))) return 'text-amber-400';
    return 'text-red-400';
  }
}
