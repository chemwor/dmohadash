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

export type GoogleAdsPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all';

// --- Managed Campaigns (full structure with ad groups, keywords, ads) ---

export interface ManagedKeyword {
  text: string;
  match_type: string;
  status: string;
}

export interface ManagedAd {
  id: string;
  status: string;
  headlines: string[];
  descriptions: string[];
  final_urls: string[];
}

export interface ManagedAdGroup {
  id: string;
  name: string;
  status: string;
  max_cpc_usd: number;
  keywords: ManagedKeyword[];
  ads: ManagedAd[];
}

export interface ManagedCampaign {
  id: string;
  name: string;
  status: string;
  channel_type: string;
  daily_budget_usd: number;
  metrics_30d: {
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
    ctr?: number;
    cpc?: number;
  };
  ad_groups: ManagedAdGroup[];
  ad_group_count: number;
  keyword_count: number;
  ad_count: number;
}

export interface ManagedCampaignsResponse {
  campaigns: ManagedCampaign[];
  fetched_at?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAdsService {
  private readonly apiUrl = '/api/dashboard/google-ads';

  constructor(private http: HttpClient) {}

  getData(period: GoogleAdsPeriod = 'today', campaignName?: string): Observable<GoogleAdsData> {
    const params: string[] = [`period=${period}`];
    if (campaignName) {
      params.push(`campaign=${encodeURIComponent(campaignName)}`);
    }
    return this.http.get<GoogleAdsData>(`${this.apiUrl}?${params.join('&')}`).pipe(
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

  syncCustomerMatch(): Observable<any> {
    return this.http.post(`${this.apiUrl}/customer-match`, {});
  }

  uploadOfflineConversions(): Observable<any> {
    return this.http.post(`${this.apiUrl}/offline-conversions`, {});
  }

  getAllCampaigns(): Observable<ManagedCampaignsResponse> {
    return this.http.get<ManagedCampaignsResponse>(`${this.apiUrl}/all-campaigns`).pipe(
      catchError(error => {
        console.error('Managed campaigns error:', error);
        return of({ campaigns: [], error: error.message || 'Failed to fetch campaigns' });
      })
    );
  }

  setCampaignStatus(campaignId: string, status: 'ENABLED' | 'PAUSED'): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns/${campaignId}/status`, { status });
  }
}
