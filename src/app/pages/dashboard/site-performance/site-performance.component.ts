import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';

import { PosthogService, PosthogData } from '../../../core/services/posthog.service';
import { LighthouseService, LighthouseData } from '../../../core/services/lighthouse.service';

@Component({
  selector: 'app-site-performance',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './site-performance.component.html'
})
export class SitePerformanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  posthogData: PosthogData | null = null;
  lighthouseData: LighthouseData | null = null;

  loadingStates = {
    posthog: false,
    lighthouse: false
  };

  errors = {
    posthog: '',
    lighthouse: ''
  };

  lastRefreshed: Date | null = null;
  isRefreshing = false;

  constructor(
    private posthogService: PosthogService,
    private lighthouseService: LighthouseService
  ) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadPosthogData(true);
    this.loadLighthouseData(true);

    setTimeout(() => {
      this.isRefreshing = false;
      this.lastRefreshed = new Date();
    }, 1000);
  }

  loadPosthogData(forceRefresh = false): void {
    this.loadingStates.posthog = true;
    this.errors.posthog = '';

    this.posthogService.getData(forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.posthogData = data;
          this.loadingStates.posthog = false;
          if (data.error) {
            this.errors.posthog = data.error;
          }
        },
        error: (err) => {
          this.loadingStates.posthog = false;
          this.errors.posthog = err.message || 'Failed to load PostHog data';
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

  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  formatMs(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
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

  // Computed metrics
  getFrustrationIndex(): number {
    const rageClicks = this.posthogData?.rageClicks || 0;
    const deadClicks = this.posthogData?.deadClicks || 0;
    const quickBacks = this.posthogData?.quickBacks || 0;
    const excessiveScrolling = this.posthogData?.excessiveScrolling || 0;
    return rageClicks + deadClicks + quickBacks + excessiveScrolling;
  }

  getErrorRate(): number {
    const sessions = this.posthogData?.totalSessions || 0;
    if (sessions === 0) return 0;
    return ((this.posthogData?.jsErrors || 0) / sessions) * 100;
  }

  getEngagementScore(): number {
    const pagesPerSession = this.posthogData?.pagesPerSession || 0;
    const scrollDepth = this.posthogData?.avgScrollDepth || 0;
    const timeOnPage = this.posthogData?.avgTimeOnPage || 0;

    const pagesScore = Math.min(pagesPerSession * 20, 100);
    const scrollScore = scrollDepth;
    const timeScore = Math.min(timeOnPage * 2, 100);

    return Math.round((pagesScore + scrollScore + timeScore) / 3);
  }

  getSessionQualityScore(): number {
    const performance = this.lighthouseData?.performanceScore || 0;
    const engagement = this.getEngagementScore();
    const frustration = Math.max(0, 100 - this.getFrustrationIndex());
    const errorPenalty = Math.max(0, 100 - (this.getErrorRate() * 10));

    return Math.round((performance + engagement + frustration + errorPenalty) / 4);
  }

  getFrustrationLevel(): string {
    const index = this.getFrustrationIndex();
    if (index < 10) return 'Low';
    if (index < 50) return 'Medium';
    return 'High';
  }

  getFrustrationClass(): string {
    const index = this.getFrustrationIndex();
    if (index < 10) return 'text-green-400';
    if (index < 50) return 'text-yellow-400';
    return 'text-red-400';
  }

  // Composite performance grade (weighted across all sources)
  getCompositeScore(): number {
    const lighthouseScore = this.lighthouseData?.performanceScore || 0;
    const rumScore = this.posthogData?.compositeGrade?.rumScore || 0;
    const uxScore = this.posthogData?.compositeGrade?.uxScore || 0;
    const engagementScore = this.posthogData?.compositeGrade?.engagementScore || 0;

    return Math.round(
      (lighthouseScore * 0.30) +
      (rumScore * 0.30) +
      (uxScore * 0.20) +
      (engagementScore * 0.20)
    );
  }

  getPerformanceGrade(): string {
    const score = this.getCompositeScore();
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  getSessionsPerVisitor(): number {
    const visitors = this.posthogData?.uniqueVisitors || 0;
    if (visitors === 0) return 0;
    return (this.posthogData?.totalSessions || 0) / visitors;
  }

  // Web Vitals helpers
  getVitalRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, [number, number]> = {
      'lcp': [2500, 4000],
      'fcp': [1800, 3000],
      'cls': [0.1, 0.25],
      'inp': [200, 500],
    };
    const [good, poor] = thresholds[metric] || [0, 0];
    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  getVitalColorClass(rating: 'good' | 'needs-improvement' | 'poor'): string {
    switch (rating) {
      case 'good': return 'text-green-400';
      case 'needs-improvement': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
    }
  }

  getVitalBgClass(rating: 'good' | 'needs-improvement' | 'poor'): string {
    switch (rating) {
      case 'good': return 'bg-green-500/10 border-green-500/30';
      case 'needs-improvement': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'poor': return 'bg-red-500/10 border-red-500/30';
    }
  }

  // Funnel helpers
  getFunnelRate(from: number, to: number): number {
    if (from === 0) return 0;
    return Math.round((to / from) * 100);
  }

  getMaxDailyVisits(): number {
    if (!this.posthogData?.dailyVisits?.length) return 1;
    return Math.max(...this.posthogData.dailyVisits.map(d => d.visits), 1);
  }

  // Template helper for Math.max (not available in Angular templates)
  maxVal(a: number, b: number): number {
    return Math.max(a, b);
  }
}
