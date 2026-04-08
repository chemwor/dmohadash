import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface Lead {
  id: string;
  post_id: string;
  subreddit: string;
  title: string;
  url: string;
  score: number;
  status: string;
  replied_at: string | null;
  created_utc: string;
  inserted_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeadsService {
  private readonly apiUrl = '/api/dashboard/leads';
  private readonly scraperUrl = '/api/dashboard/leads/run-scraper';

  constructor(private http: HttpClient) {}

  getLeads(status?: string, limit = 50): Observable<Lead[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (status && status !== 'all') {
      params = params.set('status', status);
    }
    return this.http.get<Lead[]>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('LeadsService getLeads error:', error);
        return of([]);
      })
    );
  }

  updateStatus(id: string, status: string): Observable<Lead> {
    return this.http.patch<Lead>(`${this.apiUrl}/${id}`, { status });
  }

  runScraper(): Observable<{ ok: boolean; stdout?: string; stderr?: string; error?: string }> {
    return this.http.post<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>(
      this.scraperUrl, {}
    ).pipe(
      catchError(error => {
        console.error('LeadsService runScraper error:', error);
        return of({ ok: false, error: error.message || 'Failed to run scraper' });
      })
    );
  }
}
