import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface ResendWindow {
  total: number;
  counts: {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    opened: number;
    clicked: number;
    queued: number;
    unknown: number;
  };
  delivery_rate_pct: number;
  bounce_rate_pct: number;
}

export interface FunnelWindow {
  total_unique: number;
  by_stage: { [stage: string]: number };
  nudges_sent: number;
  period: string;
}

export interface RecentSend {
  id: string;
  to: string;
  from: string;
  subject: string;
  last_event: string;
  created_at: string;
}

export interface EmailDashboardData {
  resend: { today: ResendWindow; yesterday: ResendWindow; week: ResendWindow };
  funnel: { today: FunnelWindow; yesterday: FunnelWindow; week: FunnelWindow };
  recent_sends: RecentSend[];
  has_full_access: boolean;
}

const EMPTY_WINDOW: ResendWindow = {
  total: 0,
  counts: { sent: 0, delivered: 0, bounced: 0, complained: 0, opened: 0, clicked: 0, queued: 0, unknown: 0 },
  delivery_rate_pct: 0,
  bounce_rate_pct: 0,
};

const EMPTY_FUNNEL: FunnelWindow = { total_unique: 0, by_stage: {}, nudges_sent: 0, period: '' };

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly apiUrl = '/api/dashboard/email';

  constructor(private http: HttpClient) {}

  getData(): Observable<EmailDashboardData> {
    return this.http.get<EmailDashboardData>(this.apiUrl).pipe(
      catchError(() => of({
        resend: { today: EMPTY_WINDOW, yesterday: EMPTY_WINDOW, week: EMPTY_WINDOW },
        funnel: { today: EMPTY_FUNNEL, yesterday: EMPTY_FUNNEL, week: EMPTY_FUNNEL },
        recent_sends: [],
        has_full_access: false,
      }))
    );
  }
}
