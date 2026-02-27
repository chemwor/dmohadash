import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface DailyUsage {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface OpenAICredits {
  totalGranted: number;
  totalUsed: number;
  totalAvailable: number;
}

export interface OpenAIBudgetLimit {
  monthlyLimit: number;
  remaining: number;
  percentUsed: number;
}

export interface OpenAIUsageData {
  // Summary
  totalCost: number;
  todayCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Per-request metrics
  avgCostPerRequest: number;

  // Business metrics
  purchaseCount: number;
  costPerPurchase: number;
  pricePerPurchase: number;
  profitPerPurchase: number;
  profitMargin: number;

  // Account/Billing info
  credits: OpenAICredits | null;
  budgetLimit: OpenAIBudgetLimit | null;

  // Alerts
  dailySpendAlert: boolean;
  dailySpendThreshold: number;

  // Chart data
  dailyData: DailyUsage[];

  // Metadata
  period?: string;
  lastUpdated?: string;
  fromCache?: boolean;
  cacheAge?: string;
  isMockData?: boolean;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OpenAIUsageService {
  private readonly apiUrl = '/api/dashboard/openai-usage';

  constructor(private http: HttpClient) {}

  getData(forceRefresh = false): Observable<OpenAIUsageData> {
    const url = forceRefresh ? `${this.apiUrl}?refresh=true` : this.apiUrl;

    return this.http.get<OpenAIUsageData>(url).pipe(
      catchError(error => {
        console.error('OpenAI usage service error:', error);
        return of(this.getEmptyData(error.message || 'Failed to fetch OpenAI usage data'));
      })
    );
  }

  private getEmptyData(errorMessage: string): OpenAIUsageData {
    return {
      totalCost: 0,
      todayCost: 0,
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgCostPerRequest: 0,
      purchaseCount: 0,
      costPerPurchase: 0,
      pricePerPurchase: 29,
      profitPerPurchase: 0,
      profitMargin: 0,
      credits: null,
      budgetLimit: null,
      dailySpendAlert: false,
      dailySpendThreshold: 50,
      dailyData: [],
      error: errorMessage
    };
  }
}
