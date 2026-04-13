import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface VideoIdea {
  id: string;
  type: string;
  scenario: string;
  violation_type: string;
  fine_amount: number;
  status: string;
  created_at: string;
}

export interface KlingTts {
  voice_type: string;
  speed: string;
  emotion: string;
  notes: string;
}

export interface ShotPrompt {
  shot_number: number;
  character: string;
  dialogue?: string;
  line?: string; // legacy compat
  duration?: number;
  duration_seconds?: number;
  kling_prompt: string;
  kling_tts?: KlingTts;
}

export interface VideoPrompt {
  id: string;
  video_idea_id: string;
  shots: ShotPrompt[];
  script: string;
  shot_count: number;
  total_duration: number;
  status: string;
  created_at: string;
}

export interface VideoAsset {
  id: string;
  video_idea_id: string;
  shot_number: number;
  kling_job_id: string | null;
  file_url: string | null;
  duration: number;
  status: string;
  created_at: string;
}

export interface PlatformCopy {
  caption?: string;
  hashtags?: string[];
  title?: string;
  description?: string;
  tags?: string[];
}

export interface VideoPost {
  id: string;
  video_idea_id: string;
  final_video_url: string | null;
  platforms: string[];
  copy: Record<string, PlatformCopy>;
  status: string;
  scheduled_at: string | null;
  created_at: string;
}

export interface IdeaWithRelations extends VideoIdea {
  prompt?: VideoPrompt;
  assets?: VideoAsset[];
  post?: VideoPost;
}

export interface GeneratedIdea {
  scenario: string;
  violation_type: string;
  fine_amount: number;
  viral_hook?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private readonly functionsUrl = '/api';

  constructor(private http: HttpClient) {}

  // --- Supabase CRUD via direct Netlify function proxy ---

  getIdeas(status?: string): Observable<VideoIdea[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<VideoIdea[]>(`${this.functionsUrl}/content-data`, { params }).pipe(
      catchError(error => {
        console.error('ContentService getIdeas error:', error);
        return of([]);
      })
    );
  }

  getIdea(id: string): Observable<IdeaWithRelations> {
    return this.http.get<IdeaWithRelations>(`${this.functionsUrl}/content-data?id=${id}`).pipe(
      catchError(error => {
        console.error('ContentService getIdea error:', error);
        return of({
          id: '', type: '', scenario: '', violation_type: '',
          fine_amount: 0, status: 'idea', created_at: ''
        });
      })
    );
  }

  saveIdea(idea: { type: string; scenario: string; violation_type: string; fine_amount: number }): Observable<VideoIdea> {
    return this.http.post<VideoIdea>(`${this.functionsUrl}/content-data`, {
      action: 'save_idea',
      ...idea
    }).pipe(
      catchError(error => {
        console.error('ContentService saveIdea error:', error);
        throw error;
      })
    );
  }

  // --- AI generation via dedicated functions ---

  generateIdeas(type: string, seed?: string): Observable<{ ideas: GeneratedIdea[] }> {
    return this.http.post<{ ideas: GeneratedIdea[] }>(`${this.functionsUrl}/content-ideas`, {
      type,
      seed
    }).pipe(
      catchError(error => {
        console.error('ContentService generateIdeas error:', error);
        return of({ ideas: [] });
      })
    );
  }

  generatePrompts(videoIdeaId: string): Observable<VideoPrompt> {
    return this.http.post<VideoPrompt>(`${this.functionsUrl}/content-prompts`, {
      video_idea_id: videoIdeaId
    }).pipe(
      catchError(error => {
        console.error('ContentService generatePrompts error:', error);
        throw error;
      })
    );
  }

  regeneratePrompts(videoIdeaId: string): Observable<VideoPrompt> {
    // Same endpoint as generatePrompts — the backend creates a new prompt record
    return this.generatePrompts(videoIdeaId);
  }

  generateCopy(videoIdeaId: string, platforms: string[]): Observable<Record<string, PlatformCopy>> {
    return this.http.post<Record<string, PlatformCopy>>(`${this.functionsUrl}/content-copy`, {
      video_idea_id: videoIdeaId,
      platforms
    }).pipe(
      catchError(error => {
        console.error('ContentService generateCopy error:', error);
        return of({});
      })
    );
  }

  // --- Status updates via content-data function ---

  updatePrompt(id: string, shots: ShotPrompt[]): Observable<VideoPrompt> {
    return this.http.post<VideoPrompt>(`${this.functionsUrl}/content-data`, {
      action: 'update_prompt',
      id,
      shots
    });
  }

  approvePrompts(videoIdeaId: string): Observable<void> {
    return this.http.post<void>(`${this.functionsUrl}/content-data`, {
      action: 'approve_prompts',
      video_idea_id: videoIdeaId
    });
  }

  updateAsset(id: string, updates: Partial<VideoAsset>): Observable<VideoAsset> {
    return this.http.post<VideoAsset>(`${this.functionsUrl}/content-data`, {
      action: 'update_asset',
      id,
      ...updates
    });
  }

  updateIdeaStatus(id: string, status: string): Observable<void> {
    return this.http.post<void>(`${this.functionsUrl}/content-data`, {
      action: 'update_idea_status',
      id,
      status
    });
  }

  savePost(post: { video_idea_id: string; platforms: string[]; copy: Record<string, PlatformCopy>; final_video_url?: string }): Observable<VideoPost> {
    return this.http.post<VideoPost>(`${this.functionsUrl}/content-data`, {
      action: 'save_post',
      ...post
    });
  }

  updateVideoUrl(postId: string, finalVideoUrl: string): Observable<VideoPost> {
    return this.http.post<VideoPost>(`${this.functionsUrl}/content-data`, {
      action: 'update_video_url',
      id: postId,
      final_video_url: finalVideoUrl
    });
  }

  updateCopy(id: string, copy: Record<string, PlatformCopy>): Observable<VideoPost> {
    return this.http.post<VideoPost>(`${this.functionsUrl}/content-data`, {
      action: 'update_copy',
      id,
      copy
    });
  }

  approveCopy(videoIdeaId: string): Observable<void> {
    return this.http.post<void>(`${this.functionsUrl}/content-data`, {
      action: 'approve_copy',
      video_idea_id: videoIdeaId
    });
  }

  publishPlatform(videoPostId: string, platform: string): Observable<void> {
    // TODO: Wire in TikTok/Meta/YouTube API calls in a future phase
    return this.http.post<void>(`${this.functionsUrl}/content-data`, {
      action: 'publish_platform',
      id: videoPostId,
      platform
    });
  }

  createAssets(videoIdeaId: string, shots: ShotPrompt[]): Observable<VideoAsset[]> {
    return this.http.post<VideoAsset[]>(`${this.functionsUrl}/content-data`, {
      action: 'create_assets',
      video_idea_id: videoIdeaId,
      shots
    });
  }

  // --- Kling video generation ---

  generateVideos(videoIdeaId: string): Observable<{ assets: VideoAsset[] }> {
    return this.http.post<{ assets: VideoAsset[] }>(`${this.functionsUrl}/content-kling`, {
      action: 'generate',
      video_idea_id: videoIdeaId
    }).pipe(
      catchError(error => {
        console.error('ContentService generateVideos error:', error);
        throw error;
      })
    );
  }

  checkVideoStatus(videoIdeaId: string): Observable<{ assets: VideoAsset[]; all_complete: boolean }> {
    return this.http.post<{ assets: VideoAsset[]; all_complete: boolean }>(`${this.functionsUrl}/content-kling`, {
      action: 'check_status',
      video_idea_id: videoIdeaId
    }).pipe(
      catchError(error => {
        console.error('ContentService checkVideoStatus error:', error);
        return of({ assets: [], all_complete: false });
      })
    );
  }

  regenerateShot(assetId: string): Observable<VideoAsset> {
    return this.http.post<VideoAsset>(`${this.functionsUrl}/content-kling`, {
      action: 'regenerate_shot',
      asset_id: assetId
    }).pipe(
      catchError(error => {
        console.error('ContentService regenerateShot error:', error);
        throw error;
      })
    );
  }
}
