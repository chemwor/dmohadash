import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface Campaign {
  id?: string;
  name: string;
  status?: string;
  spend: number;
  clicks: number;
  impressions: number;
  cpc: number;
  ctr?: number;
  conversions: number;
}

export interface Keyword {
  campaignName: string;
  adGroupName: string;
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  status: string;
  qualityScore: number | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
  costPerConversion: number;
  ctr: number;
  cpc: number;
  searchImpressionShare: number | null;
  topImpressionShare: number | null;
}

export interface SearchTerm {
  campaignName: string;
  adGroupName: string;
  searchTerm: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
}

export interface AdCopy {
  adId?: string;
  campaignName: string;
  adGroupName: string;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
}

export interface GoogleAdsData {
  dailySpend: number;
  clicks: number;
  impressions: number;
  cpc: number;
  ctr?: number;
  conversions: number;
  costPerConversion?: number;
  campaigns: Campaign[];
  keywords: Keyword[];
  searchTerms: SearchTerm[];
  ads: AdCopy[];
  targetCampaign?: string;
  dailyBudget: number;
  period?: string;
  dateRange?: { startDate: string; endDate: string };
  isMockData?: boolean;
  error?: string;
}

export type GoogleAdsPeriod = 'today' | 'week' | 'month' | 'all';

@Injectable({
  providedIn: 'root'
})
export class GoogleAdsService {
  private readonly apiUrl = '/api/dashboard/google-ads';

  constructor(private http: HttpClient) {}

  getData(period: GoogleAdsPeriod = 'today'): Observable<GoogleAdsData> {
    return this.http.get<GoogleAdsData>(`${this.apiUrl}?period=${period}`).pipe(
      catchError(error => {
        console.error('Google Ads service error:', error);
        return of({
          dailySpend: 0,
          clicks: 0,
          impressions: 0,
          cpc: 0,
          conversions: 0,
          campaigns: [],
          keywords: [],
          searchTerms: [],
          ads: [],
          dailyBudget: 0,
          error: error.message || 'Failed to fetch Google Ads data'
        });
      })
    );
  }
}
