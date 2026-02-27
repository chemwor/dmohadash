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

export interface ClarityData {
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

  isMockData?: boolean;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClarityService {
  private readonly apiUrl = '/api/dashboard/clarity';

  constructor(private http: HttpClient) {}

  getData(forceRefresh = false): Observable<ClarityData> {
    const url = forceRefresh ? `${this.apiUrl}?refresh=true` : this.apiUrl;
    return this.http.get<ClarityData>(url).pipe(
      catchError(error => {
        console.error('Clarity service error:', error);
        return of({
          totalSessions: 0,
          totalPageViews: 0,
          pagesPerSession: 0,
          avgScrollDepth: 0,
          avgTimeOnPage: 0,
          bounceRate: 0,
          totalVisits: 0,
          uniqueVisitors: 0,
          returningVisitors: 0,
          rageClicks: 0,
          deadClicks: 0,
          quickBacks: 0,
          excessiveScrolling: 0,
          jsErrors: 0,
          slowPageLoads: 0,
          dailyVisits: [],
          pagesWithIssues: [],
          error: error.message || 'Failed to fetch Clarity data'
        });
      })
    );
  }
}
