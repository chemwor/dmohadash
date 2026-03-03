import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface DailyVisit {
  date: string;
  visits: number;
  sessions: number;
}

export interface PageWithIssues {
  page: string;
  rageClicks: number;
  deadClicks: number;
}

export interface WebVitalMetric {
  p75: number;
  p90: number;
}

export interface WebVitalsData {
  fcp: WebVitalMetric;
  lcp: WebVitalMetric;
  cls: WebVitalMetric;
  inp: WebVitalMetric;
  sampleCount: number;
}

export interface TopPage {
  page: string;
  views: number;
}

export interface FunnelData {
  landing: number;
  preview: number;
  purchase: number;
}

export interface PerformanceSuggestion {
  type: 'success' | 'info' | 'warning' | 'error';
  category: string;
  title: string;
  description: string;
}

export interface CompositeGrade {
  rumScore: number;
  uxScore: number;
  engagementScore: number;
}

export interface PosthogData {
  // User Behavior
  totalSessions: number;
  totalPageViews: number;
  pagesPerSession: number;
  avgScrollDepth: number;
  avgTimeOnPage: number;
  bounceRate: number;

  // Visits
  totalVisits: number;
  uniqueVisitors: number;
  returningVisitors: number;

  // Frustration Signals
  rageClicks: number;
  deadClicks: number;
  quickBacks: number;
  excessiveScrolling: number;

  // Technical Issues
  jsErrors: number;
  slowPageLoads: number;

  // Trends
  dailyVisits: DailyVisit[];
  pagesWithIssues: PageWithIssues[];

  // Real User Web Vitals
  webVitals: WebVitalsData;

  // User Behavior Summary
  topPages: TopPage[];
  funnel: FunnelData;

  // Suggestions & Grade
  suggestions: PerformanceSuggestion[];
  compositeGrade: CompositeGrade;

  isMockData?: boolean;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PosthogService {
  private readonly apiUrl = '/api/dashboard/posthog';

  constructor(private http: HttpClient) {}

  getData(forceRefresh = false): Observable<PosthogData> {
    const url = forceRefresh ? `${this.apiUrl}?refresh=true` : this.apiUrl;
    return this.http.get<PosthogData>(url).pipe(
      catchError(error => {
        console.error('PostHog service error:', error);
        return of({
          totalSessions: 0, totalPageViews: 0, pagesPerSession: 0,
          avgScrollDepth: 0, avgTimeOnPage: 0, bounceRate: 0,
          totalVisits: 0, uniqueVisitors: 0, returningVisitors: 0,
          rageClicks: 0, deadClicks: 0, quickBacks: 0, excessiveScrolling: 0,
          jsErrors: 0, slowPageLoads: 0,
          dailyVisits: [], pagesWithIssues: [], topPages: [],
          webVitals: { fcp: { p75: 0, p90: 0 }, lcp: { p75: 0, p90: 0 },
                       cls: { p75: 0, p90: 0 }, inp: { p75: 0, p90: 0 }, sampleCount: 0 },
          funnel: { landing: 0, preview: 0, purchase: 0 },
          suggestions: [],
          compositeGrade: { rumScore: 0, uxScore: 0, engagementScore: 0 },
          error: error.message || 'Failed to fetch PostHog data'
        });
      })
    );
  }
}
