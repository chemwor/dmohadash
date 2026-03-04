import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { CostsService } from '../../../core/services/costs.service';
import { CostsData } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-cost-tracker',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent, MetricCardComponent],
  templateUrl: './cost-tracker.component.html'
})
export class CostTrackerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  data: CostsData | null = null;
  loading = false;
  error = '';
  selectedPeriod: 'today' | 'week' | 'month' = 'today';

  periods = [
    { value: 'today' as const, label: 'Today' },
    { value: 'week' as const, label: 'Week' },
    { value: 'month' as const, label: 'Month' }
  ];

  constructor(private costsService: CostsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setPeriod(period: 'today' | 'week' | 'month'): void {
    this.selectedPeriod = period;
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    this.costsService.get(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.data = data;
          this.loading = false;
          if (data.error) this.error = data.error;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load costs data';
        }
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }

  absValue(value: number): number {
    return Math.abs(value);
  }

  get costBreakdown(): { label: string; mtd: number; dailyAvg: number | null }[] {
    if (!this.data) return [];
    return [
      { label: 'Google Ads', mtd: this.data.costs.google_ads.mtd, dailyAvg: this.data.costs.google_ads.daily_avg },
      { label: 'OpenAI API', mtd: this.data.costs.openai_api.mtd, dailyAvg: this.data.costs.openai_api.today },
      { label: 'Claude API', mtd: this.data.costs.claude_api.mtd, dailyAvg: this.data.costs.claude_api.today },
      { label: 'Heroku', mtd: this.data.costs.heroku.mtd, dailyAvg: null },
      { label: 'Supabase', mtd: this.data.costs.supabase.mtd, dailyAvg: null },
      { label: 'Tools', mtd: this.data.costs.tools.mtd, dailyAvg: null }
    ];
  }
}
