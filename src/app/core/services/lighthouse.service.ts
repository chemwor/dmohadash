import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface MetricDetail {
  value: number;
  displayValue: string;
  score: number;
}

export type ScoreCategory = 'good' | 'needs-improvement' | 'poor' | 'unknown';

export interface LighthouseData {
  url: string;
  strategy: string;

  // Category scores (0-100)
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;

  // Score categories
  performanceCategory: ScoreCategory;
  seoCategory: ScoreCategory;
  accessibilityCategory: ScoreCategory;
  bestPracticesCategory: ScoreCategory;

  // Core Web Vitals
  fcp: MetricDetail;  // First Contentful Paint
  lcp: MetricDetail;  // Largest Contentful Paint
  tbt: MetricDetail;  // Total Blocking Time
  cls: MetricDetail;  // Cumulative Layout Shift
  speedIndex: MetricDetail;

  // Additional metrics
  tti: MetricDetail;  // Time to Interactive
  serverResponseTime: MetricDetail;

  // Metadata
  lastTested?: string;
  fromCache?: boolean;
  cacheAge?: string;
  remainingRequests?: number;
  requestsUsedToday?: number;
  isMockData?: boolean;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LighthouseService {
  private readonly apiUrl = '/api/dashboard/lighthouse';

  constructor(private http: HttpClient) {}

  getData(forceRefresh = false): Observable<LighthouseData> {
    const url = forceRefresh ? `${this.apiUrl}?refresh=true` : this.apiUrl;

    return this.http.get<LighthouseData>(url).pipe(
      catchError(error => {
        console.error('Lighthouse service error:', error);
        return of(this.getEmptyData(error.message || 'Failed to fetch Lighthouse data'));
      })
    );
  }

  private getEmptyData(errorMessage: string): LighthouseData {
    const emptyMetric: MetricDetail = { value: 0, displayValue: 'N/A', score: 0 };
    return {
      url: '',
      strategy: 'mobile',
      performanceScore: 0,
      seoScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      performanceCategory: 'unknown',
      seoCategory: 'unknown',
      accessibilityCategory: 'unknown',
      bestPracticesCategory: 'unknown',
      fcp: emptyMetric,
      lcp: emptyMetric,
      tbt: emptyMetric,
      cls: emptyMetric,
      speedIndex: emptyMetric,
      tti: emptyMetric,
      serverResponseTime: emptyMetric,
      error: errorMessage
    };
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  }

  getScoreLabel(score: number): string {
    if (score >= 90) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  }
}
