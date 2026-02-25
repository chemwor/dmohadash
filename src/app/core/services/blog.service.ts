import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface BlogIdea {
  id: string;
  title: string;
  description: string;
  angle: string;
  target_keywords: string[];
  source_article_ids: string[];
  status: 'pending' | 'approved' | 'rejected' | 'generating' | 'generated';
  generated_blog_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
  category: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  source_article_ids: string[];
  topic_hash: string;
  author: string;
  read_time_minutes: number;
  view_count: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface IdeasResponse {
  ideas: BlogIdea[];
  count: number;
  articlesAnalyzed?: number;
  message?: string;
}

export interface BlogsResponse {
  blogs: BlogPost[];
  count: number;
}

export interface GenerateBlogResponse {
  blog: BlogPost;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private readonly apiUrl = '/api/blog-generator';
  private readonly backgroundApiUrl = '/api/blog-generator-background';

  constructor(private http: HttpClient) {}

  // Ideas
  getIdeas(status?: string): Observable<IdeasResponse> {
    const params = status ? `?type=ideas&status=${status}` : '?type=ideas';
    return this.http.get<IdeasResponse>(`${this.apiUrl}${params}`).pipe(
      catchError(error => {
        console.error('Error fetching ideas:', error);
        return of({ ideas: [], count: 0 });
      })
    );
  }

  generateIdeas(): Observable<IdeasResponse> {
    return this.http.post<IdeasResponse>(this.apiUrl, { action: 'generate-ideas' }).pipe(
      catchError(error => {
        console.error('Error generating ideas:', error);
        throw error;
      })
    );
  }

  // Background function version - returns immediately, processes async
  generateIdeasBackground(): Observable<any> {
    return this.http.post(this.backgroundApiUrl, { action: 'generate-ideas' }).pipe(
      catchError(error => {
        console.error('Error starting background idea generation:', error);
        throw error;
      })
    );
  }

  updateIdeaStatus(id: string, status: 'pending' | 'approved' | 'rejected'): Observable<{ idea: BlogIdea }> {
    return this.http.patch<{ idea: BlogIdea }>(this.apiUrl, { type: 'idea', id, status }).pipe(
      catchError(error => {
        console.error('Error updating idea:', error);
        throw error;
      })
    );
  }

  deleteIdea(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}?type=idea&id=${id}`).pipe(
      catchError(error => {
        console.error('Error deleting idea:', error);
        throw error;
      })
    );
  }

  // Generate blog from idea
  generateBlogFromIdea(ideaId: string): Observable<GenerateBlogResponse> {
    return this.http.post<GenerateBlogResponse>(this.apiUrl, { action: 'generate-blog', ideaId }).pipe(
      catchError(error => {
        console.error('Error generating blog:', error);
        throw error;
      })
    );
  }

  // Background function version - returns immediately, processes async
  generateBlogFromIdeaBackground(ideaId: string): Observable<any> {
    return this.http.post(this.backgroundApiUrl, { action: 'generate-blog', ideaId }).pipe(
      catchError(error => {
        console.error('Error starting background blog generation:', error);
        throw error;
      })
    );
  }

  // Blogs
  getBlogs(status?: string): Observable<BlogsResponse> {
    const params = status ? `?type=blogs&status=${status}` : '?type=blogs';
    return this.http.get<BlogsResponse>(`${this.apiUrl}${params}`).pipe(
      catchError(error => {
        console.error('Error fetching blogs:', error);
        return of({ blogs: [], count: 0 });
      })
    );
  }

  updateBlogStatus(id: string, status: 'draft' | 'published' | 'archived'): Observable<{ blog: BlogPost }> {
    return this.http.patch<{ blog: BlogPost }>(this.apiUrl, { type: 'blog', id, status }).pipe(
      catchError(error => {
        console.error('Error updating blog:', error);
        throw error;
      })
    );
  }

  deleteBlog(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}?type=blog&id=${id}`).pipe(
      catchError(error => {
        console.error('Error deleting blog:', error);
        throw error;
      })
    );
  }

  // Helpers
  getIdeaStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'text-amber-400';
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'generating': return 'text-blue-400';
      case 'generated': return 'text-indigo-400';
      default: return 'text-slate-400';
    }
  }

  getIdeaStatusBgColor(status: string): string {
    switch (status) {
      case 'pending': return 'bg-amber-500/20';
      case 'approved': return 'bg-green-500/20';
      case 'rejected': return 'bg-red-500/20';
      case 'generating': return 'bg-blue-500/20';
      case 'generated': return 'bg-indigo-500/20';
      default: return 'bg-slate-500/20';
    }
  }

  getBlogStatusColor(status: string): string {
    switch (status) {
      case 'published': return 'text-green-400';
      case 'draft': return 'text-amber-400';
      case 'archived': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  }

  getBlogStatusBgColor(status: string): string {
    switch (status) {
      case 'published': return 'bg-green-500/20';
      case 'draft': return 'bg-amber-500/20';
      case 'archived': return 'bg-slate-500/20';
      default: return 'bg-slate-500/20';
    }
  }
}
