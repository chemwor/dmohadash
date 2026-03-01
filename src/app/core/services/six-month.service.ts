import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { SixMonthPlan } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class SixMonthService {
  private readonly apiUrl = '/api/dashboard/six-month';

  constructor(private http: HttpClient) {}

  get(): Observable<SixMonthPlan> {
    return this.http.get<SixMonthPlan>(this.apiUrl).pipe(
      catchError(error => {
        console.error('Six-month plan service error:', error);
        return of({
          current_month: 1,
          months: [],
          current_grades: {
            traffic: {
              monthly_visitors: { value: 0, grade: 'F' },
              google_ads_ctr: { value: 0, grade: 'F' },
              organic_share: { value: 0, grade: 'F' }
            },
            conversion: {
              site_conversion: { value: 0, grade: 'F' },
              email_open_rate: { value: 0, grade: 'F' },
              preview_to_paid: { value: 0, grade: 'F' }
            },
            revenue: {
              monthly_revenue: { value: 0, grade: 'F' },
              cac_ltv_ratio: { value: 0, grade: 'F' },
              roas: { value: 0, grade: 'F' }
            }
          },
          scenario: {
            current: 'ugly' as const,
            label: '',
            f_count_by_category: {},
            pivot_triggered: false,
            pivot_reason: ''
          },
          overall_progress: 0,
          error: error.message || 'Failed to fetch six-month plan'
        });
      })
    );
  }
}
