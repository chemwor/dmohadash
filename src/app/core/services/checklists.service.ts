import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { ChecklistItem, ChecklistCategory, ChecklistStatus, SeedChecklistsResponse } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ChecklistsService {
  private readonly apiUrl = '/api/dashboard/checklists';

  constructor(private http: HttpClient) {}

  getAll(filters?: { category?: ChecklistCategory; status?: ChecklistStatus; month?: number }): Observable<ChecklistItem[]> {
    let params = new HttpParams();
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.month) params = params.set('month', filters.month.toString());

    return this.http.get<ChecklistItem[]>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Checklists service error:', error);
        return of([]);
      })
    );
  }

  update(id: string, data: Partial<ChecklistItem>): Observable<ChecklistItem> {
    return this.http.patch<ChecklistItem>(`${this.apiUrl}/${id}`, data).pipe(
      catchError(error => {
        console.error('Checklist update error:', error);
        throw error;
      })
    );
  }

  seed(): Observable<SeedChecklistsResponse> {
    return this.http.post<SeedChecklistsResponse>(`${this.apiUrl}/seed`, {}).pipe(
      catchError(error => {
        console.error('Checklist seed error:', error);
        throw error;
      })
    );
  }
}
