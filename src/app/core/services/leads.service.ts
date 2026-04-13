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
  upvotes: number;
  num_comments: number;
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

  checkReplies(): Observable<{ ok: boolean; threads_checked?: number; replies?: any[]; errors?: string[] }> {
    return this.http.post<any>(`${this.apiUrl}/check-replies`, {}).pipe(
      catchError(err => of({ ok: false, replies: [], error: err.message }))
    );
  }

  draftFollowUp(leadId: string, theirReply: string, threadContext?: string): Observable<{ ok: boolean; reply?: string; error?: string }> {
    return this.http.post<any>(`${this.apiUrl}/${leadId}/draft-follow-up`, {
      their_reply: theirReply,
      thread_context: threadContext || '',
    }).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message }))
    );
  }

  getDailyStats(): Observable<{ replied_today: number; goal: number }> {
    return this.http.get<{ replied_today: number; goal: number }>(`${this.apiUrl}/daily-stats`).pipe(
      catchError(() => of({ replied_today: 0, goal: 10 }))
    );
  }

  draftReply(id: string, extraContext?: string): Observable<{ ok: boolean; reply?: string; reddit_url?: string; title?: string; error?: string }> {
    return this.http.post<any>(`${this.apiUrl}/${id}/draft-reply`, {
      extra_context: extraContext || ''
    }).pipe(
      catchError(error => {
        console.error('LeadsService draftReply error:', error);
        return of({ ok: false, error: error?.error?.error || error.message || 'Draft failed' });
      })
    );
  }

  runScraper(): Observable<{ ok: boolean; message?: string; error?: string }> {
    return this.http.post<{ ok: boolean; message?: string; error?: string }>(
      this.scraperUrl, {}
    ).pipe(
      catchError(error => {
        console.error('LeadsService runScraper error:', error);
        return of({ ok: false, error: error.message || 'Failed to run scraper' });
      })
    );
  }
}
