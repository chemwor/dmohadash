import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { CommandCenterData } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class CommandCenterService {
  private readonly apiUrl = '/api/dashboard/command-center';

  constructor(private http: HttpClient) {}

  getData(): Observable<CommandCenterData> {
    return this.http.get<CommandCenterData>(this.apiUrl).pipe(
      catchError(error => {
        console.error('Command center service error:', error);
        return of({
          revenue: { today: 0, week: 0, month: 0 },
          cases: { new_today: 0, paid_today: 0, pending_analysis: 0, conversion_rate_7d: 0 },
          alerts: { critical: 0, warning: 0, info: 0, total_unacknowledged: 0 },
          checklists: { done: 0, total: 0, pct: 0, top_pending: [] },
          health: { site_up: false, site_response_ms: 0, last_scan: '' },
          quick_stats: { klaviyo_list_size: 0, ads_spend_today: 0, ads_cpa_today: 0 },
          daily_summary_preview: '',
          error: error.message || 'Failed to fetch command center data'
        });
      })
    );
  }
}
