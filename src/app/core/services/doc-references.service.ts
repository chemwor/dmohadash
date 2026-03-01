import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { DocReference } from '../../interfaces/dashboard.interfaces';

@Injectable({
  providedIn: 'root'
})
export class DocReferencesService {
  private readonly apiUrl = '/api/dashboard/doc-references';

  constructor(private http: HttpClient) {}

  getAll(): Observable<DocReference[]> {
    return this.http.get<DocReference[]>(this.apiUrl).pipe(
      catchError(error => {
        console.error('Doc references service error:', error);
        return of([]);
      })
    );
  }

  refresh(docKey: string): Observable<DocReference> {
    return this.http.post<DocReference>(`${this.apiUrl}/refresh`, { doc_key: docKey }).pipe(
      catchError(error => {
        console.error('Doc reference refresh error:', error);
        throw error;
      })
    );
  }
}
