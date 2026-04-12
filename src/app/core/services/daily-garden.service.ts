import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface GardenTask {
  key: string;
  label: string;
  description: string;
  link?: string;
  completed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DailyGardenService {
  private readonly apiUrl = '/api/dashboard/daily-garden';

  constructor(private http: HttpClient) {}

  getCompletions(): Observable<{ date: string; completions: Record<string, boolean> }> {
    return this.http.get<{ date: string; completions: Record<string, boolean> }>(this.apiUrl).pipe(
      catchError(() => of({ date: '', completions: {} }))
    );
  }

  toggle(taskKey: string, completed: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${taskKey}`, { completed }).pipe(
      catchError(err => of({ ok: false, error: err.message }))
    );
  }
}
