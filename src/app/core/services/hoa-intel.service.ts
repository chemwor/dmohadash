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
  notes?: string | null;
}

export interface NotesAnalysisResponse {
  feature_ideas: { title: string; description: string; priority: string }[];
  key_points: string[];
  business_analysis: string;
  articles_analyzed: number;
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

  getArticlesWithNotes(): Observable<HoaNewsResponse> {
    return this.http.get<HoaNewsResponse>(`${this.apiUrl}?hasNotes=true`).pipe(
      catchError(error => {
        console.error('HOA intel notes fetch error:', error);
        return of({ articles: [], count: 0, lastUpdated: '' });
      })
    );
  }

  saveNotes(id: string, notes: string): Observable<{ success: boolean; article: HoaNewsArticle }> {
    return this.http.patch<{ success: boolean; article: HoaNewsArticle }>(this.apiUrl, {
      id, action: 'saveNotes', notes
    }).pipe(
      catchError(error => {
        console.error('HOA intel save notes error:', error);
        throw error;
      })
    );
  }

  analyzeNotes(): Observable<NotesAnalysisResponse> {
    return this.http.post<NotesAnalysisResponse>(`${this.apiUrl}/analyze-notes`, {}).pipe(
      catchError(error => {
        console.error('HOA intel analyze notes error:', error);
        throw error;
      })
    );
  }
}
