import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface HoaNewsArticle {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  published_date: string;
  relevance_score: number;
  category: string;
  sentiment: string;
  key_takeaways: string[];
  status: 'new' | 'reviewed' | 'archived';
  created_at: string;
}

export interface HoaNewsResponse {
  articles: HoaNewsArticle[];
  count: number;
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class HoaIntelService {
  private readonly apiUrl = '/api/dashboard/hoa-news';

  constructor(private http: HttpClient) {}

  getArticles(status?: string): Observable<HoaNewsResponse> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<HoaNewsResponse>(`${this.apiUrl}${params}`).pipe(
      catchError(error => {
        console.error('HOA intel service error:', error);
        return of({ articles: [], count: 0, lastUpdated: '' });
      })
    );
  }

  scanNews(): Observable<HoaNewsResponse> {
    return this.http.post<HoaNewsResponse>(this.apiUrl, { action: 'scan' }).pipe(
      catchError(error => {
        console.error('HOA intel scan error:', error);
        throw error;
      })
    );
  }

  updateStatus(id: string, status: 'new' | 'reviewed' | 'archived'): Observable<{ article: HoaNewsArticle }> {
    return this.http.patch<{ article: HoaNewsArticle }>(this.apiUrl, { id, status }).pipe(
      catchError(error => {
        console.error('HOA intel status update error:', error);
        throw error;
      })
    );
  }
}
