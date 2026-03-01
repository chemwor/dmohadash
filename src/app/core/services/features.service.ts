import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { FeatureRequest, FeatureStatus, FeaturePromptResponse } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class FeaturesService {
  private readonly apiUrl = '/api/dashboard/features';

  constructor(private http: HttpClient) {}

  getAll(status?: FeatureStatus): Observable<FeatureRequest[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);

    return this.http.get<FeatureRequest[]>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Features service error:', error);
        return of([]);
      })
    );
  }

  create(feature: { title: string; description: string; target_repo: string; estimated_effort: string; priority: string; source?: string }): Observable<FeatureRequest> {
    return this.http.post<FeatureRequest>(this.apiUrl, feature).pipe(
      catchError(error => {
        console.error('Feature create error:', error);
        throw error;
      })
    );
  }

  update(id: string, data: Partial<FeatureRequest>): Observable<FeatureRequest> {
    return this.http.patch<FeatureRequest>(`${this.apiUrl}/${id}`, data).pipe(
      catchError(error => {
        console.error('Feature update error:', error);
        throw error;
      })
    );
  }

  generatePrompt(id: string): Observable<FeaturePromptResponse> {
    return this.http.post<FeaturePromptResponse>(`${this.apiUrl}/${id}/prompt`, {}).pipe(
      catchError(error => {
        console.error('Feature prompt generation error:', error);
        throw error;
      })
    );
  }
}
