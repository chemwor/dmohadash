import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { DailySummary, SendSummaryResponse } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class DailySummaryService {
  private readonly apiUrl = '/api/dashboard/daily-summary';

  constructor(private http: HttpClient) {}

  get(date?: string): Observable<DailySummary> {
    const url = date ? `${this.apiUrl}?date=${date}` : this.apiUrl;
    return this.http.get<DailySummary>(url).pipe(
      catchError(error => {
        console.error('Daily summary service error:', error);
        return of({
          date: new Date().toISOString().slice(0, 10),
          summary: {
            executive_summary: '',
            revenue: { today: 0, mtd: 0, target: 0, pace: 'behind' as const },
            cases: { new_today: 0, paid_today: 0, mtd_paid: 0, conversion_rate: 0 },
            ads: { spend_today: 0, clicks: 0, cpa: 0, ctr: 0, grade: 'F' },
            email: { list_size: 0, new_subscribers: 0 },
            costs: { api_today: 0 },
            alerts_active: 0,
            checklist_progress: { done: 0, total: 0, pct: 0 },
            top_3_actions: [],
            risks: [],
            wins: []
          },
          summary_text: '',
          error: error.message || 'Failed to fetch daily summary'
        });
      })
    );
  }

  send(): Observable<SendSummaryResponse> {
    return this.http.post<SendSummaryResponse>(`${this.apiUrl}/send`, {}).pipe(
      catchError(error => {
        console.error('Send summary error:', error);
        throw error;
      })
    );
  }
}
