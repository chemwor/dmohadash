import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';

import { KlaviyoService, KlaviyoData } from '../../../core/services/klaviyo.service';
import { GoogleAdsService, GoogleAdsData, GoogleAdsPeriod, Campaign } from '../../../core/services/google-ads.service';
import { AdSuggestionsService, AdSuggestionsData } from '../../../core/services/ad-suggestions.service';

@Component({
  selector: 'app-marketing',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSkeletonComponent],
  templateUrl: './marketing.component.html'
})
export class MarketingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  klaviyoData: KlaviyoData | null = null;
  googleAdsData: GoogleAdsData | null = null;
  suggestionsData: AdSuggestionsData | null = null;

  selectedPeriod: GoogleAdsPeriod = 'week';
  periods = [
    { value: 'today' as GoogleAdsPeriod, label: 'Today' },
    { value: 'week' as GoogleAdsPeriod, label: 'This Week' },
    { value: 'month' as GoogleAdsPeriod, label: 'This Month' }
  ];

  // Date range for AI analysis
  analysisStartDate: string = '';
  analysisEndDate: string = '';

  loadingStates = {
    klaviyo: false,
    googleAds: false,
    suggestions: false
  };

  errors = {
    klaviyo: '',
    googleAds: '',
    suggestions: ''
  };

  lastRefreshed: Date | null = null;
  isRefreshing = false;

  constructor(
    private klaviyoService: KlaviyoService,
    private googleAdsService: GoogleAdsService,
    private adSuggestionsService: AdSuggestionsService
  ) {
    // Initialize date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.analysisEndDate = this.formatDateForInput(today);
    this.analysisStartDate = this.formatDateForInput(thirtyDaysAgo);
  }

  ngOnInit(): void {
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadKlaviyoData();
    this.loadGoogleAdsData();

    setTimeout(() => {
      this.isRefreshing = false;
      this.lastRefreshed = new Date();
    }, 1000);
  }

  loadKlaviyoData(): void {
    this.loadingStates.klaviyo = true;
    this.errors.klaviyo = '';

    this.klaviyoService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.klaviyoData = data;
          this.loadingStates.klaviyo = false;
          if (data.error) {
            this.errors.klaviyo = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.klaviyo = false;
          this.errors.klaviyo = err.message || 'Failed to load Klaviyo data';
        }
      });
  }

  loadGoogleAdsData(): void {
    this.loadingStates.googleAds = true;
    this.errors.googleAds = '';

    this.googleAdsService.getData(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.googleAdsData = data;
          this.loadingStates.googleAds = false;
          if (data.error) {
            this.errors.googleAds = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.googleAds = false;
          this.errors.googleAds = err.message || 'Failed to load Google Ads data';
        }
      });
  }

  setPeriod(period: GoogleAdsPeriod): void {
    this.selectedPeriod = period;
    this.loadGoogleAdsData();
    // Clear previous suggestions when period changes
    this.suggestionsData = null;
  }

  getTargetCampaign(): Campaign | null {
    if (!this.googleAdsData?.campaigns) return null;
    return this.googleAdsData.campaigns.find(c => c.name === this.googleAdsData?.targetCampaign) || null;
  }

  getAnalysisDays(): number {
    if (!this.analysisStartDate || !this.analysisEndDate) return 0;
    const start = new Date(this.analysisStartDate);
    const end = new Date(this.analysisEndDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  loadSuggestions(): void {
    if (!this.analysisStartDate || !this.analysisEndDate) {
      this.errors.suggestions = 'Please select a date range for analysis';
      return;
    }

    if (new Date(this.analysisStartDate) > new Date(this.analysisEndDate)) {
      this.errors.suggestions = 'Start date must be before end date';
      return;
    }

    this.loadingStates.suggestions = true;
    this.errors.suggestions = '';

    const request = {
      startDate: this.analysisStartDate,
      endDate: this.analysisEndDate
    };

    this.adSuggestionsService.getSuggestions(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.suggestionsData = data;
          this.loadingStates.suggestions = false;
          if (data.error) {
            this.errors.suggestions = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.suggestions = false;
          this.errors.suggestions = err.message || 'Failed to get AI suggestions';
        }
      });
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'add': return 'bg-green-500/20 text-green-400';
      case 'pause': return 'bg-red-500/20 text-red-400';
      case 'modify': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'budget': return 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'targeting': return 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z';
      case 'bidding': return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
      case 'creative': return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
      case 'landing_page': return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
      default: return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  getSpendPercentage(): number {
    if (!this.googleAdsData?.dailyBudget) return 0;
    return Math.min((this.googleAdsData.dailySpend / this.googleAdsData.dailyBudget) * 100, 100);
  }

  getCtr(): number {
    if (!this.googleAdsData?.impressions) return 0;
    return (this.googleAdsData.clicks / this.googleAdsData.impressions) * 100;
  }

  // Additional computed metrics
  getCostPerConversion(): number {
    if (!this.googleAdsData?.conversions || this.googleAdsData.conversions === 0) return 0;
    return this.googleAdsData.dailySpend / this.googleAdsData.conversions;
  }

  getCostPerLead(): number {
    const emailsCollected = this.klaviyoData?.emailsCollectedToday || 0;
    if (emailsCollected === 0) return 0;
    return this.googleAdsData?.dailySpend ? this.googleAdsData.dailySpend / emailsCollected : 0;
  }

  getConversionRate(): number {
    if (!this.googleAdsData?.clicks || this.googleAdsData.clicks === 0) return 0;
    return ((this.googleAdsData.conversions || 0) / this.googleAdsData.clicks) * 100;
  }

  getEmailGrowthRate(): number {
    const totalProfiles = this.klaviyoData?.totalProfiles || 0;
    const emailsToday = this.klaviyoData?.emailsCollectedToday || 0;
    if (totalProfiles === 0) return 0;
    return (emailsToday / totalProfiles) * 100;
  }

  getBestCampaign(): { name: string; cpc: number } | null {
    if (!this.googleAdsData?.campaigns?.length) return null;
    const sorted = [...this.googleAdsData.campaigns].sort((a, b) => a.cpc - b.cpc);
    return sorted[0];
  }

  getTotalCampaignClicks(): number {
    if (!this.googleAdsData?.campaigns) return 0;
    return this.googleAdsData.campaigns.reduce((sum, c) => sum + c.clicks, 0);
  }

  getNetPositionClass(): string {
    const netPosition = this.suggestionsData?.periodInsights?.netPosition || 0;
    if (netPosition > 0) return 'text-green-400';
    if (netPosition < 0) return 'text-red-400';
    return 'text-slate-400';
  }

  getRoasClass(): string {
    const roas = this.suggestionsData?.periodInsights?.revenueToSpendRatio || 0;
    if (roas >= 2) return 'text-green-400';
    if (roas >= 1) return 'text-amber-400';
    return 'text-red-400';
  }
}
