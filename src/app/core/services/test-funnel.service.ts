import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface FunnelRow {
  id: string;
  email: string;
  stage: string;
  stage_completed_at: string;
  nudge_1_sent: boolean;
  nudge_2_sent: boolean;
  nudge_3_sent: boolean;
  purchased: boolean;
  created_at: string;
}

export interface TestCase {
  id: string;
  token: string;
  email: string;
  status: string;
  created_at: string;
  has_plan: boolean;
  funnel: FunnelRow | null;
}

export interface CreateResult {
  ok: boolean;
  token?: string;
  email?: string;
  case?: any;
  funnel_advanced?: boolean;
  message?: string;
  error?: string;
}

export interface NudgeResult {
  ok: boolean;
  nudge_1_sent?: number;
  nudge_2_sent?: number;
  nudge_3_sent?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TestFunnelService {
  private readonly base = '/api/dashboard/test-funnel';

  constructor(private http: HttpClient) {}

  create(email: string): Observable<CreateResult> {
    return this.http.post<CreateResult>(`${this.base}/create`, { email }).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message || 'Create failed' }))
    );
  }

  list(): Observable<{ cases: TestCase[] }> {
    return this.http.get<{ cases: TestCase[] }>(this.base).pipe(
      catchError(err => of({ cases: [] }))
    );
  }

  advance(token: string, stage: 'full_preview_viewed' | 'purchased'): Observable<any> {
    return this.http.post(`${this.base}/${token}/advance`, { stage }).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message }))
    );
  }

  generatePlan(token: string): Observable<any> {
    return this.http.post(`${this.base}/${token}/generate-plan`, {}).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message }))
    );
  }

  regeneratePreview(token: string): Observable<any> {
    return this.http.post(`${this.base}/${token}/regenerate-preview`, {}).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message }))
    );
  }

  planStatus(token: string): Observable<any> {
    return this.http.get(`${this.base}/${token}/plan-status`).pipe(
      catchError(err => of({ has_plan: false, error: err?.error?.error || err.message }))
    );
  }

  runNudges(): Observable<NudgeResult> {
    return this.http.post<NudgeResult>(`${this.base}/run-nudges`, {}).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message || 'Nudge run failed' }))
    );
  }

  deleteOne(token: string): Observable<any> {
    return this.http.delete(`${this.base}/${token}`).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message }))
    );
  }

  deleteAll(): Observable<any> {
    return this.http.delete(this.base).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message }))
    );
  }

  previewEmail(template: string, link?: string): Observable<{ template: string; subject: string; body: string; link_used?: string; error?: string }> {
    const params = link ? `?link=${encodeURIComponent(link)}` : '';
    return this.http.get<any>(`${this.base}/email-preview/${template}${params}`).pipe(
      catchError(err => of({ template, subject: '', body: '', error: err?.error?.error || err.message }))
    );
  }

  sendTestEmail(template: string, to: string, link?: string): Observable<{ ok: boolean; message?: string; subject?: string; error?: string }> {
    return this.http.post<any>(`${this.base}/send-test-email`, { template, to, link }).pipe(
      catchError(err => of({ ok: false, error: err?.error?.error || err.message || 'Send failed' }))
    );
  }
}
