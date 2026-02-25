import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, Subject, interval, Subscription } from 'rxjs';
import { Campaign, Keyword, SearchTerm, AdCopy } from './google-ads.service';

export interface KeywordSuggestion {
  action: 'add' | 'pause' | 'modify';
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface NegativeKeywordSuggestion {
  keyword: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AdCopySuggestion {
  type: 'headline' | 'description';
  current: string | null;
  suggested: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GeneralRecommendation {
  recommendation: string;
  category: 'budget' | 'targeting' | 'bidding' | 'creative' | 'landing_page';
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
}

export interface AdSuggestionsData {
  performanceSummary: string;
  keywordSuggestions: KeywordSuggestion[];
  negativeKeywordSuggestions: NegativeKeywordSuggestion[];
  adCopySuggestions: AdCopySuggestion[];
  generalRecommendations: GeneralRecommendation[];
  generatedAt?: string;
  campaignAnalyzed?: string;
  period?: string;
  error?: string;
  message?: string;
  isMockData?: boolean;
}

export interface AdSuggestionsRequest {
  campaign: Campaign;
  metrics: {
    spend: number;
    clicks: number;
    impressions: number;
    ctr: number;
    cpc: number;
    conversions: number;
    costPerConversion: number;
  };
  keywords: Keyword[];
  searchTerms: SearchTerm[];
  ads: AdCopy[];
  period: string;
}

interface JobResponse {
  status?: 'processing' | 'complete' | 'error';
  jobId?: string;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdSuggestionsService {
  private readonly apiUrl = '/api/ad-suggestions';
  private pollingSubscription: Subscription | null = null;

  constructor(private http: HttpClient) {}

  getSuggestions(request: AdSuggestionsRequest): Observable<AdSuggestionsData> {
    // Cancel any existing polling
    this.cancelPolling();

    const result$ = new Subject<AdSuggestionsData>();

    // Start the job
    this.http.post<JobResponse>(this.apiUrl, request).pipe(
      catchError(error => {
        console.error('Failed to start job:', error);
        return of({ error: error.message || 'Failed to start analysis' } as JobResponse);
      })
    ).subscribe(response => {
      console.log('Job start response:', response);

      if (response.error && !response.jobId) {
        result$.next({
          performanceSummary: '',
          keywordSuggestions: [],
          negativeKeywordSuggestions: [],
          adCopySuggestions: [],
          generalRecommendations: [],
          error: response.error
        });
        result$.complete();
        return;
      }

      if (response.jobId) {
        // Start polling
        this.startPolling(response.jobId, result$);
      } else {
        result$.next({
          performanceSummary: '',
          keywordSuggestions: [],
          negativeKeywordSuggestions: [],
          adCopySuggestions: [],
          generalRecommendations: [],
          error: 'No job ID returned'
        });
        result$.complete();
      }
    });

    return result$.asObservable();
  }

  private startPolling(jobId: string, result$: Subject<AdSuggestionsData>): void {
    let attempts = 0;
    const maxAttempts = 90; // 3 minutes max (90 * 2 seconds)

    console.log(`Starting to poll for job ${jobId}`);

    this.pollingSubscription = interval(2000).subscribe(() => {
      attempts++;
      console.log(`Poll attempt ${attempts} for job ${jobId}`);

      if (attempts > maxAttempts) {
        console.log('Polling timed out');
        this.cancelPolling();
        result$.next({
          performanceSummary: '',
          keywordSuggestions: [],
          negativeKeywordSuggestions: [],
          adCopySuggestions: [],
          generalRecommendations: [],
          error: 'Analysis timed out after 3 minutes. Please try again.'
        });
        result$.complete();
        return;
      }

      this.http.get<AdSuggestionsData & JobResponse>(`${this.apiUrl}?jobId=${jobId}`).subscribe({
        next: (response) => {
          console.log('Poll response:', response);

          // Check if still processing (status 202)
          if (response.status === 'processing') {
            console.log('Still processing...');
            return; // Continue polling
          }

          // Got final result or error
          this.cancelPolling();

          if (response.error) {
            result$.next({
              performanceSummary: '',
              keywordSuggestions: [],
              negativeKeywordSuggestions: [],
              adCopySuggestions: [],
              generalRecommendations: [],
              error: response.error
            });
          } else {
            result$.next(response);
          }
          result$.complete();
        },
        error: (err) => {
          console.error('Poll error:', err);
          this.cancelPolling();
          result$.next({
            performanceSummary: '',
            keywordSuggestions: [],
            negativeKeywordSuggestions: [],
            adCopySuggestions: [],
            generalRecommendations: [],
            error: err.message || 'Polling failed'
          });
          result$.complete();
        }
      });
    });
  }

  private cancelPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }
}
