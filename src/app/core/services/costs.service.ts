import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { CostsData } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class CostsService {
  private readonly apiUrl = '/api/dashboard/costs';

  constructor(private http: HttpClient) {}

  get(period: 'today' | 'week' | 'month' = 'month'): Observable<CostsData> {
    return this.http.get<CostsData>(`${this.apiUrl}?period=${period}`).pipe(
      catchError(error => {
        console.error('Costs service error:', error);
        return of({
          period: new Date().toISOString().slice(0, 7),
          revenue: { gross: 0, stripe_fees: 0, net: 0 },
          costs: {
            google_ads: { mtd: 0, daily_avg: 0 },
            openai_api: { mtd: 0, today: 0 },
            claude_api: { mtd: 0, today: 0, total_calls: 0 },
            heroku: { mtd: 0 },
            supabase: { mtd: 0 },
            tools: { mtd: 0 },
            total: 0
          },
          margin: { net_revenue: 0, total_costs: 0, profit: 0, margin_pct: 0 },
          burn_rate_daily: 0,
          break_even: false,
          error: error.message || 'Failed to fetch costs data'
        });
      })
    );
  }
}
