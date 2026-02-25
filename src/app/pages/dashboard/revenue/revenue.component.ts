import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';

import { StripeService, StripeData, StripePeriod } from '../../../core/services/stripe.service';
import { OpenAIUsageService, OpenAIUsageData } from '../../../core/services/openai-usage.service';

@Component({
  selector: 'app-revenue',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent, MetricCardComponent],
  templateUrl: './revenue.component.html'
})
export class RevenueComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  stripeData: StripeData | null = null;
  openaiUsageData: OpenAIUsageData | null = null;

  selectedPeriod: StripePeriod = 'today';
  periods = [
    { value: 'today' as StripePeriod, label: 'Today' },
    { value: 'week' as StripePeriod, label: 'This Week' },
    { value: 'month' as StripePeriod, label: 'This Month' }
  ];

  loadingStates = {
    stripe: false,
    openai: false
  };

  errors = {
    stripe: '',
    openai: ''
  };

  lastRefreshed: Date | null = null;
  isRefreshing = false;

  constructor(
    private stripeService: StripeService,
    private openaiUsageService: OpenAIUsageService
  ) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setPeriod(period: StripePeriod): void {
    this.selectedPeriod = period;
    this.loadStripeData();
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadStripeData();
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

  // Computed metrics
  getAvgTransactionValue(): number {
    if (!this.stripeData?.transactions || this.stripeData.transactions === 0) return 0;
    return this.stripeData.revenue / this.stripeData.transactions;
  }

  getRefundRate(): number {
    if (!this.stripeData?.transactions || this.stripeData.transactions === 0) return 0;
    return ((this.stripeData.refunds?.count || 0) / this.stripeData.transactions) * 100;
  }

  getNetRevenue(): number {
    return (this.stripeData?.revenue || 0) - (this.stripeData?.refunds?.amount || 0);
  }

  getGrossProfit(): number {
    const netRevenue = this.getNetRevenue();
    const apiCosts = this.openaiUsageData?.totalCost || 0;
    return netRevenue - apiCosts;
  }

  getGrossProfitMargin(): number {
    const revenue = this.stripeData?.revenue || 0;
    if (revenue === 0) return 0;
    return (this.getGrossProfit() / revenue) * 100;
  }

  getTotalTokens(): number {
    return (this.openaiUsageData?.totalInputTokens || 0) + (this.openaiUsageData?.totalOutputTokens || 0);
  }

  getInputTokenPercentage(): number {
    const total = this.getTotalTokens();
    if (total === 0) return 0;
    return ((this.openaiUsageData?.totalInputTokens || 0) / total) * 100;
  }

  getCostPer1kTokens(): number {
    const total = this.getTotalTokens();
    if (total === 0) return 0;
    return ((this.openaiUsageData?.totalCost || 0) / total) * 1000;
  }
}
