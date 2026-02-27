import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval, Subscription, catchError, of } from 'rxjs';

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

export interface PeriodInsights {
  dateRange: string;
  daysAnalyzed: number;
  totalSpend: number;
  totalRevenue: number;
  netPosition: number;
  costPerCaseStart: number;
  costPerPaidConversion: number;
  revenueToSpendRatio: number;
  dataQualityNote: string;
}

export interface KeywordOpportunity {
  keyword: string;
  matchType: 'PHRASE' | 'EXACT';
  source: 'confirmed_gap' | 'claude_hypothesis';
  evidence: string;
  intentScore: 'high' | 'medium';
  actualCpcPaid: number | null;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface SearchTermsAnalysis {
  totalSearchTerms: number;
  confirmedGaps: number;
  confirmedWaste: number;
  totalWastedOnWrongIntent: number;
  alreadyNegated: number;
}

export interface ExistingNegative {
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD' | 'UNKNOWN';
  scope: 'campaign' | 'account';
}

export interface AlreadyCovered {
  keyword: string;
  wastedSpend: number;
  note: string;
}

export interface NegativeKeywordAudit {
  existingNegatives: ExistingNegative[];
  alreadyCovered: AlreadyCovered[];
  gaps: NegativeKeywordSuggestion[];
  coverageScore: string;
}

export interface AdSuggestionsData {
  periodInsights?: PeriodInsights;
  performanceSummary: string;
  keywordSuggestions: KeywordSuggestion[];
  negativeKeywordSuggestions: NegativeKeywordSuggestion[];
  adCopySuggestions: AdCopySuggestion[];
  generalRecommendations: GeneralRecommendation[];
  keywordOpportunities?: KeywordOpportunity[];
  searchTermsAnalysis?: SearchTermsAnalysis;
  negativeKeywordAudit?: NegativeKeywordAudit;
  generatedAt?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
    daysAnalyzed: number;
  };
  error?: string;
  message?: string;
  isMockData?: boolean;
}

export interface AdSuggestionsRequest {
  startDate: string;
  endDate: string;
  customerId?: string;
}

interface JobResponse {
  status: 'processing' | 'complete' | 'error';
  jobId?: string;
  result?: AdSuggestionsData;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdSuggestionsService {
  private readonly apiUrl = '/api/dashboard/ad-suggestions';
  private pollingSubscription: Subscription | null = null;

  constructor(private http: HttpClient) {}

  getSuggestions(request: AdSuggestionsRequest): Observable<AdSuggestionsData> {
    // Cancel any existing polling
    this.cancelPolling();

    const result$ = new Subject<AdSuggestionsData>();

    console.log('Starting ad suggestions request:', request);

    // Start the job
    this.http.post<JobResponse>(this.apiUrl, request).pipe(
      catchError(error => {
        console.error('Failed to start job - full error:', error);
        const errorMsg = error.error?.error || error.message || 'Failed to start analysis';
        return of({ status: 'error' as const, error: errorMsg, jobId: undefined as string | undefined });
      })
    ).subscribe(response => {
      console.log('Job start response (full):', JSON.stringify(response));

      if (response.status === 'error' && !response.jobId) {
        console.log('Error response without jobId, showing error');
        result$.next(this.createEmptyResult(response.error || 'Failed to start analysis'));
        result$.complete();
        return;
      }

      if (response.jobId) {
        console.log('Got jobId, starting polling:', response.jobId);
        this.startPolling(response.jobId, result$);
      } else {
        console.log('No jobId in response, showing error');
        result$.next(this.createEmptyResult('No job ID returned'));
        result$.complete();
      }
    });

    return result$.asObservable();
  }

  private createEmptyResult(error: string): AdSuggestionsData {
    return {
      performanceSummary: '',
      keywordSuggestions: [],
      negativeKeywordSuggestions: [],
      adCopySuggestions: [],
      generalRecommendations: [],
      error
    };
  }

  private startPolling(jobId: string, result$: Subject<AdSuggestionsData>): void {
    let attempts = 0;
    const maxAttempts = 120; // 4 minutes max (120 * 2 seconds)

    console.log(`Starting to poll for job ${jobId}`);

    this.pollingSubscription = interval(2000).subscribe(() => {
      attempts++;

      if (attempts > maxAttempts) {
        console.log('Polling timed out');
        this.cancelPolling();
        result$.next(this.createEmptyResult('Analysis timed out after 4 minutes. Please try again.'));
        result$.complete();
        return;
      }

      this.http.get<JobResponse>(`${this.apiUrl}?jobId=${jobId}`).subscribe({
        next: (response) => {
          console.log(`Poll attempt ${attempts} for job ${jobId}:`, JSON.stringify(response));

          if (response.status === 'processing') {
            // Continue polling silently (log every 5th attempt)
            if (attempts % 5 === 0) {
              console.log(`Still processing after ${attempts} attempts...`);
            }
            return;
          }

          // Got final result or error
          this.cancelPolling();

          if (response.status === 'error') {
            console.log('Job returned error:', response.error);
            result$.next(this.createEmptyResult(response.error || 'Analysis failed'));
          } else if (response.status === 'complete' && response.result) {
            console.log('Job completed successfully');
            result$.next(response.result);
          } else {
            console.log('Unexpected response format:', response);
            result$.next(this.createEmptyResult('Unexpected response format'));
          }
          result$.complete();
        },
        error: (err) => {
          console.error('Poll HTTP error:', err);
          this.cancelPolling();
          const errorMsg = err.error?.error || err.message || 'Polling failed';
          result$.next(this.createEmptyResult(errorMsg));
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
