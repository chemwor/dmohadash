import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { AlertsResponse, Alert, AlertScanResponse, AlertSeverity } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private readonly apiUrl = '/api/dashboard/alerts';

  constructor(private http: HttpClient) {}

  getAll(filters?: { severity?: AlertSeverity; acknowledged?: boolean }): Observable<AlertsResponse> {
    let params = new HttpParams();
    if (filters?.severity) params = params.set('severity', filters.severity);
    if (filters?.acknowledged !== undefined) params = params.set('acknowledged', String(filters.acknowledged));

    return this.http.get<AlertsResponse>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Alerts service error:', error);
        return of({
          alerts: [],
          unacknowledged_counts: { critical: 0, warning: 0, info: 0 }
        });
      })
    );
  }

  acknowledge(id: string): Observable<Alert> {
    return this.http.patch<Alert>(`${this.apiUrl}/${id}/ack`, {}).pipe(
      catchError(error => {
        console.error('Alert acknowledge error:', error);
        throw error;
      })
    );
  }

  scan(): Observable<AlertScanResponse> {
    return this.http.post<AlertScanResponse>(`${this.apiUrl}/scan`, {}).pipe(
      catchError(error => {
        console.error('Alert scan error:', error);
        throw error;
      })
    );
  }
}
