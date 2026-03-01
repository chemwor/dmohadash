import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface HoaNewsArticle {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  source_url?: string;
  link?: string;
  source_name?: string;
  source?: string;
  published_date?: string;
  pubDate?: string;
  timestamp?: string;
  created_at?: string;
  relevance_score?: number;
  category: string;
  sentiment?: string;
  priority?: string;
  key_takeaways?: string[];
  status: 'new' | 'reviewed' | 'archived';
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

  getArticles(status?: string, category?: string): Observable<HoaNewsResponse> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    const qs = params.toString();
    const url = qs ? `${this.apiUrl}?${qs}` : this.apiUrl;
    return this.http.get<HoaNewsResponse>(url).pipe(
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
