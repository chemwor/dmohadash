import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface AdProposal {
  id: string;
  type: 'pause_keyword' | 'add_negative' | 'budget_alert' | string;
  payload: Record<string, any>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
  apply_result: any;
  created_at: string;
  resolved_at: string | null;
}

export interface LaunchResult {
  ok: boolean;
  message?: string;
  error?: string;
  summary?: any;
  existing?: any;
}

export interface AnalyzeResult {
  ok: boolean;
  proposals_created?: number;
  errors?: string[];
  analyzed_at?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdOptimizerService {
  private readonly base = '/api/dashboard/google-ads';

  constructor(private http: HttpClient) {}

  launchM1(): Observable<LaunchResult> {
    return this.http.post<LaunchResult>(`${this.base}/launch-m1`, {}).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message || 'Launch failed' }))
    );
  }

  analyze(): Observable<AnalyzeResult> {
    return this.http.post<AnalyzeResult>(`${this.base}/analyze`, {}).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message || 'Analyze failed' }))
    );
  }

  listProposals(status: string = 'pending'): Observable<AdProposal[]> {
    return this.http.get<AdProposal[]>(`${this.base}/proposals?status=${status}`).pipe(
      catchError(err => {
        console.error('listProposals error', err);
        return of([]);
      })
    );
  }

  approveProposal(id: string): Observable<{ ok: boolean; result?: any }> {
    return this.http.post<{ ok: boolean; result?: any }>(`${this.base}/proposals/${id}/approve`, {});
  }

  rejectProposal(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/proposals/${id}/reject`, {});
  }
}
