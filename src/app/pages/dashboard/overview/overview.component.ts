import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval } from 'rxjs';

import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatRowComponent } from '../../../shared/components/stat-row/stat-row.component';

import { StripeService, StripeData, StripePeriod } from '../../../core/services/stripe.service';
import { KlaviyoService, KlaviyoData } from '../../../core/services/klaviyo.service';
import { GoogleAdsService, GoogleAdsData, GoogleAdsPeriod } from '../../../core/services/google-ads.service';
import { SupabaseService, SupabaseData, SupabasePeriod } from '../../../core/services/supabase.service';
import { ClarityService, ClarityData } from '../../../core/services/clarity.service';
import { LighthouseService, LighthouseData } from '../../../core/services/lighthouse.service';
import { OpenAIUsageService, OpenAIUsageData } from '../../../core/services/openai-usage.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, MetricCardComponent, LoadingSkeletonComponent, StatRowComponent],
  templateUrl: './overview.component.html'
})
export class OverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  stripeData: StripeData | null = null;
  klaviyoData: KlaviyoData | null = null;
  googleAdsData: GoogleAdsData | null = null;
  supabaseData: SupabaseData | null = null;
  clarityData: ClarityData | null = null;
  lighthouseData: LighthouseData | null = null;
  openaiUsageData: OpenAIUsageData | null = null;

  selectedPeriod: StripePeriod = 'today';
  periods = [
    { value: 'today' as StripePeriod, label: 'Today' },
    { value: 'week' as StripePeriod, label: 'This Week' },
    { value: 'month' as StripePeriod, label: 'This Month' }
  ];

  loadingStates = {
    stripe: false,
    klaviyo: false,
    googleAds: false,
    supabase: false,
    clarity: false,
    lighthouse: false,
    openai: false
  };

  errors = {
    stripe: '',
    klaviyo: '',
    googleAds: '',
    supabase: '',
    clarity: '',
    lighthouse: '',
    openai: ''
  };

  currentDate = '';
  currentTime = '';
  lastRefreshed: Date | null = null;
  isRefreshing = false;

  constructor(
    private stripeService: StripeService,
    private klaviyoService: KlaviyoService,
    private googleAdsService: GoogleAdsService,
    private supabaseService: SupabaseService,
    private clarityService: ClarityService,
    private lighthouseService: LighthouseService,
    private openaiUsageService: OpenAIUsageService
  ) {}

  ngOnInit(): void {
    this.updateDateTime();
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateDateTime());

    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get calculatedMetrics() {
    const adSpend = this.googleAdsData?.dailySpend || 0;
    const purchases = this.supabaseData?.purchases || 0;
    const revenue = this.stripeData?.revenue || 0;

    return {
      cac: purchases > 0 ? Math.round((adSpend / purchases) * 100) / 100 : 0,
      roas: adSpend > 0 ? Math.round((revenue / adSpend) * 100) / 100 : 0
    };
  }

  updateDateTime(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  setPeriod(period: StripePeriod): void {
    this.selectedPeriod = period;
    this.loadStripeData();
    this.loadSupabaseData();
    this.loadGoogleAdsData();
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadStripeData();
    this.loadKlaviyoData();
    this.loadGoogleAdsData();
    this.loadSupabaseData();
    this.loadClarityData(true);
    this.loadLighthouseData(true);
    this.loadOpenAIUsageData(true);

    setTimeout(() => {
      this.isRefreshing = false;
      this.lastRefreshed = new Date();
    }, 1000);
  }

  loadStripeData(): void {
    this.loadingStates.stripe = true;
    this.errors.stripe = '';

    this.stripeService.getData(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.stripeData = data;
          this.loadingStates.stripe = false;
          if (data.error) {
            this.errors.stripe = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.stripe = false;
          this.errors.stripe = err.message || 'Failed to load Stripe data';
        }
      });
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

    const googleAdsPeriod = this.selectedPeriod as GoogleAdsPeriod;
    this.googleAdsService.getData(googleAdsPeriod)
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

  loadSupabaseData(): void {
    this.loadingStates.supabase = true;
    this.errors.supabase = '';

    const supabasePeriod = this.selectedPeriod as SupabasePeriod;

    this.supabaseService.getData(supabasePeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.supabaseData = data;
          this.loadingStates.supabase = false;
          if (data.error) {
            this.errors.supabase = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.supabase = false;
          this.errors.supabase = err.message || 'Failed to load Supabase data';
        }
      });
  }

  loadClarityData(forceRefresh = false): void {
    this.loadingStates.clarity = true;
    this.errors.clarity = '';

    this.clarityService.getData(forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.clarityData = data;
          this.loadingStates.clarity = false;
          if (data.error) {
            this.errors.clarity = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.clarity = false;
          this.errors.clarity = err.message || 'Failed to load Clarity data';
        }
      });
  }

  loadLighthouseData(forceRefresh = false): void {
    this.loadingStates.lighthouse = true;
    this.errors.lighthouse = '';

    this.lighthouseService.getData(forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.lighthouseData = data;
          this.loadingStates.lighthouse = false;
          if (data.error) {
            this.errors.lighthouse = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.lighthouse = false;
          this.errors.lighthouse = err.message || 'Failed to load Lighthouse data';
        }
      });
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  }

  getScoreBgClass(score: number): string {
    if (score >= 90) return 'bg-green-500/20 border-green-500/30';
    if (score >= 50) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  }

  loadOpenAIUsageData(forceRefresh = false): void {
    this.loadingStates.openai = true;
    this.errors.openai = '';

    this.openaiUsageService.getData(forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.openaiUsageData = data;
          this.loadingStates.openai = false;
          if (data.error) {
            this.errors.openai = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.openai = false;
          this.errors.openai = err.message || 'Failed to load OpenAI usage data';
        }
      });
  }

  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  getSpendPercentage(): number {
    if (!this.googleAdsData?.dailyBudget) return 0;
    return Math.min((this.googleAdsData.dailySpend / this.googleAdsData.dailyBudget) * 100, 100);
  }
}
