import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface StripeTransaction {
  id: string;
  amount: number;
  status: string;
  created: string;
  description: string;
  refunded: boolean;
  name: string | null;
  email: string | null;
}

export interface StripeRefunds {
  count: number;
  amount: number;
}

export interface StripeData {
  revenue: number;
  transactions: number;
  refunds: StripeRefunds;
  mrr: number;
  recentTransactions: StripeTransaction[];
  period: string;
  error?: string;
}

export type StripePeriod = 'today' | 'week' | 'month';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private readonly apiUrl = '/api/dashboard/stripe';

  constructor(private http: HttpClient) {}

  getData(period: StripePeriod = 'today'): Observable<StripeData> {
    const params = new HttpParams().set('period', period);

    return this.http.get<StripeData>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Stripe service error:', error);
        return of({
          revenue: 0,
          transactions: 0,
          refunds: { count: 0, amount: 0 },
          mrr: 0,
          recentTransactions: [],
          period,
          error: error.message || 'Failed to fetch Stripe data'
        });
      })
    );
  }
}
