import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface FunnelMetrics {
  visitors: number;
  quickPreviews: number;
  fullPreviews: number;
  purchases: number;
  visitorToQuickPreviewRate: number;
  quickToFullPreviewRate: number;
  fullPreviewToPurchaseRate: number;
  overallConversionRate: number;
}

export interface RecentCase {
  id: string;
  token: string;
  email: string | null;
  created_at: string;
  status: string;
  type: 'quick' | 'full';
  unlocked: boolean;
  noticeType: string | null;
  issueText: string | null;
  amount: number | null;
  hasOutput?: boolean;
  outputStatus?: string | null;
}

export interface CompletedCase {
  id: string;
  token: string;
  email: string | null;
  created_at: string;
  noticeType: string | null;
  amount: number | null;
  hasOutput: boolean;
  outputStatus: 'ready' | 'pending' | 'error' | 'no_output';
  outputModel: string | null;
  outputCreatedAt: string | null;
}

export interface OutputStats {
  total: number;
  ready: number;
  pending: number;
  error: number;
  noOutput: number;
}

export interface SupabaseData {
  quickPreviewCompletions: number;
  fullPreviewCompletions: number;
  purchases: number;
  totalRevenue: number;
  totalCases: number;
  funnel: FunnelMetrics;
  recentCases: RecentCase[];
  completedCases?: CompletedCase[];
  outputStats?: OutputStats;
  period: string;
  isMockData?: boolean;
  error?: string;
}

export type SupabasePeriod = 'today' | 'week' | 'month' | 'all';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly apiUrl = '/api/supabase';

  constructor(private http: HttpClient) {}

  getData(period: SupabasePeriod = 'today'): Observable<SupabaseData> {
    const params = new HttpParams().set('period', period);

    return this.http.get<SupabaseData>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Supabase service error:', error);
        return of({
          quickPreviewCompletions: 0,
          fullPreviewCompletions: 0,
          purchases: 0,
          totalRevenue: 0,
          totalCases: 0,
          funnel: {
            visitors: 0,
            quickPreviews: 0,
            fullPreviews: 0,
            purchases: 0,
            visitorToQuickPreviewRate: 0,
            quickToFullPreviewRate: 0,
            fullPreviewToPurchaseRate: 0,
            overallConversionRate: 0
          },
          recentCases: [],
          period,
          error: error.message || 'Failed to fetch Supabase data'
        });
      })
    );
  }
}
