import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';

import { ClarityService, ClarityData } from '../../../core/services/clarity.service';
import { LighthouseService, LighthouseData } from '../../../core/services/lighthouse.service';

@Component({
  selector: 'app-site-performance',
  standalone: true,
  imports: [CommonModule, LoadingSkeletonComponent],
  templateUrl: './site-performance.component.html'
})
export class SitePerformanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  clarityData: ClarityData | null = null;
  lighthouseData: LighthouseData | null = null;

  loadingStates = {
    clarity: false,
    lighthouse: false
  };

  errors = {
    clarity: '',
    lighthouse: ''
  };

  lastRefreshed: Date | null = null;
  isRefreshing = false;

  constructor(
    private clarityService: ClarityService,
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
    this.loadClarityData(true);
    this.loadLighthouseData(true);

    setTimeout(() => {
      this.isRefreshing = false;
      this.lastRefreshed = new Date();
    }, 1000);
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

  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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
    const rageClicks = this.clarityData?.rageClicks || 0;
    const deadClicks = this.clarityData?.deadClicks || 0;
    const quickBacks = this.clarityData?.quickBacks || 0;
    const excessiveScrolling = this.clarityData?.excessiveScrolling || 0;
    return rageClicks + deadClicks + quickBacks + excessiveScrolling;
  }

  getErrorRate(): number {
    const sessions = this.clarityData?.totalSessions || 0;
    if (sessions === 0) return 0;
    return ((this.clarityData?.jsErrors || 0) / sessions) * 100;
  }

  getEngagementScore(): number {
    // Score based on pages per session, scroll depth, and time on page
    const pagesPerSession = this.clarityData?.pagesPerSession || 0;
    const scrollDepth = this.clarityData?.avgScrollDepth || 0;
    const timeOnPage = this.clarityData?.avgTimeOnPage || 0;

    // Normalize each factor (0-100)
    const pagesScore = Math.min(pagesPerSession * 20, 100); // 5 pages = 100
    const scrollScore = scrollDepth; // already 0-100
    const timeScore = Math.min(timeOnPage * 2, 100); // 50 seconds = 100

    return Math.round((pagesScore + scrollScore + timeScore) / 3);
  }

  getSessionQualityScore(): number {
    // Combine Lighthouse performance with user experience metrics
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

  getPerformanceGrade(): string {
    const score = this.lighthouseData?.performanceScore || 0;
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  getSessionsPerVisitor(): number {
    const visitors = this.clarityData?.uniqueVisitors || 0;
    if (visitors === 0) return 0;
    return (this.clarityData?.totalSessions || 0) / visitors;
  }
}
