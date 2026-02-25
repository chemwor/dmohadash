import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface FlowStats {
  name: string;
  status: string;
  sends: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
}

export interface KlaviyoList {
  id: string;
  name: string;
  count: number;
}

export interface KlaviyoData {
  totalProfiles: number;        // All emails in the platform
  totalEmailsInFlow: number;    // Combined list count (Full + Quick)
  fullPreviewEmails: number;
  quickPreviewEmails: number;
  emailsCollectedToday: number;
  lists: KlaviyoList[];
  flowStats: FlowStats[];
  totalFlows: number;
  isMockData?: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class KlaviyoService {
  private readonly apiUrl = '/api/klaviyo';

  constructor(private http: HttpClient) {}

  getData(): Observable<KlaviyoData> {
    return this.http.get<KlaviyoData>(this.apiUrl).pipe(
      catchError(error => {
        console.error('Klaviyo service error:', error);
        return of({
          totalProfiles: 0,
          totalEmailsInFlow: 0,
          fullPreviewEmails: 0,
          quickPreviewEmails: 0,
          emailsCollectedToday: 0,
          lists: [],
          flowStats: [],
          totalFlows: 0,
          error: error.message || 'Failed to fetch Klaviyo data'
        });
      })
    );
  }
}
