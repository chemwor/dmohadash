import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface FunnelMetrics {
  total: number;
  stages: {
    quick_preview_complete: number;
    full_preview_viewed: number;
    purchased: number;
  };
  reached: {
    quick_preview: number;
    full_preview: number;
    purchased: number;
  };
  nudges: {
    nudge_1_sent: number;
    nudge_2_sent: number;
    nudge_3_sent: number;
  };
  conversion_rates: {
    quick_to_full: number;
    full_to_purchased: number;
    overall: number;
  };
  purchased_count: number;
  revenue_estimate: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailFunnelService {
  private readonly apiUrl = '/api/dashboard/email-funnel-metrics';

  constructor(private http: HttpClient) {}

  getMetrics(): Observable<FunnelMetrics> {
    return this.http.get<FunnelMetrics>(this.apiUrl).pipe(
      catchError(() => of({
        total: 0,
        stages: { quick_preview_complete: 0, full_preview_viewed: 0, purchased: 0 },
        reached: { quick_preview: 0, full_preview: 0, purchased: 0 },
        nudges: { nudge_1_sent: 0, nudge_2_sent: 0, nudge_3_sent: 0 },
        conversion_rates: { quick_to_full: 0, full_to_purchased: 0, overall: 0 },
        purchased_count: 0,
        revenue_estimate: 0,
      }))
    );
  }
}
