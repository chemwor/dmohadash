import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { SixMonthService } from '../../../core/services/six-month.service';
import { SixMonthPlan, MonthPlan } from '../../../interfaces/dashboard.interfaces';

@Component({
  selector: 'app-six-month-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent],
  templateUrl: './six-month-overview.component.html'
})
export class SixMonthOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  data: SixMonthPlan | null = null;
  loading = false;
  error = '';

  constructor(private sixMonthService: SixMonthService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    this.sixMonthService.get()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.data = data;
          this.loading = false;
          if (data.error) this.error = data.error;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load plan data';
        }
      });
  }

  getScenarioColor(scenario: string): string {
    switch (scenario) {
      case 'good': return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'bad': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'ugly': return 'bg-red-500/10 border-red-500/30 text-red-400';
      default: return 'bg-slate-700 border-slate-600 text-slate-300';
    }
  }

  getScenarioIcon(scenario: string): string {
    switch (scenario) {
      case 'good': return 'text-green-400';
      case 'bad': return 'text-amber-400';
      case 'ugly': return 'text-red-400';
      default: return 'text-slate-400';
    }
  }

  getMonthStatus(month: MonthPlan): string {
    if (month.status === 'completed') return 'Completed';
    if (month.status === 'active') return 'Active';
    return 'Upcoming';
  }

  getMonthStatusBadge(month: MonthPlan): string {
    if (month.status === 'completed') return 'bg-green-500/20 text-green-400';
    if (month.status === 'active') return 'bg-indigo-500/20 text-indigo-400';
    return 'bg-slate-700 text-slate-500';
  }

  getMonthBorder(month: MonthPlan): string {
    if (month.status === 'active') return 'border-indigo-500/50';
    if (month.status === 'completed') return 'border-green-500/30';
    return 'border-slate-700';
  }

  getProgressPct(month: MonthPlan): number {
    if (month.checklist_total === 0) return 0;
    return (month.checklist_done / month.checklist_total) * 100;
  }

  getTotalBudgetSpent(): number {
    if (!this.data) return 0;
    return this.data.months.reduce((sum, m) => sum + m.budget_actual, 0);
  }

  getTotalBudgetPlanned(): number {
    if (!this.data) return 0;
    return this.data.months.reduce((sum, m) => sum + m.budget_planned, 0);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  }

  // Content totals per month (blog + video + newsletter + social) — matches MONTH_TARGETS in month-detail
  private readonly contentTargets: Record<number, number> = {
    1: 18, 2: 26, 3: 34, 4: 34, 5: 40, 6: 32
  };

  getContentActualTotal(month: MonthPlan): number {
    const ca = month.content_actuals;
    if (!ca) return 0;
    return ca.blog + ca.video + ca.newsletter + ca.social;
  }

  getContentTargetTotal(month: number): number {
    return this.contentTargets[month] || 0;
  }

  getContentPct(month: MonthPlan): number {
    const target = this.getContentTargetTotal(month.month);
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.getContentActualTotal(month) / target) * 100));
  }
}
