import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { SixMonthService } from '../../../core/services/six-month.service';
import { ChecklistsService } from '../../../core/services/checklists.service';
import { SixMonthPlan, MonthPlan, ChecklistItem, ContentActuals } from '../../../interfaces/dashboard.interfaces';

interface MonthTargets {
  visitors: number;
  ads_ctr: number;
  email_subscribers: number;
  paid_cases: number;
  revenue: number;
  blog_posts: number;
  videos: number;
  newsletters: number;
  social_posts: number;
}

interface MonthConfig {
  name: string;
  theme: string;
  focus: string;
  budget: number;
  targets: MonthTargets;
}

const MONTH_TARGETS: Record<number, MonthConfig> = {
  1: {
    name: 'April 2026', theme: 'Foundation & Launch',
    focus: 'Build the engine. Install tracking, baseline content, $50 in revenue is a win.',
    budget: 400,
    targets: { visitors: 200, ads_ctr: 0.015, email_subscribers: 25, paid_cases: 1, revenue: 50, blog_posts: 4, videos: 4, newsletters: 2, social_posts: 8 }
  },
  2: {
    name: 'May 2026', theme: 'Optimize & Amplify',
    focus: 'Read the data from M1. Cut waste, double down on what worked.',
    budget: 500,
    targets: { visitors: 400, ads_ctr: 0.02, email_subscribers: 75, paid_cases: 2, revenue: 100, blog_posts: 4, videos: 6, newsletters: 4, social_posts: 12 }
  },
  3: {
    name: 'June 2026', theme: 'Content Engine',
    focus: 'Production at scale. Consistent publishing across all channels.',
    budget: 600,
    targets: { visitors: 700, ads_ctr: 0.025, email_subscribers: 150, paid_cases: 4, revenue: 200, blog_posts: 6, videos: 8, newsletters: 4, social_posts: 16 }
  },
  4: {
    name: 'July 2026', theme: 'Scale What Works',
    focus: 'Pour gas on the fire. Cut everything else.',
    budget: 750,
    targets: { visitors: 1000, ads_ctr: 0.03, email_subscribers: 250, paid_cases: 6, revenue: 300, blog_posts: 6, videos: 8, newsletters: 4, social_posts: 16 }
  },
  5: {
    name: 'August 2026', theme: 'Authority & Media',
    focus: 'Become a name in HOA advocacy. PR, partnerships, guest spots.',
    budget: 850,
    targets: { visitors: 1500, ads_ctr: 0.03, email_subscribers: 400, paid_cases: 10, revenue: 500, blog_posts: 8, videos: 8, newsletters: 4, social_posts: 20 }
  },
  6: {
    name: 'September 2026', theme: 'Evaluate & Decide',
    focus: 'The verdict. Where are we, and what\'s next? Double down or pivot.',
    budget: 900,
    targets: { visitors: 2000, ads_ctr: 0.03, email_subscribers: 600, paid_cases: 15, revenue: 750, blog_posts: 6, videos: 6, newsletters: 4, social_posts: 16 }
  }
};

@Component({
  selector: 'app-month-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent],
  templateUrl: './month-detail.component.html'
})
export class MonthDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  monthId = 1;
  monthConfig: MonthConfig | null = null;
  monthData: MonthPlan | null = null;
  planData: SixMonthPlan | null = null;
  checklistItems: ChecklistItem[] = [];
  loading = false;
  error = '';
  updatingContent = '';

  constructor(
    private route: ActivatedRoute,
    private sixMonthService: SixMonthService,
    private checklistsService: ChecklistsService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.monthId = parseInt(params['id'], 10) || 1;
      this.monthConfig = MONTH_TARGETS[this.monthId] || null;
      this.loadData();
    });
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
          this.planData = data;
          this.monthData = data.months.find(m => m.month === this.monthId) || null;
          this.loading = false;
          if (data.error) this.error = data.error;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to load plan data';
        }
      });

    this.checklistsService.getAll({ month: this.monthId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => { this.checklistItems = items; }
      });
  }

  get checklistDone(): number {
    return this.checklistItems.filter(i => i.status === 'done').length;
  }

  get checklistTotal(): number {
    return this.checklistItems.length;
  }

  get checklistPct(): number {
    return this.checklistTotal > 0 ? (this.checklistDone / this.checklistTotal) * 100 : 0;
  }

  getGradeForMetric(key: string): string {
    if (!this.planData) return '—';
    const grades = this.planData.current_grades;
    const map: Record<string, any> = {
      visitors: grades.traffic.monthly_visitors,
      ads_ctr: grades.traffic.google_ads_ctr,
      email_subscribers: grades.conversion.email_open_rate,
      paid_cases: grades.conversion.preview_to_paid,
      revenue: grades.revenue.monthly_revenue
    };
    return map[key]?.grade || '—';
  }

  getGradeColor(grade: string): string {
    switch (grade) {
      case 'A': return 'text-green-400 bg-green-500/20';
      case 'C': return 'text-amber-400 bg-amber-500/20';
      case 'F': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-500 bg-slate-700';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  minValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  getContentActual(type: keyof ContentActuals): number {
    return this.monthData?.content_actuals?.[type] || 0;
  }

  getContentTarget(type: string): number {
    if (!this.monthConfig) return 0;
    const map: Record<string, number> = {
      blog: this.monthConfig.targets.blog_posts,
      video: this.monthConfig.targets.videos,
      newsletter: this.monthConfig.targets.newsletters,
      social: this.monthConfig.targets.social_posts,
    };
    return map[type] || 0;
  }

  getContentPct(type: keyof ContentActuals): number {
    const target = this.getContentTarget(type);
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.getContentActual(type) / target) * 100));
  }

  getTotalContentActual(): number {
    const ca = this.monthData?.content_actuals;
    if (!ca) return 0;
    return ca.blog + ca.video + ca.newsletter + ca.social;
  }

  getTotalContentTarget(): number {
    if (!this.monthConfig) return 0;
    const t = this.monthConfig.targets;
    return t.blog_posts + t.videos + t.newsletters + t.social_posts;
  }

  incrementContent(type: 'video' | 'newsletter' | 'social'): void {
    if (!this.monthData?.content_actuals) return;
    const newCount = this.monthData.content_actuals[type] + 1;
    this.saveContentActual(type, newCount);
  }

  decrementContent(type: 'video' | 'newsletter' | 'social'): void {
    if (!this.monthData?.content_actuals) return;
    const newCount = Math.max(0, this.monthData.content_actuals[type] - 1);
    this.saveContentActual(type, newCount);
  }

  private saveContentActual(type: string, count: number): void {
    this.updatingContent = type;
    // Optimistic update
    if (this.monthData?.content_actuals) {
      (this.monthData.content_actuals as any)[type] = count;
    }
    this.sixMonthService.updateContentActual(this.monthId, type, count)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.updatingContent = ''; },
        error: () => { this.updatingContent = ''; }
      });
  }
}
