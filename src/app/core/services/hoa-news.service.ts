import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export type ArticleCategory = 'legislation' | 'enforcement' | 'legal' | 'financial' | 'general';
export type ArticlePriority = 'high' | 'medium' | 'low';

export interface HOAArticle {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  query?: string;
  fetchedFrom: 'google_news' | 'direct_feed';
  category: ArticleCategory;
  priority: ArticlePriority;
  timestamp: string;
  bookmarked: boolean;
  usedForContent: boolean;
  dismissed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface NewsStats {
  total: number;
  byCategory: {
    legislation: number;
    enforcement: number;
    legal: number;
    financial: number;
    general: number;
  };
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  sources: number;
  bookmarked: number;
  usedForContent: number;
}

export interface HOANewsData {
  articles: HOAArticle[];
  stats: NewsStats;
  lastUpdated: string;
  queriesUsed: string[];
  fromDatabase?: boolean;
  error?: string;
}

export type ArticleAction = 'bookmark' | 'unbookmark' | 'dismiss' | 'undismiss' | 'markUsed' | 'unmarkUsed';

@Injectable({
  providedIn: 'root'
})
export class HOANewsService {
  private readonly apiUrl = '/api/hoa-news';

  constructor(private http: HttpClient) {}

  getData(forceRefresh = false, options?: { bookmarkedOnly?: boolean; includeDismissed?: boolean }): Observable<HOANewsData> {
    const params = new URLSearchParams();

    if (forceRefresh) {
      params.append('refresh', 'true');
    }
    if (options?.bookmarkedOnly) {
      params.append('bookmarked', 'true');
    }
    if (options?.includeDismissed) {
      params.append('includeDismissed', 'true');
    }

    const url = params.toString() ? `${this.apiUrl}?${params.toString()}` : this.apiUrl;

    return this.http.get<HOANewsData>(url).pipe(
      catchError(error => {
        console.error('HOA News service error:', error);
        return of({
          articles: [],
          stats: {
            total: 0,
            byCategory: {
              legislation: 0,
              enforcement: 0,
              legal: 0,
              financial: 0,
              general: 0,
            },
            byPriority: {
              high: 0,
              medium: 0,
              low: 0,
            },
            sources: 0,
            bookmarked: 0,
            usedForContent: 0,
          },
          lastUpdated: new Date().toISOString(),
          queriesUsed: [],
          error: error.message || 'Failed to fetch HOA news'
        });
      })
    );
  }

  updateArticle(articleId: string, action: ArticleAction): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(this.apiUrl, { articleId, action }).pipe(
      catchError(error => {
        console.error('Error updating article:', error);
        return of({ success: false });
      })
    );
  }

  bookmarkArticle(articleId: string, bookmarked: boolean): Observable<{ success: boolean }> {
    return this.updateArticle(articleId, bookmarked ? 'bookmark' : 'unbookmark');
  }

  dismissArticle(articleId: string, dismissed: boolean): Observable<{ success: boolean }> {
    return this.updateArticle(articleId, dismissed ? 'dismiss' : 'undismiss');
  }

  markAsUsedForContent(articleId: string, used: boolean): Observable<{ success: boolean }> {
    return this.updateArticle(articleId, used ? 'markUsed' : 'unmarkUsed');
  }
}
