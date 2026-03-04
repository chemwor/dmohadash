import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Statute {
  state: string;
  violation_category: string;
  statute_name: string;
  statute_text: string;
  procedural_requirements: string;
  homeowner_protections: string;
  notice_requirements: string;
  fine_rules: string;
  ai_generated: boolean;
  last_updated: string;
  created_at: string;
}

export interface CoverageSummary {
  total_possible: number;
  total_existing: number;
  by_state: Record<string, number>;
  by_category: Record<string, number>;
}

export interface StatutesResponse {
  statutes: Statute[];
  coverage: CoverageSummary;
  categories: string[];
  states: string[];
}

export interface ScanRequest {
  states: string[];
  categories: string[];
}

export interface ScanResult {
  generated: number;
  failed: number;
  skipped: number;
  total_missing: number;
  details: { state: string; category: string; status: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class StatutesService {
  private readonly apiUrl = '/api/dashboard/statutes';

  constructor(private http: HttpClient) {}

  getStatutes(): Observable<StatutesResponse> {
    return this.http.get<StatutesResponse>(this.apiUrl);
  }

  scanStatutes(request: ScanRequest): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.apiUrl}/scan`, request);
  }

  deleteStatute(state: string, category: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${state}/${category}`);
  }
}
