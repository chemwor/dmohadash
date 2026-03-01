import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { SixMonthService } from '../../../core/services/six-month.service';
import { SixMonthPlan, GradeMetric } from '../../../interfaces/dashboard.interfaces';

interface GradeRow {
  label: string;
  metric: GradeMetric;
  format: 'number' | 'percent' | 'currency' | 'ratio';
  thresholds: { a: string; c: string; f: string };
}

@Component({
  selector: 'app-grading',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent],
  templateUrl: './grading.component.html'
})
export class GradingComponent implements OnInit, OnDestroy {
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
          this.error = err.message || 'Failed to load grading data';
        }
      });
  }

  get trafficGrades(): GradeRow[] {
    if (!this.data) return [];
    const g = this.data.current_grades.traffic;
    return [
      { label: 'Monthly Visitors', metric: g.monthly_visitors, format: 'number', thresholds: { a: '1,000+', c: '250–999', f: '<250' } },
      { label: 'Google Ads CTR', metric: g.google_ads_ctr, format: 'percent', thresholds: { a: '>3.5%', c: '2–3.5%', f: '<2%' } },
      { label: 'Organic Traffic %', metric: g.organic_share, format: 'percent', thresholds: { a: '>30%', c: '10–30%', f: '<10%' } }
    ];
  }

  get conversionGrades(): GradeRow[] {
    if (!this.data) return [];
    const g = this.data.current_grades.conversion;
    return [
      { label: 'Site Conversion', metric: g.site_conversion, format: 'percent', thresholds: { a: '>3%', c: '1–3%', f: '<1%' } },
      { label: 'Email Open Rate', metric: g.email_open_rate, format: 'percent', thresholds: { a: '>25%', c: '15–25%', f: '<15%' } },
      { label: 'Preview-to-Paid', metric: g.preview_to_paid, format: 'percent', thresholds: { a: '>5%', c: '2–5%', f: '<2%' } }
    ];
  }

  get revenueGrades(): GradeRow[] {
    if (!this.data) return [];
    const g = this.data.current_grades.revenue;
    return [
      { label: 'Monthly Revenue', metric: g.monthly_revenue, format: 'currency', thresholds: { a: '>$1K', c: '$300–1K', f: '<$300' } },
      { label: 'CAC:LTV Ratio', metric: g.cac_ltv_ratio, format: 'ratio', thresholds: { a: '>3:1', c: '1:1–3:1', f: '<1:1' } },
      { label: 'ROAS', metric: g.roas, format: 'ratio', thresholds: { a: '>3x', c: '1–3x', f: '<1x' } }
    ];
  }

  formatValue(row: GradeRow): string {
    const v = row.metric.value;
    switch (row.format) {
      case 'number': return v.toLocaleString();
      case 'percent': return (v * 100).toFixed(1) + '%';
      case 'currency': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
      case 'ratio': return v.toFixed(1) + (row.label.includes('ROAS') ? 'x' : ':1');
      default: return String(v);
    }
  }

  getGradeColor(grade: string): string {
    switch (grade) {
      case 'A': return 'text-green-400 bg-green-500/20';
      case 'C': return 'text-amber-400 bg-amber-500/20';
      case 'F': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-500 bg-slate-700';
    }
  }

  getCategoryGrade(rows: GradeRow[]): string {
    const fCount = rows.filter(r => r.metric.grade === 'F').length;
    const aCount = rows.filter(r => r.metric.grade === 'A').length;
    if (fCount >= 2) return 'F';
    if (aCount >= 2) return 'A';
    return 'C';
  }
}
